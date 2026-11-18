/**
 * Read-through cache for GET payloads — lets screens keep showing the
 * last saved information when the device goes offline, instead of a raw
 * "Failed to fetch" error box.
 *
 * Privacy rules (J1 — shared site phones):
 * - Every entry is scoped to the signed-in user+tenant, or to a hash of
 *   the portal/public-quote link token. User B on the same browser can
 *   never read user A's rows.
 * - Storage keys are hashed — a portal link token never appears in
 *   localStorage.
 * - Entries expire after 7 days.
 * - clearReadCache() runs on sign-out, forced sign-out (401 after a
 *   failed refresh) and whenever a portal call answers 401/403/404/410
 *   or a revoked-link 429, so a dead link can't serve stale data offline.
 * - Only GET responses are cached; POST/PATCH/PUT/DELETE bypass it.
 */

import { setOfflineSyncScope } from './offline-sync';
import { apiTransport } from '../lib/api';

const PREFIX = 'sitesafi:read-cache:';
const MAX_ENTRIES = 60;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** HTTP statuses that mean "this link/session is dead" — purge the cache. */
const PURGE_STATUSES = new Set([401, 403, 404, 410]);
const REVOKED_RE = /revoked|expired|disabled|deactivated|invalid link/i;

export interface CachedRead {
  body: any;
  /** ISO timestamp of when the data was last fetched from the server. */
  savedAt: string;
}

/** cyrb53 — fast, well-distributed 53-bit string hash (sync, no crypto needed). */
function hash53(str: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------------------
// Scopes — who (or which link) a cache entry belongs to.
// ---------------------------------------------------------------------------

let activeScope: string | null = null;

export interface CacheUser {
  id: string;
  tenant?: { id: string } | null;
}

/** Scope for an authenticated console user: hash(userId + tenantId). */
export function userCacheScope(user: CacheUser | null | undefined): string | null {
  if (!user?.id) return null;
  return `u:${hash53(`${user.id}:${user.tenant?.id ?? ''}`)}`;
}

/** Scope for a portal/public link: hash of the token, never the token. */
export function tokenCacheScope(token: string): string {
  return `t:${hash53(token)}`;
}

/**
 * Set the active console-user scope. Called whenever the session changes
 * (login, /auth/me restore, sign-out). Portal/public URLs derive their
 * scope from the link token automatically and ignore this.
 */
export function setOfflineUserScope(user: CacheUser | null | undefined): void {
  activeScope = userCacheScope(user);
  // The write-queue uses the same scope string so queued mutations are only
  // ever flushed by the user who created them.
  setOfflineSyncScope(activeScope);
}

/** Extract a link token from a portal or public-quote API URL, if present. */
function tokenFromUrl(url: string): string | null {
  const m = url.match(/\/api\/(?:v1\/)?(?:portals|public)\/(?:[a-z-]+\/)?([^/?#]+)/i);
  if (!m) return null;
  const seg = decodeURIComponent(m[1]!);
  // Portal URLs embed the token as the last path segment.
  return seg && !/^(change-orders|respond|links|feed)$/i.test(seg) ? seg : null;
}

function scopeForUrl(url: string): string {
  const token = tokenFromUrl(url);
  if (token) return tokenCacheScope(token);
  return activeScope ?? 'anon';
}

function storageKey(scope: string, logicalKey: string): string {
  return `${PREFIX}${scope}:${hash53(logicalKey)}`;
}

function eachCacheEntry(fn: (storageKey: string) => void): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) keys.push(k);
  }
  keys.forEach(fn);
}

export function isOfflineError(e: any): boolean {
  return (
    e instanceof TypeError ||
    /failed to fetch|network\s?error|load failed|network request failed|err_internet|err_network/i.test(e?.message || '')
  );
}

export function readCacheGet(key: string): CachedRead | null {
  try {
    const sk = storageKey(scopeForUrl(''), key);
    const raw = localStorage.getItem(sk);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.savedAt !== 'string') return null;
    if (Date.now() - new Date(parsed.savedAt).getTime() > TTL_MS) {
      localStorage.removeItem(sk);
      return null;
    }
    return { body: parsed.body, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

export function readCacheSet(key: string, body: any, scope?: string): void {
  try {
    const sc = scope ?? scopeForUrl('');
    const sk = storageKey(sc, key);
    // Bound the cache — evict oldest entries when over capacity.
    const entries: { sk: string; at: string }[] = [];
    eachCacheEntry((k) => {
      try {
        const p = JSON.parse(localStorage.getItem(k) || 'null');
        entries.push({ sk: k, at: typeof p?.savedAt === 'string' ? p.savedAt : '' });
      } catch { /* corrupt entry — treat as oldest */ entries.push({ sk: k, at: '' }); }
    });
    if (entries.length >= MAX_ENTRIES) {
      entries.sort((a, b) => a.at.localeCompare(b.at))
        .slice(0, entries.length - MAX_ENTRIES + 1)
        .forEach(({ sk: k }) => localStorage.removeItem(k));
    }
    localStorage.setItem(sk, JSON.stringify({ body, savedAt: new Date().toISOString() }));
  } catch {
    // Storage full or unavailable — caching is best-effort.
  }
}

/** Remove every cached read — sign-out, forced sign-out, dead portal link. */
export function clearReadCache(): void {
  try {
    eachCacheEntry((k) => localStorage.removeItem(k));
  } catch { /* storage unavailable */ }
}

/** Test/diagnostic helper: the raw storage keys currently held. */
export function readCacheStorageKeys(): string[] {
  const out: string[] = [];
  eachCacheEntry((k) => out.push(k));
  return out;
}

/**
 * HTTP GET + JSON parse + read-cache. On success the body is cached under
 * `cacheKey` (scoped to the user or link token) and `{ body, savedAt: null }`
 * is returned. On a network-level failure a cached body is returned as
 * `{ body, savedAt }` so the caller can render last-saved data with a
 * "saved information from <time>" notice. HTTP errors rethrow as before —
 * and auth/link failures (401/403/404/410, revoked-link 429) purge the
 * whole cache first so stale data can never resurface offline.
 *
 * Only GET (or method-less) requests are cached; mutations bypass it.
 */
export async function fetchJsonCached(
  url: string,
  cacheKey: string,
  init?: RequestInit,
): Promise<{ body: any; savedAt: string | null }> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const cacheable = method === 'GET';
  const scope = scopeForUrl(url);

  try {
    const res = await apiTransport(url, {
      method: init?.method,
      headers: init?.headers as Record<string, string> | undefined,
      body: init?.body ?? undefined,
      signal: init?.signal ?? undefined,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const revoked = res.status === 429 && REVOKED_RE.test(body?.message || body?.code || '');
      if (PURGE_STATUSES.has(res.status) || revoked) clearReadCache();
      const e = new Error(body?.message || body?.error || `Request failed (${res.status})`) as Error & { status: number };
      e.status = res.status;
      throw e;
    }
    if (cacheable) readCacheSet(cacheKey, body, scope);
    return { body, savedAt: null };
  } catch (e: any) {
    if (isOfflineError(e) && cacheable) {
      const cached = readCacheGetScoped(cacheKey, scope);
      if (cached) return { body: cached.body, savedAt: cached.savedAt };
    }
    throw e;
  }
}

function readCacheGetScoped(key: string, scope: string): CachedRead | null {
  try {
    const sk = storageKey(scope, key);
    const raw = localStorage.getItem(sk);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.savedAt !== 'string') return null;
    if (Date.now() - new Date(parsed.savedAt).getTime() > TTL_MS) {
      localStorage.removeItem(sk);
      return null;
    }
    return { body: parsed.body, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}
