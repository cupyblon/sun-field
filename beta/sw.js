/* Sun Field offline support. Keeps a copy of the app on the phone so it opens with no signal.
   - The page itself: try the network first (so updates show up), fall back to the saved copy after 4 s or offline.
   - App files (versioned with ?v=N): served from the saved copy; a new version number means new files.
   - Map tiles: a saved tile shows at once and is refreshed quietly in the background; new tiles are saved as you
     view them (up to 400, oldest dropped first), so the area you use most works offline too.
   Bump VERSION (and the ?v=N tags in index.html) on every release. */
const VERSION = 'v25';
const SCOPE = self.registration.scope;                 // each install location keeps its own copy (e.g. a test page)
const APP_CACHE = `sf-app-${VERSION}-${SCOPE}`, TILE_CACHE = 'sf-tiles', MAX_TILES = 400;
const V = '?v=25';
const FILES = ['./', 'index.html', 'style.css'+V, 'vendor/leaflet.css'+V, 'vendor/leaflet.js'+V,
  'sun.js'+V, 'moon.js'+V, 'planets.js'+V, 'events.js'+V, 'dome.js'+V, 'motion.js'+V, 'ar.js'+V, 'app.js'+V, 'infopages.js'+V, 'vendor/magvar.js'+V, 'sheets.js'+V, 'tour.js'+V,
  '../manifest.webmanifest', '../icon-180.png', '../icon-512.png', 'img/qr-lightning.svg', 'img/qr-bitcoin.svg'];

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
// Keep the tile store at MAX_TILES: one trim at a time, a few seconds after tiles stop arriving.
// Tiles saved while a trim runs set `again`, so a final pass always follows a burst.
let trimming = null, again = false;
function trimTiles(){
  if (trimming){ again = true; return trimming; }
  trimming = (async () => {
    do {
      again = false;
      await new Promise(r => setTimeout(r, 3000));
      const cache = await caches.open(TILE_CACHE), keys = await cache.keys();
      for (let i = 0; i < keys.length - MAX_TILES; i++) await cache.delete(keys[i]);
    } while (again);
  })().finally(() => { trimming = null; });
  return trimming;
}
async function tile(e, req){
  const cache = await caches.open(TILE_CACHE);
  // fetch and save the tile; this is registered with waitUntil straight away (hit or miss), so the save and the
  // trim finish even if the response below was already given up on after 8 s
  const fresh = fetch(req).then(async res => {
    if (res.ok || res.type === 'opaque'){ await cache.put(req, res.clone()); await trimTiles(); }
    return res;
  });
  e.waitUntil(fresh.then(() => {}, () => {}));
  const hit = await cache.match(req);
  if (hit) return hit;                                                   // saved tile now, refreshed in the background
  try { return await timeout(fresh, 8000); } catch(err){ return Response.error(); }
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' && url.origin === location.origin) e.respondWith(page(req));
  else if (url.hostname === 'tile.openstreetmap.org') e.respondWith(tile(e, req));
  else if (url.origin === location.origin) e.respondWith(appFile(req));
});
