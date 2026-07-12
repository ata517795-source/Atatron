/* OnePercent service worker: network-first HTML, cache-first hashed assets */
const CACHE = 'onepercent-v2'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/manifest.webmanifest', '/icon.svg'])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return

  // Navigations and the HTML shell must never be served stale: the JS/CSS
  // filenames are content-hashed, so a cached index.html can point at
  // assets that no longer exist after a redeploy. Always go to the network
  // first, and only fall back to cache when truly offline.
  const isNavOrHtml = e.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')
  if (isNavOrHtml) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then((c) => c.put(e.request, clone))
          }
          return res
        })
        .catch(() => caches.match(e.request).then((hit) => hit || caches.match('/'))),
    )
    return
  }

  // Hashed static assets (JS/CSS/fonts/images): cache-first is safe because
  // the filename changes whenever the content changes.
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then((c) => c.put(e.request, clone))
          }
          return res
        }),
    ),
  )
})
