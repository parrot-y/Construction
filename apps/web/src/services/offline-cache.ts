/**
 * Read-through cache for GET payloads — lets screens keep showing the
 * last saved information when the device goes offline, instead of a raw
 * "Failed to fetch" error box.
 *
 * Only successful JSON responses are cached. Entries live in localStorage
 * under `sitesafi:read-cache:` so they survive reloads on the same device.
 */

const PREFIX = 'sitesafi:read-cache:';
const MAX_ENTRIES = 60;

export interface CachedRead {
  body: any;
  /** ISO timestamp of when the data was last fetched from the server. */
  savedAt: string;
}

export function isOfflineError(e: any): boolean {
  return (
    e instanceof TypeError ||
    /failed to fetch|network\s?error|load failed|network request failed|err_internet|err_network/i.test(e?.message || '')
  );
}

export function readCacheGet(key: string): CachedRead | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.savedAt !== 'string') return null;
    return { body: parsed.body, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

export function readCacheSet(key: string, body: any): void {
  try {
    // Bound the cache — evict oldest entries when over capacity.
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    if (keys.length >= MAX_ENTRIES) {
      keys
        .map((k) => ({ k, at: readCacheGet(k.slice(PREFIX.length))?.savedAt || '' }))
        .sort((a, b) => a.at.localeCompare(b.at))
        .slice(0, keys.length - MAX_ENTRIES + 1)
        .forEach(({ k }) => localStorage.removeItem(k));
    }
    localStorage.setItem(PREFIX + key, JSON.stringify({ body, savedAt: new Date().toISOString() }));
  } catch {
    // Storage full or unavailable — caching is best-effort.
  }
}

/**
 * fetch() + JSON parse + read-cache. On success the body is cached under
 * `cacheKey` and `{ body, savedAt: null }` is returned. On a network-level
 * failure a cached body is returned as `{ body, savedAt }` so the caller can
 * render last-saved data with a "saved information from <time>" notice.
 * HTTP errors (4xx/5xx) and cache misses rethrow as before.
 */
export async function fetchJsonCached(
  url: string,
  cacheKey: string,
  init?: RequestInit,
): Promise<{ body: any; savedAt: string | null }> {
  try {
    const res = await fetch(url, { credentials: 'include', ...init });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = new Error(body?.message || body?.error || `Request failed (${res.status})`) as Error & { status: number };
      e.status = res.status;
      throw e;
    }
    readCacheSet(cacheKey, body);
    return { body, savedAt: null };
  } catch (e: any) {
    if (isOfflineError(e)) {
      const cached = readCacheGet(cacheKey);
      if (cached) return { body: cached.body, savedAt: cached.savedAt };
    }
    throw e;
  }
}
