/* Nandin Kitchen — Service Worker (PWA) */
const CACHE = 'nandin-v5'
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/offline.html',
  '/logo-nandin.png',
  '/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(ASSETS.map((a) => cache.add(a)))
    ).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // Jangan pernah intervensi request API database (harus selalu segar)
  if (url.origin === location.origin && url.pathname.startsWith('/api')) return

  // Navigasi halaman: network dulu, fallback cache, lalu offline page
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(async (res) => {
          try {
            const copy = res.clone()
            const c = await caches.open(CACHE)
            await c.put('/', copy)
          } catch { /* body sudah terpakai — abaikan, halaman tetap ditampilkan */ }
          return res
        })
        .catch(() =>
          caches.match('/').then((hit) => hit || caches.match('/offline.html'))
        )
    )
    return
  }

  // Aset statis (same-origin / fonts / gambar): stale-while-revalidate
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()))
            return res
          })
          .catch(() => hit)
        return hit || fetchPromise
      })
    )
  }
})
