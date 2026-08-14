const serviceWorkerVersion = new URL(self.location.href).searchParams.get('v') || 'unversioned';
const appShellCacheName = `servesync-app-shell-${serviceWorkerVersion}`;
const appAssetCacheName = `servesync-assets-${serviceWorkerVersion}`;

function askClientVisibility(client) {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timeout = setTimeout(() => resolve(false), 350);

    channel.port1.onmessage = event => {
      clearTimeout(timeout);
      const payload = event.data || {};
      resolve({ visible: Boolean(payload.visible), path: payload.path || '' });
    };

    try {
      client.postMessage({ type: 'servesync:visibility-check', requestId }, [channel.port2]);
    } catch {
      clearTimeout(timeout);
      resolve(false);
    }
  });
}

async function hasVisibleAppClient() {
  const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (windowClients.some(client => client.visibilityState === 'visible' || client.focused)) {
    return true;
  }

  const replies = await Promise.all(windowClients.map(client => askClientVisibility(client)));
  return replies.some(reply => {
    if (typeof reply === 'boolean') return reply;
    if (!reply || typeof reply !== 'object') return false;
    return Boolean(reply.visible);
  });
}

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
        if (await hasVisibleAppClient()) {
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
      (async function() {
        const cache = await caches.open(appShellCacheName);
        try {
          const response = await fetch(event.request);
          if (response.ok && response.type === 'basic') {
            await cache.put('/index.html', response.clone());
          }
          return response;
        } catch {
          return (await cache.match('/index.html')) || Response.error();
        }
      })()
    );
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (event.request.method === 'GET' && requestUrl.origin === self.location.origin) {
    event.respondWith((async function() {
      const cache = await caches.open(appAssetCacheName);
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    })());
  }
});

self.addEventListener('install', function(event) {
  // Wait for explicit approval from the client before activating over an existing app shell.
  event.waitUntil(
    caches.open(appShellCacheName)
      .then(cache => cache.add('/index.html'))
      .catch(error => console.warn('[SW] Could not precache navigation shell:', error))
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys => Promise.all(
        keys
          .filter(key => (key.startsWith('servesync-app-shell-') && key !== appShellCacheName) || (key.startsWith('servesync-assets-') && key !== appAssetCacheName))
          .map(key => caches.delete(key))
      )),
    ])
  );
});

self.addEventListener('message', function(event) {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
