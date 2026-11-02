#!/usr/bin/env node
/* First-visit welcome and guided tour, in a headless phone-sized browser, online and then with no network.
   Checks: welcome shows for a new visitor → closing it starts the tour → all 7 steps land on the right screen with the
   card fully on screen → the app behind is inert while the tour runs → Done ends on Times with focus on the Times tab →
   the tour doesn't repeat after a reload → replay from How to use, Escape skips and focus returns to ⓘ → the whole
   first-visit flow again with the network off. Also: after using the camera, a replayed tour leaves it off.
   Needs Playwright (see tests/offline-check.js).  Usage: node tests/tour-check.js [url]   (default: serves the repo) */
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const TYPES = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.webmanifest':'application/manifest+json'};
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(p, (err, data) => { if (err){ res.writeHead(404); res.end(); return; } res.writeHead(200, {'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream'}); res.end(data); });
}).listen(0);
const url = process.argv[2] || `http://localhost:${server.address().port}/`;
const EXPECT = [['Home: Times','times'], ['Pick a time','times'], ['Info pages','times'], ['Dome','dome'], ['Camera','ar'], ['Map','map'], ['Help, any time','times']];

(async () => {
  const results = []; let ok = true;
  const step = (name, pass, info) => { ok = ok && pass; results.push(`${pass ? '✓' : '✗'} ${name}${info ? ' · ' + info : ''}`); };
  const browser = await chromium.launch({...(process.env.PW_CHROMIUM ? {executablePath: process.env.PW_CHROMIUM} : {}),
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']});               // a fake camera for the Camera tab
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true, permissions: ['camera']});
  await ctx.addInitScript(() => { if (window.DeviceOrientationEvent) DeviceOrientationEvent.requestPermission = () => Promise.resolve('granted'); });
  await ctx.route('**/tile.openstreetmap.org/**', r => r.abort());
  const page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));

  async function firstVisit(label){
    await page.waitForTimeout(1300);
    step(`${label}: welcome shows for a new visitor`, await page.isVisible('#welcome'));
    await page.click('#welcomeSkip'); await page.click('#aboutClose'); await page.waitForTimeout(700);
    step(`${label}: closing it starts the tour`, await page.isVisible('.tour-card'));
    let all = true, notes = [];
    for (let k = 0; k < EXPECT.length; k++){
      await page.waitForTimeout(650);
      const s = await page.evaluate(() => { const c = document.querySelector('.tour-card').getBoundingClientRect();
        return {title: document.getElementById('tourTitle').textContent, view: S.view, inert: document.querySelector('.app').inert,
                onScreen: c.top >= 0 && c.left >= 0 && c.bottom <= innerHeight && c.right <= innerWidth}; });
      const good = s.title === EXPECT[k][0] && s.view === EXPECT[k][1] && s.onScreen && s.inert;
      if (!good){ all = false; notes.push(`step ${k+1}: ${JSON.stringify(s)}`); }
      await page.click('#tourNext');
    }
    step(`${label}: all 7 steps on the right screen, card on screen, app behind inert`, all, notes.join(' | '));
    await page.waitForTimeout(400);
    const end = await page.evaluate(() => ({hidden: document.querySelector('.tour').hidden, view: S.view, inert: document.querySelector('.app').inert,
                                            focus: document.activeElement.dataset.view || document.activeElement.id}));
    step(`${label}: Done ends on Times, app usable, focus on the Times tab`, end.hidden && end.view === 'times' && !end.inert && end.focus === 'times', JSON.stringify(end));
  }

  try {
    // ---- online ----
    await page.goto(url);
    await firstVisit('Online');
    await page.reload(); await page.waitForTimeout(1300);
    step('Reload: no welcome, no tour', !(await page.isVisible('#aboutSheet')) && !(await page.isVisible('.tour-card')));
    await page.click('#aboutBtn'); await page.click('.about-tabs button[data-at=howto]'); await page.click('#tourAgain'); await page.waitForTimeout(700);
    step('Take the tour replays it', await page.isVisible('.tour-card') && (await page.textContent('#tourCount')) === '1 of 7');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    const esc = await page.evaluate(() => ({hidden: document.querySelector('.tour').hidden, inert: document.querySelector('.app').inert, focus: document.activeElement.id}));
    step('Escape skips; focus back on ⓘ after a replay', esc.hidden && !esc.inert && esc.focus === 'aboutBtn', JSON.stringify(esc));
    await page.click('#aboutBtn'); await page.click('.about-tabs button[data-at=howto]'); await page.click('#tourAgain'); await page.waitForTimeout(700);
    await page.click('#tourSkip'); await page.waitForTimeout(300);
    step('Skip tour ends it', await page.evaluate(() => document.querySelector('.tour').hidden && !document.querySelector('.app').inert));
    // camera used earlier, then the tour replayed: the Camera step must not turn the camera back on
    await page.evaluate(() => show('ar')); await page.click('#arGo'); await page.waitForTimeout(800);
    const camOn = await page.evaluate(() => !!document.getElementById('arVideo').srcObject);
    await page.evaluate(() => show('times')); await page.waitForTimeout(200);
    await page.click('#aboutBtn'); await page.click('.about-tabs button[data-at=howto]'); await page.click('#tourAgain'); await page.waitForTimeout(700);
    for (let k = 0; k < 4; k++){ await page.click('#tourNext'); await page.waitForTimeout(500); }   // to step 5, Camera
    const atCam = await page.evaluate(() => ({title: document.getElementById('tourTitle').textContent, camera: !!document.getElementById('arVideo').srcObject, startScreen: !document.getElementById('arStart').hidden}));
    step('Tour replay after using the camera: Camera step leaves the camera off', camOn && atCam.title === 'Camera' && !atCam.camera && atCam.startScreen, `camera was on before: ${camOn}; at step: ${JSON.stringify(atCam)}`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    await page.evaluate(() => show('ar')); await page.waitForTimeout(800);
    step('After the tour, the Camera tab turns the camera back on as normal', await page.evaluate(() => !!document.getElementById('arVideo').srcObject && document.getElementById('arStart').hidden));
    await page.evaluate(() => show('times'));
    // ---- offline: same first visit, from the saved copy ----
    await page.evaluate(() => navigator.serviceWorker.ready); await page.reload(); await page.waitForTimeout(800);
    await page.evaluate(() => { for (const k of ['seenVersion', 'welcomed', 'toured']) localStorage.removeItem('sf-' + k); });
    await ctx.setOffline(true); await page.reload();
    await firstVisit('Offline');
    await ctx.setOffline(false);
    step('No page errors', errors.length === 0, errors.join(' | '));
  } catch (e){ step('Check ran', false, e.message); }
  console.log('\nSun Field welcome and tour check\n\n' + results.join('\n') + `\n\n${ok ? 'All steps passed' : 'FAILED'}\n`);
  await browser.close(); server.close(); process.exit(ok ? 0 : 1);
})();
