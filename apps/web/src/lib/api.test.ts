import { describe, expect, it, vi, beforeEach } from 'vitest';
import { api, ApiError, apiErrorMessage, isApiError } from './api';

const jsonRes = (status: number, body: unknown = {}, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

const setOnline = (v: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', { value: v, configurable: true });
};

describe('api request layer (P1.1)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    setOnline(true);
  });

  it('sends credentials + JSON and returns the parsed body', async () => {
    const f = vi.fn().mockResolvedValue(jsonRes(200, { data: { id: 1 } }));
    vi.stubGlobal('fetch', f);
    const out = await api.post('/api/v1/things', { name: 'x' });
    expect(out).toEqual({ data: { id: 1 } });
    const [, init] = f.mock.calls[0]!;
    expect(init.credentials).toBe('include');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"name":"x"}');
  });

  it('GET retries twice on network failure then succeeds', async () => {
    const f = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonRes(200, { ok: true }));
    vi.stubGlobal('fetch', f);
    const out = await api.get('/api/v1/x');
    expect(out).toEqual({ ok: true });
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('POST never retries — one network failure throws kind network', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', f);
    await expect(api.post('/api/v1/x', {})).rejects.toMatchObject({ kind: 'network' });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('navigator offline → kind offline without calling fetch', async () => {
    setOnline(false);
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    await expect(api.get('/api/v1/x')).rejects.toMatchObject({ kind: 'offline' });
    expect(f).not.toHaveBeenCalled();
  });

  it('abort/timeout → kind timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(
      (_u: string, init: RequestInit) => new Promise((_res, rej) => {
        init.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
      }),
    ));
    vi.useFakeTimers();
    // POST = single attempt, so one 50ms timer is enough.
    const p = api.post('/api/v1/x', {}, { timeoutMs: 50 });
    const assertion = expect(p).rejects.toMatchObject({ kind: 'timeout' });
    await vi.advanceTimersByTimeAsync(60);
    await assertion;
  });

  it.each([
    [403, 'forbidden'],
    [409, 'conflict'],
    [422, 'validation'],
    [400, 'validation'],
    [500, 'server'],
    [429, 'server'],
  ])('HTTP %i → kind %s', async (status, kind) => {
    // Consistent status on every attempt — GET retries keep the same kind.
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(jsonRes(status, { message: 'server says no' }))));
    const err: any = await api.get('/api/v1/x').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe(kind);
    expect(err.status).toBe(status);
  });

  it('HTTP 401 with failed refresh → kind auth', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonRes(401, {}))));
    const err = await api.get('/api/v1/x').catch((e) => e);
    expect(err).toMatchObject({ kind: 'auth', status: 401 });
  });

  it('401 → refresh succeeds → original retried once', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(jsonRes(401, {}))
      .mockResolvedValueOnce(jsonRes(200, {}))            // refresh ok
      .mockResolvedValueOnce(jsonRes(200, { data: 'ok' }));
    vi.stubGlobal('fetch', f);
    expect(await api.get('/api/v1/protected')).toEqual({ data: 'ok' });
    expect(f.mock.calls[1]![0]).toBe('/api/v1/auth/refresh');
  });

  it('401 → refresh fails → kind auth, no infinite loop', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(jsonRes(401, {})));
    vi.stubGlobal('fetch', f);
    const err = await api.get('/api/v1/protected').catch((e) => e);
    expect(err).toMatchObject({ kind: 'auth' });
    expect(f).toHaveBeenCalledTimes(2); // original + one refresh
  });

  it('money POST auto-attaches Idempotency-Key', async () => {
    const f = vi.fn().mockResolvedValue(jsonRes(200, {}));
    vi.stubGlobal('fetch', f);
    await api.post('/api/v1/projects/p1/invoices', { amount: 1 });
    const [, init] = f.mock.calls[0]!;
    expect(init.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('non-money POST has no Idempotency-Key', async () => {
    const f = vi.fn().mockResolvedValue(jsonRes(200, {}));
    vi.stubGlobal('fetch', f);
    await api.post('/api/v1/projects', { name: 'x' });
    const [, init] = f.mock.calls[0]!;
    expect(init.headers['Idempotency-Key']).toBeUndefined();
  });

  it('422 surfaces field-level details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(jsonRes(422, { message: 'Invalid', fields: { email: 'Required', name: ['Too short'] } }))));
    const err: any = await api.post('/api/v1/x', {}).catch((e) => e);
    expect(err).toMatchObject({ kind: 'validation', fields: { email: 'Required', name: 'Too short' } });
  });

  it('plain messages never contain raw TypeError text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const err: any = await api.get('/api/v1/x').catch((e) => e);
    expect(err.message).not.toContain('Failed to fetch');
    expect(err.message).not.toContain('TypeError');
    expect(apiErrorMessage(new Error('raw secret internals'))).not.toContain('raw secret');
    expect(isApiError(err)).toBe(true);
  });

  it('P4.2 — concurrent identical GETs share one in-flight request', async () => {
    let resolveFetch: ((r: Response) => void) | undefined;
    const f = vi.fn().mockImplementation(() => new Promise<Response>((res) => { resolveFetch = res; }));
    vi.stubGlobal('fetch', f);
    const p1 = api.get('/api/v1/shared');
    const p2 = api.get('/api/v1/shared');
    const p3 = api.get('/api/v1/shared');
    expect(f).toHaveBeenCalledTimes(1);
    resolveFetch!(jsonRes(200, { ok: 1 }));
    await expect(p1).resolves.toEqual({ ok: 1 });
    await expect(p2).resolves.toEqual({ ok: 1 });
    await expect(p3).resolves.toEqual({ ok: 1 });
    // Entry cleared after settle — a later call fetches again.
    const p4 = api.get('/api/v1/shared');
    expect(f).toHaveBeenCalledTimes(2);
    resolveFetch!(jsonRes(200, { ok: 2 }));
    await expect(p4).resolves.toEqual({ ok: 2 });
  });

  it('P4.2 — a successful mutation invalidates in-flight GET dedupe', async () => {
    // Regression: a GET already in flight when a POST lands may have read
    // pre-mutation state; post-mutation reads must not share it.
    const pending = new Map<string, (r: Response) => void>();
    const f = vi.fn().mockImplementation((url: string) =>
      new Promise<Response>((res) => { pending.set(url, res); }));
    vi.stubGlobal('fetch', f);
    const staleGet = api.get('/api/v1/invoices?page=1&limit=50');
    const post = api.post('/api/v1/invoices', { title: 'x' });
    pending.get('/api/v1/invoices?page=1&limit=50')!(jsonRes(200, { invoices: ['old'] }));
    pending.get('/api/v1/invoices')!(jsonRes(201, { id: 'inv1' }));
    await staleGet;
    await post;
    // New GET after the mutation must issue a fresh request, not dedupe.
    const freshGet = api.get('/api/v1/invoices?page=1&limit=50');
    expect(f).toHaveBeenCalledTimes(3);
    pending.get('/api/v1/invoices?page=1&limit=50')!(jsonRes(200, { invoices: ['old', 'new'] }));
    await expect(freshGet).resolves.toEqual({ invoices: ['old', 'new'] });
  });

  it('P4.2 — GETs with a caller signal or headers are never deduped', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(jsonRes(200, {})));
    vi.stubGlobal('fetch', f);
    const ac = new AbortController();
    await Promise.all([
      api.get('/api/v1/sig', { signal: ac.signal }),
      api.get('/api/v1/sig', { signal: ac.signal }),
      api.get('/api/v1/sig', { headers: { 'x-trace': '1' } }),
      api.get('/api/v1/sig', { headers: { 'x-trace': '1' } }),
    ]);
    expect(f).toHaveBeenCalledTimes(4);
  });
});
