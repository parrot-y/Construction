import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Error monitoring (staging): no-op without VITE_SENTRY_DSN.
// PII scrubbed — no user emails, IPs, or request bodies leave the browser.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (sentryDsn) {
  void import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn: sentryDsn,
      environment: import.meta.env.MODE,
      release: (import.meta.env.VITE_APP_VERSION as string | undefined) || '0.1.0',
      beforeSend(event) {
        if (event.user) {
          delete event.user.email;
          delete event.user.ip_address;
        }
        return event;
      },
    });
  });
}

// Silent session refresh (audit S-01): access tokens live 15 minutes; on any
// 401 from a same-origin API call, rotate via /auth/refresh once and retry.
const originalFetch = window.fetch.bind(window);
let refreshPromise: Promise<boolean> | null = null;

const tryRefresh = (): Promise<boolean> => {
  refreshPromise ??= originalFetch('/api/v1/auth/refresh', {
    method: 'POST',
    credentials: 'include',
})
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => { refreshPromise = null;});
  return refreshPromise;
};

// List pagination (staging): API list endpoints return `?page=`/`?limit=`
// (default 50, max 200) plus a `page` block or X-Has-More headers. The fetch
// wrapper below follows pages transparently and merges list arrays so every
// existing list view keeps working with complete data.
const MAX_LIST_PAGES = 20;

const mergeByLimit = (acc: any, nxt: any, limit: number, depth = 0): any => {
  if (depth > 4) return acc;
  if (Array.isArray(acc) && Array.isArray(nxt)) return [...acc, ...nxt];
  if (acc && nxt && typeof acc === 'object' && typeof nxt === 'object'
      && !Array.isArray(acc) && !Array.isArray(nxt)) {
    const out: Record<string, any> = { ...acc };
    for (const k of Object.keys(nxt)) {
      const a = acc[k]; const b = nxt[k];
      if (Array.isArray(a) && Array.isArray(b) && (a.length === limit || k === 'data')) {
        out[k] = [...a, ...b];
      } else if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
        out[k] = mergeByLimit(a, b, limit, depth + 1);
      } else if (!(k in out)) {
        out[k] = b;
      }
    }
    return out;
  }
  return acc;
};

const fetchAllPages = async (res: Response, url: string): Promise<Response> => {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) return res;
  let first: any;
  try { first = await res.clone().json(); } catch { return res; }

  // Envelope endpoints carry a `page` block; legacy bare-array endpoints use headers.
  const pageMeta = first?.page;
  const bareArray = Array.isArray(first);
  let hasMore = pageMeta?.hasMore === true;
  let nextPage: number | undefined = pageMeta?.nextPage;
  if (bareArray) {
    hasMore = res.headers.get('x-has-more') === 'true';
    const hdr = Number(res.headers.get('x-next-page') || '');
    nextPage = Number.isFinite(hdr) && hdr > 1 ? hdr : undefined;
    if (nextPage === undefined) hasMore = false;
  }
  if (!hasMore) return res;

  const limit = pageMeta?.limit ?? 50;
  let merged: any = bareArray ? [...first] : first;
  let lastPage = pageMeta;
  const sep = url.includes('?') ? '&' : '?';
  for (let p = 2; p <= MAX_LIST_PAGES && hasMore; p++) {
    const target = `${url}${sep}page=${nextPage ?? p}`;
    const r = await originalFetch(target, { credentials: 'include' });
    if (!r.ok) break;
    let body: any;
    try { body = await r.json(); } catch { break; }
    if (bareArray && Array.isArray(body)) {
      merged = [...merged, ...body];
    } else {
      merged = mergeByLimit(merged, body, limit);
      if (body?.page) lastPage = body.page;
    }
    hasMore = bareArray
      ? r.headers.get('x-has-more') === 'true'
      : body?.page?.hasMore === true;
    nextPage = bareArray ? Number(r.headers.get('x-next-page') || '') || undefined : body?.page?.nextPage;
  }
  if (!bareArray && merged && typeof merged === 'object' && Array.isArray(merged.data) && typeof merged.count === 'number') {
    merged.count = merged.data.length;
  }
  if (!bareArray && lastPage && typeof merged === 'object') {
    merged.page = { ...lastPage, hasMore: false, nextPage: null };
  }
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  return new Response(JSON.stringify(merged), {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
};

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const isApi = url.startsWith('/api/') || url.startsWith('/uploads/');
  const isGet = !init?.method || init.method === 'GET';
  const res = await originalFetch(input, init);
  if (res.status === 401 && isApi && !url.includes('/auth/')) {
    const retryable = !(input instanceof Request) || !input.bodyUsed;
    if (retryable && (await tryRefresh())) {
      const retry = await originalFetch(input, init);
      return isGet && retry.ok ? fetchAllPages(retry, url) : retry;
    }
    return res;
  }
  if (isGet && isApi && url.includes('/api/v1/') && res.ok) {
    return fetchAllPages(res, url);
  }
  return res;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
<React.StrictMode>
<App />
</React.StrictMode>,
);
