// GB CarSys service worker — app shell offline + cached API reads
const VERSION = 'gbcars-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'assets/css/app.css',
  'assets/js/app.js', 'assets/js/core.js',
  'assets/js/views/dashboard.js', 'assets/js/views/calendar.js', 'assets/js/views/booking.js',
  'assets/js/views/crud.js', 'assets/js/views/reports.js', 'assets/js/views/profile.js',
  'assets/icons/icon.svg', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png',
];
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE = `${VERSION}-data`;
const FILE_CACHE = `${VERSION}-files`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: stale-while-revalidate
  if (url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com')) {
    e.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
    return;
  }
  if (url.origin !== location.origin) return;

  if (url.pathname.includes('/api/')) {
    // never cache the session endpoint or CSV downloads
    if (/\/api\/index\.php\/(session|report\/[^/]+\/csv)/.test(url.pathname)) return;
    // uploaded images/files: cache-first
    if (url.pathname.includes('/api/index.php/file/')) { e.respondWith(cacheFirst(req, FILE_CACHE)); return; }
    // other API reads: network-first, fall back to last copy when offline
    e.respondWith(networkFirst(req, DATA_CACHE));
    return;
  }
  // app shell: network-first for HTML so updates appear, cache-first for assets
  if (req.mode === 'navigate') { e.respondWith(networkFirst(req, SHELL_CACHE, 'index.html')); return; }
  e.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
});

async function networkFirst(req, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req) || (fallbackUrl && await cache.match(fallbackUrl));
    if (hit) return hit;
    return new Response(JSON.stringify({ error: 'ออฟไลน์ — ยังไม่มีข้อมูลนี้ในเครื่อง' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
}

// clear cached API data on logout (sent by the page)
self.addEventListener('message', (e) => {
  if (e.data === 'clear-data') { caches.delete(DATA_CACHE); caches.delete(FILE_CACHE); }
});
