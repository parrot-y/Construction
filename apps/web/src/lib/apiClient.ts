/**
 * C4 — single typed API client for the console.
 *
 * - credentials:'include' (HttpOnly session cookies)
 * - one shared 401 → POST /api/v1/auth/refresh → retry (deduped across
 *   concurrent callers)
 * - ApiError with { status, code, message } mapped from the API envelope
 * - idempotencyKey() helper + automatic Idempotency-Key on money POSTs
 *   (payments, invoices, certificates) via `money: true`
 */

export class ApiError extends Error {
  status: number;
  code?: string;
  retryAfterSeconds?: number;
  constructor(status: number, message: string, code?: string, retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  /** Attach a fresh Idempotency-Key (crypto.randomUUID) — required for money POSTs. */
  idempotencyKey?: string | true;
  /** Money mutations: auto-generate an Idempotency-Key when none supplied. */
  money?: boolean;
  signal?: AbortSignal;
}

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

async function rawRequest<T>(path: string, opts: RequestOptions, retried: boolean): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const method = opts.method ?? 'GET';
  const needsKey = opts.idempotencyKey || (opts.money && method !== 'GET');
  if (needsKey && !headers['Idempotency-Key'] && !headers['idempotency-key']) {
    headers['Idempotency-Key'] = typeof opts.idempotencyKey === 'string' ? opts.idempotencyKey : crypto.randomUUID();
  }

  const res = await fetch(path, { method, credentials: 'include', headers, body, signal: opts.signal });

  if (res.status === 401 && !retried && !path.startsWith('/api/v1/auth/')) {
    if (await tryRefresh()) return rawRequest<T>(path, opts, true);
  }

  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }

  if (!res.ok) {
    const payload = json ?? {};
    const retryAfter = Number(res.headers.get('Retry-After') ?? payload.retryAfterSeconds ?? 0) || undefined;
    throw new ApiError(
      res.status,
      payload.message || payload.error || `Request failed (${res.status})`,
      payload.code ?? payload.error,
      retryAfter,
    );
  }
  // Return the parsed body as-is — endpoints use mixed envelopes
  // ({data}, {items}, bare arrays); callers type the shape they consume.
  return json as T;
}

export const api = {
  get: <T = unknown>(path: string, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    rawRequest<T>(path, { ...opts }, false),
  post: <T = unknown>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    rawRequest<T>(path, { ...opts, method: 'POST', body, money: opts.money ?? isMoneyPath(path) }, false),
  put: <T = unknown>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    rawRequest<T>(path, { ...opts, method: 'PUT', body }, false),
  patch: <T = unknown>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    rawRequest<T>(path, { ...opts, method: 'PATCH', body }, false),
  delete: <T = unknown>(path: string, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    rawRequest<T>(path, { ...opts, method: 'DELETE' }, false),
};

/** Explicit idempotency key for money POSTs (replay-safe retries). */
export function idempotencyKey(): string {
  return crypto.randomUUID();
}
