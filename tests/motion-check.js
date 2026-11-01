#!/usr/bin/env node
/* iPhone compass check, in a headless browser with simulated iPhone sensor readings.
   Scenario from the Nov 1 2026 second review: north is learned while the phone is upright, the sensors pause (Freeze),
   the compass offset (declination) changes, and Live resumes while the phone is held TILTED (no fresh upright reading).
   The heading must use the new offset at once.
   Needs Playwright (see tests/offline-check.js).  Usage: node tests/motion-check.js [url]   (default: serves the repo) */
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(p, (err, data) => { if (err){ res.writeHead(404); res.end(); return; }
    res.writeHead(200, {'Content-Type': {'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(p)] || 'application/octet-stream'}); res.end(data); });
}).listen(0);
const url = process.argv[2] || `http://localhost:${server.address().port}/`;
(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? {executablePath: process.env.PW_CHROMIUM} : {});
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true});
  await ctx.addInitScript(() => { DeviceOrientationEvent.requestPermission = () => Promise.resolve('granted'); });
  const page = await ctx.newPage(); await page.goto(url); await page.waitForTimeout(800);
  // an iPhone reading: alpha is the gyro's arbitrary zero (here 40° off), H the magnetic compass heading of the top edge
  const feed = (alpha, beta, H) => page.evaluate(([a, b, H]) => {
    const e = new Event('ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation');
    for (const [k, v] of Object.entries({alpha: a, beta: b, gamma: 0, webkitCompassHeading: H, webkitCompassAccuracy: 5})) Object.defineProperty(e, k, {value: v});
    window.dispatchEvent(e); }, [alpha, beta, H]);
  const setDecl = d => page.evaluate(d => { S.decl = d; }, d);
  const heading = () => page.evaluate(() => { const f = motion.facing(); return f && f.heading; });
  const GYRO0 = 40, magAz = 200;                         // the phone faces magnetic 200°
  const alphaFor = az => (360 - az + GYRO0) % 360;       // gyro alpha that corresponds to facing `az` (alpha runs counter-clockwise)
  await page.evaluate(() => show('dome')); await page.click('#domeLive');
  await setDecl(-4.0);
  for (let i = 0; i < 120; i++) await feed(alphaFor(magAz), 90, magAz);         // upright: learns north
  const h1 = await heading();
  await page.click('#domeLive');                                                  // Freeze: sensors pause
  await setDecl(14.9);                                                            // e.g. moved Brookfield -> Seattle
  await page.click('#domeLive');                                                  // Live again
  for (let i = 0; i < 20; i++) await feed(alphaFor(magAz), 30, magAz);           // TILTED: no fresh upright reading
  const h2 = await heading();
  const off = (got, want) => Math.abs(((got - want) % 360 + 540) % 360 - 180);
  const ok1 = off(h1, magAz - 4.0) < 1.5, ok2 = off(h2, magAz + 14.9) < 1.5;
  console.log(`\nSun Field iPhone compass check\n\n${ok1 ? '✓' : '✗'} Upright, offset -4.0°: heading ${h1.toFixed(1)}° (expected ${(magAz - 4).toFixed(1)}°)` +
              `\n${ok2 ? '✓' : '✗'} After pause, offset changed to +14.9°, resumed tilted: heading ${h2.toFixed(1)}° (expected ${(magAz + 14.9).toFixed(1)}°)` +
              `\n\n${ok1 && ok2 ? 'All steps passed' : 'FAILED'}\n`);
  await browser.close(); server.close(); process.exit(ok1 && ok2 ? 0 : 1);
})();
