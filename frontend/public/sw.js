const VERSION = 'eduverse-v2.0.1';
const STATIC_CACHE = `${VERSION}:static`;
const RUNTIME_CACHE = `${VERSION}:runtime`;
const IMAGE_CACHE = `${VERSION}:images`;

const APP_SHELL = [
  '/',
  '/offline',
  '/manifest.json',
  '/assets/eduverse-icon.png',
  '/assets/eduverse-logo.png',
  '/assets/chat-doodle.svg',
  '/assets/shortcut-timetable.svg',
  '/assets/shortcut-chats.svg',
  '/assets/shortcut-mail.svg',
];

const MAX_IMAGE_ENTRIES = 80;

const isHttpRequest = (request) => request.url.startsWith('http');
const isSameOrigin = (url) => url.origin === self.location.origin;
const isNextAsset = (url) => url.pathname.startsWith('/_next/');
const isStaticAsset = (request, url) =>
  request.destination === 'style' ||
  request.destination === 'script' ||
  request.destination === 'font' ||
  isNextAsset(url);
const isImageAsset = (request) => request.destination === 'image';

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
    if (maxEntries) trimCache(cacheName, maxEntries);
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then((response) => {
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });

  return cached || networkPromise;
}

async function handleNavigation(event) {
  try {
    const preload = await event.preloadResponse;
    if (preload) return preload;

    return await fetch(event.request);
  } catch {
    return (await caches.match('/offline')) || caches.match('/');
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((cacheName) => !cacheName.startsWith(VERSION))
        .map((cacheName) => caches.delete(cacheName))
    );

    if ('navigationPreload' in self.registration) {
      await self.registration.navigationPreload.enable();
    }

    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!isHttpRequest(request)) return;

  const url = new URL(request.url);
  if (!isSameOrigin(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (url.pathname.startsWith('/api/') || request.headers.has('authorization')) {
    return;
  }

  if (isStaticAsset(request, url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (isImageAsset(request)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, MAX_IMAGE_ENTRIES));
    return;
  }

  if (request.method === 'GET') {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  const fallbackData = {
    title: 'EduVerse Notification',
    body: 'You have a new update.',
    url: '/',
  };

  const showPushNotification = async () => {
    let data = fallbackData;

    if (event.data) {
      try {
        data = event.data.json();
      } catch {
        data = { ...fallbackData, body: event.data.text() || fallbackData.body };
      }
    }

    const title = data.title || 'EduVerse Notification';
    const options = {
      body: data.body || '',
      icon: '/assets/eduverse-icon.png',
      badge: '/assets/eduverse-icon.png',
      tag: data.tag || data.url || 'eduverse-notification',
      renotify: false,
      data: {
        url: data.url || '/',
      },
    };

    await self.registration.showNotification(title, options);
  };

  event.waitUntil(showPushNotification());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
