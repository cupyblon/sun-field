#!/usr/bin/env node
/* Sun Field regression tests. Checks the app's own engine files against independent answers:
   PyEphem (tests/reference.json), NOAA's World Magnetic Model, NASA eclipse tables, and time-zone rules.
   Also checks that every version number in the release matches (a mismatch leaves phones on an old offline copy).

   Run from the repo folder:   node tests/run.js        (plain Node 18+, nothing to install)
   Exit code 0 = all passed, 1 = something failed. Each failure prints what was expected and what came out. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = process.env.SUNFIELD_DIR ? path.resolve(process.env.SUNFIELD_DIR) : path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');

// load the engines exactly as the browser does, into one shared scope
const ctx = {Intl, Math, Date, console, Map, Set, Object, Array, JSON, Number, String, isFinite, performance};
ctx.window = ctx; vm.createContext(ctx);
for (const f of ['sun.js', 'moon.js', 'planets.js', 'events.js', 'vendor/magvar.js']) vm.runInContext(read(f), ctx, {filename: f});
const E = s => vm.runInContext(s, ctx);
const sunPos = E('sunPos'), moonPos = E('moonPos'), planetPos = E('planetPos'), starPos = E('starPos'), dayEvents = E('dayEvents'),
  moonCrossings = E('moonCrossings'), dayBounds = E('dayBounds'), phaseTimes = E('phaseTimes'), seasonInstant = E('seasonInstant'),
  sunLonJ2000 = E('sunLonJ2000'), localToUtc = E('localToUtc'), lunarEclipses = E('lunarEclipses'), solarEclipsesLocal = E('solarEclipsesLocal'),
  magDeclination = ctx.magDeclination;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, 'reference.json'), 'utf8'));

// ---------- tiny test harness ----------
const groups = []; let cur;
function group(name, tolText){ cur = {name, tolText, n: 0, fails: [], worst: 0, unit: ''}; groups.push(cur); }
function check(label, got, want, tol, unit, scale = 1){
  cur.n++; cur.unit = unit;
  if (want === null || got === null || want === undefined || got === undefined){
    if ((want ?? null) !== (got ?? null)) cur.fails.push(`${label}: expected ${want === null ? 'none' : 'a value'}, got ${got === null || got === undefined ? 'none' : 'a value'}`);
    return;
  }
  const d = Math.abs(got - want) / scale; cur.worst = Math.max(cur.worst, d);
  if (d > tol) cur.fails.push(`${label}: expected ${want}, got ${got} (off by ${d.toFixed(3)} ${unit}, allowed ${tol})`);
}
const angDiff = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);
const checkAng = (label, got, want, tol) => check(label, want + angDiff(got, want), want, tol, '°');   // wrap-safe
const iso = ms => new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + 'Z';

// ---------- sunrise, sunset, twilight (incl. polar day/night, DST days, leap day) ----------
group('Sun rise/set and twilight vs PyEphem', '60 s (120 s above 60°N/S)');
for (const r of REF.sun_events){
  const [Y, M, D] = r.date.split('-').map(Number), ev = dayEvents(Y, M, D, r.lat, r.lon, r.tz, 'ss'), tol = Math.abs(r.lat) > 60 ? 120 : 60;
  for (const k of ['sun', 'civ', 'naut', 'astro']) for (const w of ['rise', 'set'])
    check(`${r.place} ${r.date} ${k} ${w}`, ev[k][w] == null ? null : ev[k][w] / 1000, r[k][w] == null ? null : r[k][w] / 1000, tol, 's');
}
group('Moonrise and moonset vs PyEphem', '120 s (300 s above 60°N/S)');
for (const r of REF.moon_events){
  const [Y, M, D] = r.date.split('-').map(Number), [t0, t1] = dayBounds(Y, M, D, r.tz), m = moonCrossings(t0, t1, r.lat, r.lon), tol = Math.abs(r.lat) > 60 ? 300 : 120;
  check(`${r.place} ${r.date} moonrise`, m.rise == null ? null : m.rise / 1000, r.rise == null ? null : r.rise / 1000, tol, 's');
  check(`${r.place} ${r.date} moonset`, m.set == null ? null : m.set / 1000, r.set == null ? null : r.set / 1000, tol, 's');
}

// ---------- positions ----------
group('Sun position vs PyEphem', '0.02°');
for (const r of REF.sun_pos){ const p = sunPos(r.t, r.lat, r.lon);
  checkAng(`${r.place} ${iso(r.t)} az`, p.az, r.az, 0.02); check(`${r.place} ${iso(r.t)} alt`, p.altGeo, r.alt, 0.02, '°'); }
group('Moon position, distance, phase vs PyEphem', '0.05°, 100 km, 0.5%');
for (const r of REF.moon_pos){ const p = moonPos(r.t, r.lat, r.lon), L = `${r.place} ${iso(r.t)}`;
  checkAng(`${L} az`, p.az, r.az, 0.05); check(`${L} alt`, p.altTopo, r.alt, 0.05, '°');
  check(`${L} distance`, p.dist, r.dist_km, 100, 'km'); check(`${L} lit`, p.lit, r.lit, 0.005, ''); }
group('Planets vs PyEphem', '0.1° RA/Dec, 0.15° az/alt');
for (const r of REF.planets){ const p = planetPos(r.name, r.t, r.lat, r.lon), L = `${r.name} ${r.place} ${iso(r.t)}`;
  checkAng(`${L} RA`, p.ra, r.ra, 0.1 / Math.max(0.2, Math.cos(r.dec * Math.PI / 180))); check(`${L} Dec`, p.dec, r.dec, 0.1, '°');
  checkAng(`${L} az`, p.az, r.az, r.alt > 85 ? 2 : 0.15); check(`${L} alt`, p.altGeo, r.alt, 0.15, '°'); }
group('Bright stars vs PyEphem', '0.05°');
for (const r of REF.stars){ const p = starPos(r.ra2000, r.dec2000, r.t, r.lat, r.lon), L = `${r.name} ${r.place} ${iso(r.t)}`;
  checkAng(`${L} az`, p.az, r.az, r.alt > 85 ? 1 : 0.05); check(`${L} alt`, p.altGeo, r.alt, 0.05, '°'); }

// ---------- calendar events ----------
group('Moon phases vs PyEphem', '120 s');
for (const r of REF.phases){ const deg = {new: 0, first: 90, full: 180, last: 270}[r.kind], hits = phaseTimes(deg, r.t - 2 * 86400000, r.t + 2 * 86400000);
  check(`${r.kind} moon ${iso(r.t)}`, hits.length ? hits[0] / 1000 : null, r.t / 1000, 120, 's'); }
group('Equinoxes and solstices vs PyEphem', '120 s');
for (const r of REF.seasons) check(`${r.year} ${r.deg}°`, seasonInstant(r.year, r.deg) / 1000, r.t / 1000, 120, 's');
group('Sun J2000 longitude (meteor peaks) vs PyEphem', '0.01° (about 15 minutes)');
for (const r of REF.sun_lon_j2000) checkAng(`${iso(r.t)}`, sunLonJ2000(r.t), r.lon, 0.01);

// ---------- eclipses vs NASA (Espenak, NASA GSFC eclipse tables) ----------
group('Lunar eclipses vs NASA', '3 min, umbral magnitude 0.01');
for (const [when, mag] of [['2025-03-14T06:58:43Z', 1.1784], ['2025-09-07T18:11:48Z', 1.3619], ['2026-03-03T11:33:27Z', 1.1507], ['2026-08-28T04:12:58Z', 0.9299]]){
  const t = Date.parse(when), e = lunarEclipses(t - 3 * 86400000, t + 3 * 86400000, 41.8228, -87.8517)[0];
  check(`${when} greatest eclipse`, e ? e.t / 1000 : null, t / 1000, 180, 's'); if (e) check(`${when} umbral magnitude`, e.umag, mag, 0.01, '');
}
group('Solar eclipses seen from Chicago vs NASA', '2 percentage points of the Sun covered');
for (const [day, obsc] of [['2017-08-21', 0.873], ['2024-04-08', 0.939]]){
  const t = Date.parse(day + 'T12:00Z'), e = solarEclipsesLocal(t - 86400000, t + 2 * 86400000, 41.8781, -87.6298)[0];
  check(`${day} share of Sun covered`, e ? e.obscuration : null, obsc, 0.02, '');
}

// ---------- compass offset ----------
group('Magnetic declination vs NOAA WMM2025 (pygeomag)', '0.05°');
for (const r of REF.declination){ const yr = r.year, d0 = Date.UTC(Math.floor(yr), 0, 1), d1 = Date.UTC(Math.floor(yr) + 1, 0, 1);
  check(r.place, magDeclination(r.lat, r.lon, new Date(d0 + (yr - Math.floor(yr)) * (d1 - d0))), r.decl, 0.05, '°'); }

// ---------- time zones and daylight saving ----------
group('Time zones and daylight saving', 'exact');
const hours = (Y, M, D, tz) => { const [a, b] = dayBounds(Y, M, D, tz); return (b - a) / 3600000; };
check('Chicago, DST starts Mar 14 2027: 23-hour day', hours(2027, 3, 14, 'America/Chicago'), 23, 0, 'h');
check('Chicago, DST ends Nov 7 2027: 25-hour day', hours(2027, 11, 7, 'America/Chicago'), 25, 0, 'h');
check('Chicago, normal day', hours(2027, 7, 1, 'America/Chicago'), 24, 0, 'h');
check('Sydney, DST ends Apr 4 2027: 25-hour day', hours(2027, 4, 4, 'Australia/Sydney'), 25, 0, 'h');
check('Phoenix, no DST: 24-hour day', hours(2027, 3, 14, 'America/Phoenix'), 24, 0, 'h');
check('Chicago 2:30 AM on Mar 14 2027 does not exist: rolls to 3:30 AM CDT (08:30Z)', localToUtc(2027, 3, 14, 2, 30, 'America/Chicago') / 1000, Date.parse('2027-03-14T08:30Z') / 1000, 0, 's');
check('Chicago 1:30 AM on Nov 7 2027 happens twice: first one, CDT (06:30Z)', localToUtc(2027, 11, 7, 1, 30, 'America/Chicago') / 1000, Date.parse('2027-11-07T06:30Z') / 1000, 3600, 's');
check('Leap day exists: Feb 29 2028 is a full day', hours(2028, 2, 29, 'America/Chicago'), 24, 0, 'h');

// ---------- release: every version number must match ----------
group('Release version numbers match', 'exact');
const html = read('index.html'), sw = read('sw.js'), sheets = fs.existsSync(path.join(root, 'sheets.js')) ? read('sheets.js') : '';
const tags = [...new Set([...html.matchAll(/\?v=(\d+)/g)].map(m => m[1]))];
const swV = (sw.match(/const VERSION = 'v(\d+)'/) || [])[1], swQ = (sw.match(/const V = '\?v=(\d+)'/) || [])[1];
const appV = (sheets.match(/APP_VERSION = '(\d+)'/) || [])[1];
cur.n++; if (tags.length !== 1) cur.fails.push(`index.html uses more than one ?v= number: ${tags.join(', ')}`);
for (const [label, v] of [['sw.js VERSION', swV], ['sw.js ?v=', swQ], ['sheets.js APP_VERSION', appV]]){
  cur.n++; if (v !== tags[0]) cur.fails.push(`${label} is ${v}, index.html is ${tags[0]}`); }
const swFiles = [...sw.matchAll(/'([\w./-]+\.(?:js|css))'\+V/g)].map(m => m[1]), htmlFiles = [...html.matchAll(/(?:src|href)="([\w./-]+\.(?:js|css))\?v=/g)].map(m => m[1]);
for (const f of htmlFiles){ cur.n++; if (!swFiles.includes(f)) cur.fails.push(`${f} is loaded by index.html but not saved for offline use in sw.js`); }

// ---------- report ----------
let failed = 0, total = 0;
console.log('\nSun Field regression tests\n');
for (const g of groups){
  total += g.n; failed += g.fails.length;
  const worst = g.worst ? `  worst ${g.worst < 1 ? g.worst.toFixed(3) : g.worst.toFixed(1)} ${g.unit}` : '';
  console.log(`${g.fails.length ? '✗' : '✓'} ${g.name.padEnd(48)} ${String(g.n - g.fails.length).padStart(4)}/${String(g.n).padEnd(4)} allowed ${g.tolText}${worst}`);
  for (const f of g.fails.slice(0, 8)) console.log(`     ✗ ${f}`);
  if (g.fails.length > 8) console.log(`     … and ${g.fails.length - 8} more`);
}
console.log(`\n${failed ? `${failed} of ${total} checks FAILED` : `All ${total} checks passed`}\n`);
process.exit(failed ? 1 : 0);
