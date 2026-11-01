/* Calibrate and About sheets, and the "updated" notice. Load after app.js (uses S, store, toast, show, setLocation,
   motion, NO_SENSORS, $) and vendor/magvar.js (magDeclination).
   Calibrate: Quick calibrate runs everything it can by itself and shows a checklist:
     Location (GPS fix) · North correction (NOAA World Magnetic Model) · Compass steady (figure-8 meter) · Sky lock (Camera › Align).
   The individual steps stay available under "Details". */
(function(){
  const APP_VERSION = '20';

  // ---------- sheets: open/close, focus kept inside while open, back to the button that opened it ----------
  let opener = null;
  const visible = x => { const d = x.closest('details:not([open])'); if (d && x.tagName !== 'SUMMARY') return false;   // inside a closed Details
    return x.checkVisibility ? x.checkVisibility() : x.getClientRects().length > 0; };
  const focusables = el => [...el.querySelectorAll('button, [href], input, select, summary, [tabindex]:not([tabindex="-1"])')].filter(x => !x.hidden && !x.disabled && visible(x));
  function openSheet(id){
    opener = document.activeElement; $(id).hidden = false; document.body.classList.add('sheet-open');
    const f = focusables($(id)); if (f.length) f[0].focus();
  }
  function closeSheet(id){
    if ($(id).hidden) return; $(id).hidden = true; document.body.classList.remove('sheet-open');
    if (opener && opener.focus) opener.focus(); opener = null;
  }
  for (const id of ['calSheet','aboutSheet']){
    $(id).addEventListener('click', e => { if (e.target.id === id) closeSheet(id); });        // tap outside closes
    $(id).addEventListener('keydown', e => {                                                  // Tab stays inside the sheet
      if (e.key !== 'Tab') return; const f = focusables($(id)); if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]){ e.preventDefault(); f[f.length-1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length-1]){ e.preventDefault(); f[0].focus(); }
    });
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape'){ closeSheet('calSheet'); closeSheet('aboutSheet'); } });

  // ---------- declination: automatic from NOAA's model unless you typed your own ----------
  const haveWMM = typeof magDeclination === 'function';
  const noaaDecl = () => haveWMM ? Math.round(magDeclination(S.lat, S.lon, new Date())*10)/10 : null;
  function applyDecl(quiet){
    const d = noaaDecl(); if (d == null) return null;
    S.decl = d; store.set('decl', d); store.set('declAuto', true); $('decl').value = d;
    if (!quiet) toast(`Compass offset set to ${d}° (${d < 0 ? 'west' : 'east'}) from NOAA`);
    return d;
  }
  if (haveWMM && store.get('declAuto', true)) applyDecl(true);
  $('decl').addEventListener('change', () => store.set('declAuto', false));          // typed by hand: leave it alone
  const baseSetLocation = setLocation;                                               // a new spot gets its own offset
  setLocation = function(){ baseSetLocation.apply(this, arguments); if (store.get('declAuto', true)) applyDecl(true); if (!$('calSheet').hidden) fillCal(); };

  // ---------- checklist ----------
  const row = (id, state, text) => { $(id).dataset.state = state; $(id + 'Txt').textContent = text; };
  const isGps = () => /^GPS fix|^Your location/.test(S.place);
  const declIsNoaa = () => { const d = noaaDecl(); return d != null && store.get('declAuto', true) && Math.abs(d - S.decl) < 0.05; };
  let compassOn = false, still0 = null, steady = false, raf = null;
  function fillChecklist(){
    row('ckLoc', isGps() ? 'ok' : 'todo', isGps() ? `${S.place} · ${S.lat.toFixed(4)}, ${S.lon.toFixed(4)}` : `Saved spot: ${S.place}`);
    row('ckNorth', declIsNoaa() ? 'ok' : 'todo', declIsNoaa() ? `${(+S.decl).toFixed(1).replace("-","−")}° applied (${S.decl < 0 ? 'west' : 'east'}), from NOAA for this spot` : `Set to ${S.decl}° by hand`);
    if (!compassOn) row('ckCompass', 'todo', 'Not checked yet');
    const c = motion.cal, locked = !!(c.dAz || c.dAlt);
    row('ckSky', locked ? 'ok' : 'todo', locked ? `Locked on ${c.on || 'the sky'}${c.at ? `, ${c.at}` : ''} (${c.dAz>=0?'+':''}${c.dAz.toFixed(1)}°). Camera and Dome use it.` : 'Last step: in the Camera, put the crosshair on the sun (or the moon or a bright planet at night) and tap Align.');
  }
  function fillCal(){
    fillChecklist();
    $('calGpsTxt').textContent = `Using: ${S.place} (${S.lat.toFixed(4)}, ${S.lon.toFixed(4)})`;
    const d = noaaDecl();
    $('calDeclTxt').textContent = `Set to ${S.decl}°` + (d == null ? '' : declIsNoaa() ? ' · from NOAA for this spot' : ` · NOAA says ${d}° here`);
    const c = motion.cal;
    $('calLockTxt').innerHTML = (c.dAz || c.dAlt)
      ? `Correction <b>${c.dAz>=0?'+':''}${c.dAz.toFixed(1)}°</b>${c.on ? ` · locked on ${c.on}${c.at ? `, ${c.at}` : ''}` : ''}. Used by the Camera and the live Dome.`
      : 'No correction yet. In the Camera, put the crosshair on the sun (or the moon or a bright planet at night) and tap Align.';
  }
  // live compass readout, shared by the checklist row and the Details step
  function meter(){
    if ($('calSheet').hidden){ raf = null; return; }
    if (compassOn){
      const st = motion.stat, moved = Math.min(1, st.moved/900), sp = motion.spread();
      let msg, state = 'busy';
      if (st.events === 0) msg = 'No readings yet. ' + sensorHelp();
      else if (moved < 1) msg = `Move the phone in a figure 8, twisting it through every angle (${Math.round(moved*100)}%)`;
      else if (sp == null || sp > 3){ still0 = null; msg = 'Good. Now hold the phone still…'; }
      else { if (!still0) still0 = performance.now(); if (performance.now() - still0 > 1200) steady = true; msg = steady ? 'Steady ✓' : 'Hold still…'; }
      if (steady) state = 'ok';
      if (st.accuracy != null){
        msg += ` · phone says ±${Math.round(st.accuracy)}°` + (st.accuracy <= 10 ? ' (good)' : st.accuracy <= 25 ? ' (fair)' : ' (poor: keep moving, away from metal)');
        if (steady && st.accuracy > 25) state = 'warn';
      }
      for (const [m, t] of [['qMeter', 'ckCompassTxt'], ['calMeter', 'calCompassTxt']]){
        $(m).style.width = (moved*100).toFixed(0) + '%'; $(m).className = moved >= 1 ? 'done' : ''; $(t).textContent = msg; }
      $('ckCompass').dataset.state = state;
    }
    raf = requestAnimationFrame(meter);
  }
  function openCal(){
    fillCal();
    document.querySelectorAll('#calSheet .needs-sensors').forEach(li => li.hidden = NO_SENSORS);
    openSheet('calSheet'); if (!raf) raf = requestAnimationFrame(meter);
  }
  for (const id of ['domeCal','arCal','setCal']) $(id).addEventListener('click', openCal);
  $('calClose').addEventListener('click', () => closeSheet('calSheet'));
  // leaving Calibrate stops its compass check (the sensors pause unless Live or the Camera still use them)
  new MutationObserver(() => { if ($('calSheet').hidden && compassOn){ compassOn = false; motion.use('cal', false); } })
    .observe($('calSheet'), {attributes: true, attributeFilter: ['hidden']});

  // start the compass check: must be called straight from a tap (iPhone asks permission only then)
  async function startCompass(){
    try { await motion.start(); motion.use('cal', true); } catch(err){ compassOn = false; row('ckCompass', 'warn', err.message || sensorHelp()); $('calCompassTxt').textContent = err.message || sensorHelp(); return false; }
    motion.reset(); compassOn = true; still0 = null; steady = false; $('calCompass').textContent = 'Start over';
    return true;
  }
  function gpsFix(){
    return new Promise(resolve => {
      if (!navigator.geolocation){ resolve(null); return; }
      navigator.geolocation.getCurrentPosition(pos => resolve(pos), err => resolve(err), {enableHighAccuracy:true, timeout:15000, maximumAge:30000});
    });
  }

  // ---------- Quick calibrate: everything it can do on its own, in order ----------
  $('quickCal').addEventListener('click', async () => {
    $('quickCal').disabled = true; $('quickCal').textContent = 'Calibrating…';
    const compass = NO_SENSORS ? Promise.resolve(false) : startCompass();           // ask for motion access first, while the tap still counts
    row('ckLoc', 'busy', 'Getting a GPS fix… (outside or near a window is best)');
    const pos = await gpsFix();
    if (pos && pos.coords){ setLocation(pos.coords.latitude, pos.coords.longitude, `GPS fix (±${Math.round(pos.coords.accuracy)} m)`); row('ckLoc', 'ok', `GPS fix ±${Math.round(pos.coords.accuracy)} m · ${S.lat.toFixed(4)}, ${S.lon.toFixed(4)}`); }
    else row('ckLoc', 'warn', `${pos && pos.code === 1 ? 'Location access declined' : 'No GPS fix'} · using saved spot: ${S.place}`);
    const d = applyDecl(true);
    row('ckNorth', d == null ? 'warn' : 'ok', d == null ? 'Magnetic model not loaded; using ' + S.decl + '°' : `${d.toFixed(1).replace("-","−")}° applied (${d < 0 ? 'west' : 'east'}), from NOAA for this spot`);
    if (!NO_SENSORS && await compass) row('ckCompass', 'busy', 'Move the phone in a figure 8, twisting it through every angle');
    $('quickCal').disabled = false; $('quickCal').textContent = 'Run again';
    fillCal(); if (compassOn) $('ckCompass').dataset.state = 'busy';
  });
  $('ckSkyGo').addEventListener('click', () => { closeSheet('calSheet'); show('ar'); toast('Crosshair on the sun, moon or a bright planet, then tap Align'); });

  // ---------- individual steps (Details) ----------
  $('calGps').addEventListener('click', async () => {
    $('calGpsTxt').textContent = 'Getting a GPS fix… (step outside or near a window for the best fix)';
    const pos = await gpsFix();
    if (pos && pos.coords){ setLocation(pos.coords.latitude, pos.coords.longitude, `GPS fix (±${Math.round(pos.coords.accuracy)} m)`); toast(`Location set (±${Math.round(pos.coords.accuracy)} m)`); }
    else $('calGpsTxt').textContent = pos && pos.code === 1 ? 'Location access was declined. Allow location for this site, then try again.' : 'Could not get a fix. Try again outside.';
  });
  $('calDecl').addEventListener('click', () => { if (!haveWMM){ toast('Magnetic model not loaded'); return; } applyDecl(false); fillCal(); });
  $('calCompass').addEventListener('click', startCompass);
  $('calLockGo').addEventListener('click', () => { closeSheet('calSheet'); show('ar'); toast('Crosshair on the sun, moon or a bright planet, then tap Align'); });
  $('calClear').addEventListener('click', () => { motion.setCal({dAz:0, dAlt:0}); fillCal(); toast('Sky correction cleared'); });

  // ---------- About sheet ----------
  $('appVersion').textContent = APP_VERSION;
  function aboutTab(k){
    document.querySelectorAll('.about-tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.at === k));
    document.querySelectorAll('.about-body').forEach(p => p.hidden = p.dataset.ap !== k);
    store.set('aboutTab', k);
  }
  document.querySelectorAll('.about-tabs button').forEach(b => b.addEventListener('click', () => aboutTab(b.dataset.at)));
  $('aboutBtn').addEventListener('click', () => { aboutTab(store.get('aboutTab', 'howto')); openSheet('aboutSheet'); });
  $('aboutClose').addEventListener('click', () => closeSheet('aboutSheet'));

  // ---------- "updated" notice: once, the first time a new version opens ----------
  const seen = store.get('seenVersion', null);
  if (seen && seen !== APP_VERSION) setTimeout(() => toast(`Sun Field updated to version ${APP_VERSION}`), 600);
  store.set('seenVersion', APP_VERSION);
})();
