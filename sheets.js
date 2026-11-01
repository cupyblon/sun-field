/* Calibrate and About sheets. Load after app.js (uses S, store, toast, show, setLocation, motion, NO_SENSORS, $)
   and vendor/magvar.js (magDeclination).
   Calibrate: 1 GPS fix · 2 declination from NOAA's World Magnetic Model · 3 compass reset with a figure-8 meter
   (iPhone also reports its own compass accuracy) · 4 sky lock via the Camera's Align. */
(function(){
  const APP_VERSION = '15';
  const openSheet = id => { $(id).hidden = false; document.body.classList.add('sheet-open'); };
  const closeSheet = id => { $(id).hidden = true; document.body.classList.remove('sheet-open'); };
  for (const id of ['calSheet','aboutSheet']) $(id).addEventListener('click', e => { if (e.target.id === id) closeSheet(id); });  // tap outside closes
  document.addEventListener('keydown', e => { if (e.key === 'Escape'){ closeSheet('calSheet'); closeSheet('aboutSheet'); } });

  // ---------- declination: automatic from NOAA's model unless you typed your own ----------
  const haveWMM = typeof magDeclination === 'function';
  const noaaDecl = () => haveWMM ? Math.round(magDeclination(S.lat, S.lon, new Date())*10)/10 : null;
  function applyDecl(quiet){
    const d = noaaDecl(); if (d == null) return;
    S.decl = d; store.set('decl', d); store.set('declAuto', true); $('decl').value = d;
    if (!quiet) toast(`Compass offset set to ${d}° (${d < 0 ? 'west' : 'east'}) from NOAA`);
  }
  if (haveWMM && store.get('declAuto', true)) applyDecl(true);
  $('decl').addEventListener('change', () => store.set('declAuto', false));          // typed by hand: leave it alone
  const baseSetLocation = setLocation;                                               // a new spot gets its own offset
  setLocation = function(){ baseSetLocation.apply(this, arguments); if (store.get('declAuto', true)) applyDecl(true); if (!$('calSheet').hidden) fillCal(); };

  // ---------- Calibrate sheet ----------
  let compassOn = false, still0 = null, raf = null;
  function fillCal(){
    $('calGpsTxt').textContent = `Using: ${S.place} (${S.lat.toFixed(4)}, ${S.lon.toFixed(4)})`;
    const d = noaaDecl();
    $('calDeclTxt').textContent = `Set to ${S.decl}°` + (d == null ? '' : store.get('declAuto', true) && Math.abs(d - S.decl) < 0.05 ? ' · from NOAA for this spot' : ` · NOAA says ${d}° here`);
    const c = motion.cal;
    $('calLockTxt').innerHTML = (c.dAz || c.dAlt)
      ? `Correction <b>${c.dAz>=0?'+':''}${c.dAz.toFixed(1)}°</b>${c.on ? ` · locked on ${c.on}${c.at ? `, ${c.at}` : ''}` : ''}. Used by the Camera and the live Dome.`
      : 'No correction yet. In the Camera, put the crosshair on the sun (or the moon or a bright planet at night) and tap Align.';
  }
  function meter(){
    if ($('calSheet').hidden){ raf = null; return; }
    if (compassOn){
      const st = motion.stat, moved = Math.min(1, st.moved/900), sp = motion.spread();
      $('calMeter').style.width = (moved*100).toFixed(0) + '%';
      let msg;
      if (st.events === 0) msg = 'No readings yet. ' + sensorHelp();
      else if (moved < 1) msg = `Keep going: twist and turn the phone in a figure 8 (${Math.round(moved*100)}%)`;
      else if (sp == null || sp > 3){ still0 = null; msg = 'Good. Now hold the phone still…'; }
      else { if (!still0) still0 = performance.now(); msg = performance.now() - still0 > 1200 ? 'Steady ✓ Compass reset.' : 'Hold still…'; }
      if (st.accuracy != null) msg += ` · Phone reports compass accuracy ±${Math.round(st.accuracy)}°` + (st.accuracy <= 10 ? ' (good)' : st.accuracy <= 25 ? ' (fair)' : ' (poor: keep moving, away from metal)');
      $('calCompassTxt').textContent = msg;
      $('calMeter').className = moved >= 1 ? 'done' : '';
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

  $('calGps').addEventListener('click', () => {
    if (!navigator.geolocation){ toast('Location is not available in this browser'); return; }
    $('calGpsTxt').textContent = 'Getting a GPS fix… (step outside or near a window for the best fix)';
    navigator.geolocation.getCurrentPosition(
      pos => { setLocation(pos.coords.latitude, pos.coords.longitude, `GPS fix (±${Math.round(pos.coords.accuracy)} m)`); toast(`Location set (±${Math.round(pos.coords.accuracy)} m)`); },
      err => { $('calGpsTxt').textContent = err.code === 1 ? 'Location access was declined. Allow location for this site, then try again.' : 'Could not get a fix. Try again outside.'; },
      {enableHighAccuracy:true, timeout:20000, maximumAge:0});
  });
  $('calDecl').addEventListener('click', () => { if (!haveWMM){ toast('Magnetic model not loaded'); return; } applyDecl(false); fillCal(); });
  $('calCompass').addEventListener('click', async () => {
    try { await motion.start(); } catch(err){ $('calCompassTxt').textContent = err.message || sensorHelp(); return; }
    motion.reset(); compassOn = true; still0 = null; $('calCompass').textContent = 'Start over';
  });
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
})();
