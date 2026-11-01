/* Sun Field offline support. Keeps a copy of the app on the phone so it opens with no signal.
   - The page itself: try the network first (so updates show up), fall back to the saved copy after 4 s or offline.
   - App files (versioned with ?v=N): served from the saved copy; a new version number means new files.
   - Map tiles: saved as you view them (up to 400), so the area you use most works offline too.
   Bump VERSION (and the ?v=N tags in index.html) on every release. */
const VERSION = 'v12';
const SCOPE = self.registration.scope;                 // each install location keeps its own copy (e.g. a test page)
const APP_CACHE = `sf-app-${VERSION}-${SCOPE}`, TILE_CACHE = 'sf-tiles', MAX_TILES = 400;
const V = '?v=12';
const FILES = ['./', 'index.html', 'style.css'+V, 'vendor/leaflet.css'+V, 'vendor/leaflet.js'+V,
  'sun.js'+V, 'moon.js'+V, 'planets.js'+V, 'events.js'+V, 'dome.js'+V, 'motion.js'+V, 'ar.js'+V, 'app.js'+V, 'infopages.js'+V,
  '../manifest.webmanifest', '../icon-180.png', '../icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP_CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(k => k.startsWith('sf-app-') && k.endsWith(SCOPE) && k !== APP_CACHE)   // only this scope's old versions
    .map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const timeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
async function page(req){
  const cache = await caches.open(APP_CACHE);
  try { const res = await timeout(fetch(req), 4000); if (res.ok) cache.put('index.html', res.clone()); return res; }
  catch(e){ return (await cache.match('index.html')) || (await cache.match('./')) || Response.error(); }
}
async function appFile(req){
  const hit = await caches.match(req); if (hit) return hit;
  const res = await fetch(req);
  if (res.ok){ const cache = await caches.open(APP_CACHE); cache.put(req, res.clone()); }
  return res;
}
async function tile(req){
  const cache = await caches.open(TILE_CACHE);
  try {
    const res = await timeout(fetch(req), 5000);
    if (res.ok || res.type === 'opaque'){ await cache.put(req, res.clone());
      const keys = await cache.keys(); for (let i = 0; i < keys.length - MAX_TILES; i++) await cache.delete(keys[i]); }
    return res;
  } catch(e){ return (await cache.match(req)) || Response.error(); }
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' && url.origin === location.origin) e.respondWith(page(req));
  else if (url.hostname === 'tile.openstreetmap.org') e.respondWith(tile(req));
  else if (url.origin === location.origin) e.respondWith(appFile(req));
});
