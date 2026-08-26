const CACHE_NAME = 'leela-admin-pwa-v2'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )

  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Only handle requests belonging to this website.
  if (url.origin !== self.location.origin) return

  // Network-first: keep the admin dashboard fresh.
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  )
})
