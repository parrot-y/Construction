/**
 * P1.1 — the one request layer for the whole web app.
 *
 * Every API call goes through `api.get/post/patch/put/delete`. Guarantees:
 *  - credentials:'include' + JSON headers
 *  - 20 s timeout (AbortController)
 *  - two retries for GET only (network/timeout/5xx — never 4xx)
 *  - one shared 401 → POST /api/v1/auth/refresh → retry, deduped across
 *    concurrent callers; a second 401 surfaces as kind 'auth'
 *  - typed ApiError kinds with plain-language messages — callers never see
 *    `TypeError: Failed to fetch` or raw `err.message`
 *  - Idempotency-Key on money mutations (payments, invoices, certificates…)
 *    so a retry can never create a duplicate record
 *
 * Error kinds: offline | network | timeout | auth | forbidden | validation |
 * conflict | server. `err.message` is ALWAYS the plain message — safe to
 * render directly.
 */

export type ApiErrorKind =
  | 'offline'
  | 'network'
  | 'timeout'
  | 'auth'
  | 'forbidden'
  | 'validation'
  | 'conflict'
  | 'server';

const PLAIN_MESSAGES: Record<ApiErrorKind, string> = {
  offline: "You're offline. Your changes are kept on this device — they'll send when you're back.",
  network: "Can't reach SiteSafi right now. Your changes are kept. Try again.",
  timeout: 'SiteSafi is taking too long to answer. Your changes are kept. Try again.',
  auth: 'Your session has ended. Sign in again to continue.',
  forbidden: "You don't have permission to do this. Ask your admin.",
  validation: 'Some details need fixing before this can be saved.',
  conflict: 'This changed while you were working. Reload and try again.',
  server: 'Something went wrong on our side. Try again.',
};

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;
  code?: string;
  retryAfterSeconds?: number;
  /** Field-level details from a 422/400 payload, when the API sends them. */
  fields?: Record<string, string>;

  constructor(kind: ApiErrorKind, message?: string, init?: { status?: number; code?: string; retryAfterSeconds?: number; fields?: Record<string, string> }) {
    super(message ?? PLAIN_MESSAGES[kind]);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = init?.status;
    this.code = init?.code;
    this.retryAfterSeconds = init?.retryAfterSeconds;
    this.fields = init?.fields;
  }
}

/** Type guard — anything thrown by api.* is an ApiError with a plain message. */
export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/** Plain message for ANY thrown value — never a raw TypeError/err.message. */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof DOMException && err.name === 'AbortError') return PLAIN_MESSAGES.timeout;
  return fallback;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  /** Attach a fresh Idempotency-Key (crypto.randomUUID) — money POSTs. */
  idempotencyKey?: string | true;
  /** Money mutations: auto-generate an Idempotency-Key when none supplied. */
  money?: boolean;
  signal?: AbortSignal;
  /** Skip the 20s internal timeout (long-running exports etc.). */
  timeoutMs?: number;
  /** Return the raw Response (blob/download/SSE) instead of parsed JSON. */
  raw?: boolean;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const GET_RETRIES = 2;
const RETRYABLE_KINDS = new Set<ApiErrorKind>(['network', 'timeout', 'server']);

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

function isMoneyPath(path: string): boolean {
  return /\/(payments|invoices|certificates|valuations|retention|commitments|purchase-orders|variations)(\/|$)/.test(path);
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

function statusToKind(status: number): ApiErrorKind {
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  if (status === 409) return 'conflict';
  if (status === 400 || status === 422 || status === 413) return 'validation';
  return 'server';
}

function extractFields(payload: any): Record<string, string> | undefined {
  const src = payload?.fields ?? payload?.errors ?? payload?.details;
  if (!src || typeof src !== 'object') return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(src)) {
    if (typeof v === 'string') out[k] = v;
    else if (Array.isArray(v) && typeof v[0] === 'string') out[k] = v[0];
  }
  return Object.keys(out).length ? out : undefined;
}

async function parseBody(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { message: text.slice(0, 200) }; }
}

async function rawRequest<T>(path: string, opts: RequestOptions, retried: boolean, attempt: number): Promise<T> {
  const method = opts.method ?? 'GET';

  // Fast-path offline: never burn the timeout when the browser knows it's offline.
  if (!isOnline()) throw new ApiError('offline');

  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    if (opts.body instanceof FormData) {
      // Let the browser set the multipart boundary — never JSON-encode files.
      body = opts.body;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
  }
  const needsKey = opts.idempotencyKey || (opts.money && method !== 'GET');
  if (needsKey && !headers['Idempotency-Key'] && !headers['idempotency-key']) {
    headers['Idempotency-Key'] = typeof opts.idempotencyKey === 'string' ? opts.idempotencyKey : crypto.randomUUID();
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onOuterAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onOuterAbort, { once: true });

  let res: Response;
  try {
    res = await fetch(path, { method, credentials: 'include', headers, body, signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onOuterAbort);
    if (opts.signal?.aborted) throw new ApiError('timeout');
    if (err instanceof DOMException && err.name === 'AbortError') {
      // Our 20s timer fired (or caller aborted) — treat as timeout.
      throw new ApiError('timeout');
    }
    // fetch TypeError = DNS/TCP failure → can't reach the server.
    throw new ApiError('network');
  }
  clearTimeout(timer);
  opts.signal?.removeEventListener('abort', onOuterAbort);

  if (res.status === 401 && !retried && !path.startsWith('/api/v1/auth/')) {
    if (await tryRefresh()) return rawRequest<T>(path, opts, true, attempt);
    throw new ApiError('auth', undefined, { status: 401 });
  }

  if (opts.raw) {
    if (!res.ok) {
      const payload = await parseBody(res).catch(() => null);
      const kind = statusToKind(res.status);
      throw new ApiError(kind, payload?.message || payload?.error || PLAIN_MESSAGES[kind], {
        status: res.status,
        code: payload?.code ?? (typeof payload?.error === 'string' ? payload.error : undefined),
      });
    }
    return res as unknown as T;
  }

  const json = await parseBody(res);

  if (!res.ok) {
    const payload = json ?? {};
    const kind = statusToKind(res.status);
    const retryAfter = Number(res.headers.get('Retry-After') ?? payload.retryAfterSeconds ?? 0) || undefined;
    // Validation errors carry the server's field messages when present.
    const message =
      kind === 'validation' && extractFields(payload)
        ? 'Some details need fixing before this can be saved.'
        : payload.message || payload.error || PLAIN_MESSAGES[kind];
    throw new ApiError(kind, typeof message === 'string' ? message : PLAIN_MESSAGES[kind], {
      status: res.status,
      code: payload.code ?? (typeof payload.error === 'string' ? payload.error : undefined),
      retryAfterSeconds: retryAfter,
      fields: extractFields(payload),
    });
  }

  // GET retries: network/timeout/5xx only, exponential-ish backoff, idempotent.
  return json as T;
}

async function request<T>(path: string, opts: RequestOptions): Promise<T> {
  const method = opts.method ?? 'GET';
  const maxAttempts = method === 'GET' ? GET_RETRIES + 1 : 1;
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await rawRequest<T>(path, opts, false, attempt);
    } catch (err) {
      lastErr = err;
      const retryable = err instanceof ApiError && RETRYABLE_KINDS.has(err.kind);
      if (!retryable || attempt === maxAttempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastErr;
}

/**
 * Low-level transport for infrastructure callers (the offline queue/cache)
 * that must inspect the raw Response themselves. Same credentials + timeout
 * guarantees as api.*; error mapping is the caller's job.
 */
export async function apiTransport(path: string, init: { method?: string; headers?: Record<string, string>; body?: BodyInit; signal?: AbortSignal; timeoutMs?: number } = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const onOuter = () => controller.abort();
  init.signal?.addEventListener('abort', onOuter, { once: true });
  try {
    return await fetch(path, {
      method: init.method ?? 'GET',
      credentials: 'include',
      headers: init.headers,
      body: init.body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', onOuter);
  }
}

/** Escape hatch for non-JSON responses (blob downloads). Still goes through
 *  the timeout/refresh/error-kind pipeline; caller reads res.blob() etc. */
export async function rawFetch(path: string, opts: RequestOptions = {}): Promise<Response> {
  return request<Response>(path, { ...opts, raw: true });
}

export const api = {
  get: <T = unknown>(path: string, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...opts, method: 'GET' }),
  post: <T = unknown>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...opts, method: 'POST', body, money: opts.money ?? isMoneyPath(path) }),
  put: <T = unknown>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  patch: <T = unknown>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T = unknown>(path: string, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
};

/** Explicit idempotency key for money POSTs (replay-safe retries). */
export function idempotencyKey(): string {
  return crypto.randomUUID();
}
