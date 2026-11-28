/**
 * P6 — web push handlers, imported into the Workbox service worker via
 * workbox.importScripts (vite.config.ts). Kept framework-free: the SW has
 * no DOM and no app bundle.
 *
 * Payload contract (apps/api/src/lib/webPush.ts):
 *   { title, body, url, tag }
 */
self.addEventListener('push', (event) => {
  let data = { title: 'SiteSafi', body: '', url: '/app', tag: 'sitesafi' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Non-JSON payload — show the raw text rather than dropping the push.
    try { data.body = event.data.text(); } catch { /* keep defaults */ }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      data: { url: data.url },
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/app';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) {
            client.navigate(target).catch(() => {});
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
