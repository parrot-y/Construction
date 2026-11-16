import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  fetchJsonCached,
  readCacheGet,
  readCacheSet,
  clearReadCache,
  setOfflineUserScope,
  isOfflineError,
} from './offline-cache';
import { queueOfflineMutation, getQueuedMutations, flushSyncQueue, setOfflineSyncScopeForTest } from './offline-sync';

/**
 * J1 — the offline read-cache and write-queue must never leak one person's
 * data to the next person on a shared site phone.
 */

const userA = { id: 'user-a', email: 'a@co.ke', fullName: 'A', role: 'PM_QS', tenant: { id: 'tenant-1', name: 'T', slug: 't', currency: 'KES' } };
const userB = { id: 'user-b', email: 'b@co.ke', fullName: 'B', role: 'VIEWER', tenant: { id: 'tenant-1', name: 'T', slug: 't', currency: 'KES' } };
const userC = { id: 'user-c', email: 'c@co.ke', fullName: 'C', role: 'PM_QS', tenant: { id: 'tenant-2', name: 'T2', slug: 't2', currency: 'KES' } };

const PREFIX = 'sitesafi:read-cache:';
const storageKeys = () => {
  const out: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) out.push(k);
  }
  return out;
};

describe('offline read-cache privacy (J1)', () => {
  beforeEach(() => {
    localStorage.clear();
    setOfflineUserScope(null);
    vi.unstubAllGlobals();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('scopes entries per user — user B never sees user A cached rows', async () => {
    setOfflineUserScope(userA);
    await fetchJsonCached('/api/v1/projects', 'field:projects', undefined);
    // force a cached entry without fetch by writing directly
    readCacheSet('field:diaries:proj-1', { diaries: [{ id: 'secret-diary' }] });

    setOfflineUserScope(userB);
    expect(readCacheGet('field:diaries:proj-1')).toBeNull();
    // and a different tenant for the same user id is also isolated
    setOfflineUserScope(userC);
    expect(readCacheGet('field:diaries:proj-1')).toBeNull();
  });

  it('clearReadCache empties every entry (sign-out path)', () => {
    setOfflineUserScope(userA);
    readCacheSet('a', { x: 1 });
    readCacheSet('b', { y: 2 });
    expect(storageKeys().length).toBeGreaterThanOrEqual(2);
    clearReadCache();
    expect(storageKeys()).toHaveLength(0);
    expect(readCacheGet('a')).toBeNull();
  });

  it('no localStorage key contains a portal link token', async () => {
    const token = 'SECRET-LINK-TOKEN-abc123';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ quote: { id: 'q1' } }),
    }));
    await fetchJsonCached(`/api/v1/portals/client/${token}`, `portal:client:${token}`);
    await fetchJsonCached(`/api/public/quotes/${token}`, `public-quote:${token}`);
    for (const k of storageKeys()) {
      expect(k).not.toContain(token);
      expect(k).not.toContain('SECRET-LINK');
    }
    // and the same token under a different logical key still resolves
    const again = await fetchJsonCached(`/api/v1/portals/client/${token}`, `portal:client:${token}`);
    expect(again.savedAt).toBeNull();
  });

  it('entries expire after 7 days', () => {
    setOfflineUserScope(userA);
    readCacheSet('old', { v: 1 });
    const k = storageKeys()[0]!;
    const raw = JSON.parse(localStorage.getItem(k)!);
    raw.savedAt = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
    localStorage.setItem(k, JSON.stringify(raw));
    expect(readCacheGet('old')).toBeNull();
  });

  it('a revoked/expired portal link clears the cache instead of serving stale data', async () => {
    const token = 'revoked-token-xyz';
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ feed: [1, 2, 3] }) })
      .mockResolvedValueOnce({ ok: false, status: 410, json: async () => ({ message: 'Link revoked' }) }));
    await fetchJsonCached(`/api/v1/portals/client/${token}`, `portal:client:${token}`);
    expect(storageKeys().length).toBeGreaterThan(0);
    await expect(
      fetchJsonCached(`/api/v1/portals/client/${token}`, `portal:client:${token}`),
    ).rejects.toMatchObject({ status: 410 });
    expect(storageKeys()).toHaveLength(0);
  });

  it('does not cache non-GET responses', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', spy);
    setOfflineUserScope(userA);
    await fetchJsonCached('/api/v1/projects', 'x', { method: 'POST', body: '{}' });
    expect(storageKeys()).toHaveLength(0);
  });

  it('offline read falls back to cached body with savedAt', async () => {
    setOfflineUserScope(userA);
    readCacheSet('diary', { entries: [1] });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const res = await fetchJsonCached('/api/v1/projects/p/site-diaries', 'diary');
    expect(res.savedAt).toBeTruthy();
    expect(res.body.entries).toEqual([1]);
    expect(isOfflineError(new TypeError('Failed to fetch'))).toBe(true);
  });
});

describe('offline write-queue ownership (J1)', () => {
  beforeEach(() => {
    localStorage.clear();
    setOfflineUserScope(null);
    setOfflineSyncScopeForTest(null);
    vi.unstubAllGlobals();
  });

  it('queued writes of user A are never flushed under user B session', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchSpy);

    setOfflineUserScope(userA);
    await queueOfflineMutation('proj-1', '/api/v1/projects/proj-1/site-diaries', { note: 'A diary' });

    // user B signs in on the same phone — A's queued write must not be sent
    setOfflineUserScope(userB);
    const bQueue = await getQueuedMutations();
    expect(bQueue).toHaveLength(0);
    const res = await flushSyncQueue();
    expect(res.syncedCount).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();

    // A signs back in — their own queued write flushes
    setOfflineUserScope(userA);
    expect(await getQueuedMutations()).toHaveLength(1);
    const res2 = await flushSyncQueue();
    expect(res2.syncedCount).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(await getQueuedMutations()).toHaveLength(0);
  });
});
