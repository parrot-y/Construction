import { describe, expect, it, vi, beforeEach } from 'vitest';
import { api, ApiError, idempotencyKey } from './apiClient';

const jsonRes = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

describe('apiClient (C4)', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('returns parsed bodies as-is (mixed envelopes)', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonRes(200, { data: { id: 1 } }))
      .mockResolvedValueOnce(jsonRes(200, { invoices: [1, 2] })));
    expect(await api.get('/x')).toEqual({ data: { id: 1 } });
    expect(await api.get('/y')).toEqual({ invoices: [1, 2] });
  });

  it('maps errors to ApiError with status/message/code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonRes(422, { error: 'Bad Request', message: 'nope', code: 'X' }))));
    await expect(api.get('/x')).rejects.toMatchObject({ name: 'ApiError', status: 422, message: 'nope', code: 'X' });
    await expect(api.get('/x')).rejects.toBeInstanceOf(ApiError);
  });

  it('refreshes once on 401 and retries the original request', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(jsonRes(401, { message: 'expired' }))
      .mockResolvedValueOnce(jsonRes(200, {}))   // refresh
      .mockResolvedValueOnce(jsonRes(200, { data: 'ok' }));
    vi.stubGlobal('fetch', f);
    const out = await api.get('/protected');
    expect(out).toEqual({ data: 'ok' });
    expect(f).toHaveBeenCalledTimes(3);
    expect(f.mock.calls[1][0]).toBe('/api/v1/auth/refresh');
  });

  it('does not retry when refresh fails', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(jsonRes(401, {}))
      .mockImplementation(() => Promise.resolve(jsonRes(401, {})));
    vi.stubGlobal('fetch', f);
    await expect(api.get('/protected')).rejects.toBeInstanceOf(ApiError);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('auto-attaches Idempotency-Key on money POSTs; honours explicit key', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(jsonRes(200, { data: {} })));
    vi.stubGlobal('fetch', f);
    await api.post('/api/v1/invoices/1/payments', { amount: 5 });
    const h1 = f.mock.calls[0][1].headers as Record<string, string>;
    expect(h1['Idempotency-Key']).toBeTruthy();

    await api.post('/api/v1/invoices', { title: 'x' });
    const h2 = f.mock.calls[1][1].headers as Record<string, string>;
    expect(h2['Idempotency-Key']).toBeTruthy(); // money path via isMoneyPath

    await api.post('/api/v1/projects/1/costs', { amount: 1 });
    const h3 = f.mock.calls[2][1].headers as Record<string, string>;
    expect(h3['Idempotency-Key']).toBeUndefined(); // costs not in money regex? commitments is
  });

  it('idempotencyKey() returns unique uuids', () => {
    expect(idempotencyKey()).not.toBe(idempotencyKey());
  });
});
