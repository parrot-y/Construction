import { api, apiErrorMessage } from './api';

/**
 * P6 — web push subscribe/unsubscribe.
 *
 * The service worker only exists in production builds (main.tsx registers
 * /sw.js under import.meta.env.PROD), so every entry point degrades to a
 * clean 'unsupported' state in dev/e2e — callers render nothing or a
 * disabled hint, never an error.
 */

export type PushState = 'unsupported' | 'unconfigured' | 'denied' | 'on' | 'off';

export function pushSupported(): boolean {
  return (
    import.meta.env.PROD &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Current push state for this browser profile. */
export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const vapid = await api.get<{ data?: { publicKey?: string | null } }>('/api/v1/push/vapid-key').catch(() => null);
  if (!vapid?.data?.publicKey) return 'unconfigured';
  const reg = await navigator.serviceWorker.getRegistration().catch(() => null);
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  return sub ? 'on' : 'off';
}

/** Request permission, subscribe, and register with the API. */
export async function enablePush(): Promise<PushState> {
  const state = await pushState();
  if (state === 'unsupported' || state === 'unconfigured' || state === 'denied') return state;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  const vapid = await api.get<{ data?: { publicKey?: string | null } }>('/api/v1/push/vapid-key');
  const publicKey = vapid?.data?.publicKey;
  if (!publicKey) return 'unconfigured';

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  });
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Browser returned an incomplete push subscription.');
  }
  const created = await api.post<{ data?: { id?: string } }>('/api/v1/push-subscriptions', {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
  // Remember the row id so unsubscribe can delete exactly this device —
  // the endpoint itself is never returned by the list endpoint.
  const id = created?.data?.id;
  if (id) localStorage.setItem('sitesafi:push-sub-id', id);
  return 'on';
}

/** Unsubscribe locally and remove the server-side record. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration().catch(() => null);
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  if (!sub) return;
  const id = localStorage.getItem('sitesafi:push-sub-id');
  try {
    if (id) await api.delete(`/api/v1/push-subscriptions/${id}`).catch(() => null);
    await sub.unsubscribe();
    localStorage.removeItem('sitesafi:push-sub-id');
  } catch (err) {
    throw new Error(apiErrorMessage(err, 'Could not disable notifications.'));
  }
}
