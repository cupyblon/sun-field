#!/usr/bin/env node
/* Offline and update check, in a real (headless) browser. Copies the app to a temp folder, serves it, then:
   1 open online (installs the offline copy)  2 reopen offline: must load
   3 publish a new version (bumps every version number in the copy)  4 reopen online: must show the new version
   5 reopen offline: must still load, now the new version  6 open the Map tab offline: map library and sun lines.
   Not covered here: saved map tiles (needs the real tile server) and real phone sensors (see tests/motion-check.js).
   Needs Playwright:  npm i -D playwright && npx playwright install chromium     then   node tests/offline-check.js
   (Set PW_CHROMIUM=/path/to/chromium to use a browser you already have.) */
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const { chromium } = require('playwright');
const src = path.join(__dirname, '..'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sunfield-'));
fs.cpSync(src, dir, {recursive: true, filter: f => !/[\\/](\.git|node_modules|tests)([\\/]|$)/.test(f.slice(src.length))});
const TYPES = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.webmanifest':'application/manifest+json'};
const server = http.createServer((req, res) => {
  const p = path.join(dir, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(p, (err, data) => { if (err){ res.writeHead(404); res.end(); return; } res.writeHead(200, {'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-cache'}); res.end(data); });
}).listen(0);
const url = `http://localhost:${server.address().port}/`;

function bump(){                       // what a release does: every version number goes up by one
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), v = +html.match(/\?v=(\d+)/)[1], n = v + 1;
  const sub = (f, pairs) => { let s = fs.readFileSync(path.join(dir, f), 'utf8'); for (const [a, b] of pairs) s = s.split(a).join(b); fs.writeFileSync(path.join(dir, f), s); };
  sub('index.html', [[`?v=${v}`, `?v=${n}`]]);
  sub('sw.js', [[`'v${v}'`, `'v${n}'`], [`'?v=${v}'`, `'?v=${n}'`]]);
  sub('sheets.js', [[`APP_VERSION = '${v}'`, `APP_VERSION = '${n}'`]]);
  return [v, n];
}
(async () => {
  const results = []; let ok = true;
  const step = (name, pass, info) => { ok = ok && pass; results.push(`${pass ? '✓' : '✗'} ${name}${info ? ' · ' + info : ''}`); };
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? {executablePath: process.env.PW_CHROMIUM} : {});
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx.route('**/tile.openstreetmap.org/**', r => r.abort());
  const page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  const version = () => page.evaluate(() => (document.getElementById('appVersion') || {}).textContent || '?');
  const loaded = () => page.evaluate(() => /\d/.test((document.getElementById('sRise') || {}).textContent || ''));
  try {
    await page.goto(url); await page.evaluate(() => navigator.serviceWorker.ready); await page.reload(); await page.waitForTimeout(800);
    const v1 = await version();
    step('1 Open online, offline copy installed', await page.evaluate(() => !!navigator.serviceWorker.controller), `version ${v1}`);
    await ctx.setOffline(true); await page.reload(); await page.waitForTimeout(1200);
    step('2 Reopen offline', await loaded(), `version ${await version()}`);
    await ctx.setOffline(false);
    const [, n] = bump();
    await page.reload(); await page.waitForTimeout(1500);
    step('3+4 New version published, reopen online', (await version()) === String(n) && await loaded(), `now version ${await version()} (expected ${n})`);
    await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForTimeout(800);
    await ctx.setOffline(true); await page.reload(); await page.waitForTimeout(1200);
    step('5 Reopen offline after the update', (await version()) === String(n) && await loaded(), `version ${await version()}`);
    // the Map tab with no network: the map library must start from the saved copy and the sun lines must draw
    await page.evaluate(() => show('map')); await page.waitForTimeout(1500);
    const mapOk = await page.evaluate(() => typeof L !== 'undefined' && !!document.querySelector('#map .leaflet-container, #map.leaflet-container') && document.querySelectorAll('#map path').length > 5);
    step('6 Open the Map tab offline', mapOk, await page.evaluate(() => `map library ${typeof L !== 'undefined' ? L.version : 'missing'}, ${document.querySelectorAll('#map path').length} lines drawn`));
    // the new copy finishes saving in the background, then the old one is deleted: allow it up to 6 s
    let caches_ = [];
    for (let k = 0; k < 12; k++){ caches_ = await page.evaluate(async () => (await caches.keys()).filter(k => k.startsWith('sf-app'))); if (caches_.length === 1) break; await page.waitForTimeout(500); }
    step('Old offline copy cleaned up', caches_.length === 1, caches_.join(', '));
    step('No page errors', errors.length === 0, errors.join(' | '));
  } catch (e){ step('Check ran', false, e.message); }
  console.log('\nSun Field offline and update check\n\n' + results.join('\n') + `\n\n${ok ? 'All steps passed' : 'FAILED'}\n`);
  await browser.close(); server.close(); fs.rmSync(dir, {recursive: true, force: true}); process.exit(ok ? 0 : 1);
})();
