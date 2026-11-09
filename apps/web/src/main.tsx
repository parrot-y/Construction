import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

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

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const isApi = url.startsWith('/api/') || url.startsWith('/uploads/');
  const res = await originalFetch(input, init);
  if (res.status !== 401 || !isApi || url.includes('/auth/')) return res;
  const retryable = !(input instanceof Request) || !input.bodyUsed;
  if (retryable && (await tryRefresh())) {
    return originalFetch(input, init);
}
  return res;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
<React.StrictMode>
<App />
</React.StrictMode>,
);
