self.addEventListener('push', function(event) {
  console.log('[SW] Push event received', event);

  let data = { title: 'ServeSync', body: 'You have a new notification' };

  try {
    if (event.data) {
      const parsed = event.data.json();
      console.log('[SW] Push data parsed:', parsed);
      data = parsed;
    }
  } catch (e) {
    console.error('[SW] Failed to parse push data:', e);
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: data.actions || [],
    tag: data.tag || data.data?.notification_id || `${data.title || 'ServeSync'}-${Date.now()}`,
    renotify: true,
    requireInteraction: false,
  };

  console.log('[SW] Showing notification:', data.title, options);

  event.waitUntil(
    (async () => {
      const notificationType = data.data?.notification_type;
      if (notificationType === 'message') {
        const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        const hasVisibleApp = windowClients.some(client => client.visibilityState === 'visible' || client.focused);

        if (hasVisibleApp) {
          console.log('[SW] Suppressed chat system notification because app is visible');
          return;
        }
      }

      await self.registration.showNotification(data.title || 'ServeSync', options);
      console.log('[SW] Notification shown successfully');
    })().catch(err => console.error('[SW] Failed to handle push notification:', err))
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});

self.addEventListener('fetch', function(event) {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(function() {
        return caches.match('/index.html') || fetch('/index.html');
      })
    );
  }
});

self.addEventListener('install', function() {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});
