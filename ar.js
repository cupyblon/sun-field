/* Camera AR: live camera with the sun's path drawn on top, aimed by the phone's compass and tilt sensors.
   createAR({getState, colors, store, toast, motion}) -> {show(), hide()}.
   Sensors come from motion.js (shared with the live Dome), so both views use the same iPhone compass fix.
   The camera runs only while this tab is on screen: leaving the tab or locking the phone turns it off,
   and coming back turns it on again.
   Heavy sky math (paths, hour marks, stars, planets) is worked out once per day or per minute and reused
   every frame; each frame only re-projects those points for where the phone is pointing. */
function createAR(opts){
  const {getState, colors, store, toast, motion} = opts;
  const $ = id => document.getElementById(id);
  const video = $('arVideo'), canvas = $('arCanvas'), ctx = canvas.getContext('2d');
  let started = false, visible = false, looping = false, stream = null, camPending = null;
  let fov = store.get('arFov', 67);                 // field of view along the camera image's long side, degrees
  $('arFov').value = fov;

  const dot3 = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const vecOf = (az, alt) => { const a=az*R, h=alt*R; return [Math.cos(h)*Math.sin(a), Math.cos(h)*Math.cos(a), Math.sin(h)]; };
  const azAltOf = v => [((Math.atan2(v[0], v[1])*D)+360)%360, Math.asin(Math.max(-1,Math.min(1,v[2])))*D];
  const DIRS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const dirName = a => DIRS[Math.round(a/22.5)%16];

  // ---- per-day / per-minute results, reused every frame ----
  const memo = new Map();
  const cached = (key, fn) => { if (!memo.has(key)){ if (memo.size > 30) memo.clear(); memo.set(key, fn()); } return memo.get(key); };
  const hourText = (tz) => { const hf = new Intl.DateTimeFormat('en-US',{timeZone:tz,hour:'numeric',hourCycle:'h23'});
    return u => { const hr=+hf.format(new Date(u))%24; return hr===0?'12a':hr===12?'12p':hr<12?hr+'a':(hr-12)+'p'; }; };
  function sky(st){
    const {lat, lon, t0, t1, t, Y, tz} = st, day = `${t0}|${lat}|${lon}|${tz}`;
    const track = (a, b, stepMin, posFn) => { const out=[]; for (let x=a; x<=b; x+=stepMin*60000){ const p=posFn(x); out.push(p.alt>-1 ? [p.az,p.alt] : null); } return out; };
    const hours = (posFn) => { const lbl = hourText(tz), out = [];
      for (let x=Math.ceil(t0/3600000)*3600000; x<t1; x+=3600000){ const p = posFn(x); if (p.alt > -1) out.push([p.az, p.alt, lbl(x)]); } return out; };
    const sunF = x => sunPos(x,lat,lon), moonF = x => moonPos(x,lat,lon);
    const daily = cached('d|'+day, () => ({
      sunPath: track(t0, t1, 5, sunF), sunHours: hours(sunF),
      moonPath: typeof moonPos === 'function' ? track(t0, t1, 10, moonF) : [],
      moonHours: typeof moonPos === 'function' && typeof skyEvents === 'function' ? hours(moonF) : []
    }));
    const seasons = cached(`s|${Y}|${lat}|${lon}|${tz}`, () => [[6,21,'Jun 21'],[12,21,'Dec 21']].map(([m,d,lbl]) => {
      const [a,b] = dayBounds(Y,m,d,tz), n = sunPos(solarNoon(a,b,lat,lon),lat,lon);
      return {lbl, path: track(a, b, 5, sunF), noon: [n.az, n.alt]}; }));
    const now = cached(`n|${t}|${lat}|${lon}`, () => {
      const out = {sun: sunPos(t,lat,lon), moon: typeof moonPos === 'function' ? moonPos(t,lat,lon) : null, dipper: {}, stars: [], planets: []};
      if (typeof planetPos === 'function'){
        for (const [n,ra,dec] of DIPPER) out.dipper[n] = starPos(ra,dec,t,lat,lon);
        for (const [n,ra,dec,mag] of STARS){ if (n === 'Polaris') continue; const s = starPos(ra,dec,t,lat,lon); if (s.alt >= -1) out.stars.push({n, mag, az:s.az, alt:s.alt}); }
        for (const n of PLANETS){ const q = planetPos(n,t,lat,lon); if (q.alt >= -1) out.planets.push({n, az:q.az, alt:q.alt}); }
      }
      return out; });
    return {daily, seasons, now};
  }

  // ---- camera: on while the tab is showing, off otherwise ----
  async function startCamera(){
    if (stream) return;
    if (camPending) return camPending;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser has no camera access. Open the page in Safari or Chrome over https.');
    camPending = (async () => {
      const s = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}, width:{ideal:1920}, height:{ideal:1080}}, audio:false});
      if (!visible){ s.getTracks().forEach(tr => tr.stop()); return; }   // left the tab while the camera was starting
      stream = s; video.srcObject = s; await video.play();
    })();
    try { await camPending; } finally { camPending = null; }
  }
  function stopCamera(){
    if (stream){ stream.getTracks().forEach(tr => tr.stop()); stream = null; }
    video.srcObject = null;
  }
  const camError = err => (err && err.name === 'NotAllowedError') ? 'Camera access was declined. Allow camera for this site in your browser settings, then reload.' : (err && err.message) || String(err);

  // permissions must be requested from the button tap
  async function start(){
    $('arErr').textContent = '';
    try {
      await motion.start();
      await startCamera();
      $('arStart').hidden = true; started = true; run();
    } catch (err){ $('arErr').textContent = camError(err); }
  }
  function resume(){
    if (!started || !visible) return;
    startCamera().then(run).catch(err => { started = false; $('arStart').hidden = false; $('arErr').textContent = camError(err); });
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopCamera(); else resume(); });

  // ---- drawing ----
  function run(){ if (!looping && started && visible){ looping = true; requestAnimationFrame(loop); } }
  function loop(){ if (!started || !visible){ looping = false; return; } draw(); requestAnimationFrame(loop); }
  function draw(){
    const dpr = window.devicePixelRatio||1, W = canvas.clientWidth, H = canvas.clientHeight;
    if (canvas.width !== Math.round(W*dpr) || canvas.height !== Math.round(H*dpr)){ canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr); }
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H);
    const C = colors(), ax = motion.axes(), cal = motion.cal;
    if (!ax){ $('arRead').textContent = 'Waiting for compass… move the phone in a figure 8'; return; }
    const {r,u,c} = ax;
    // focal length in screen pixels: camera image is scaled to cover the screen
    const vw = video.videoWidth || W, vh = video.videoHeight || H, scale = Math.max(W/vw, H/vh);
    const f = (Math.max(vw,vh)*scale/2) / Math.tan(fov*R/2), cx = W/2, cy = H/2;
    const proj = (az, alt) => { const v = vecOf(az + cal.dAz, alt + cal.dAlt), z = dot3(v,c); if (z < 0.08) return null; return [cx + f*dot3(v,r)/z, cy - f*dot3(v,u)/z]; };
    const projAll = list => list.map(q => q ? proj(q[0], q[1]) : null);
    const poly = (pts, color, width, dash) => { ctx.strokeStyle=color; ctx.lineWidth=width; ctx.setLineDash(dash||[]); let open=false; ctx.beginPath();
      for (const p of pts){ if (!p){ open=false; continue; } open ? ctx.lineTo(p[0],p[1]) : ctx.moveTo(p[0],p[1]); open=true; } ctx.stroke(); ctx.setLineDash([]); };
    const label = (p, s, color, size, bold) => { if (!p) return; ctx.font = `${bold?700:600} ${size}px ${C.font}`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,.65)'; ctx.strokeText(s,p[0],p[1]); ctx.fillStyle=color; ctx.fillText(s,p[0],p[1]); };
    const disc = (p, rad, fill) => { ctx.beginPath(); ctx.arc(p[0],p[1],rad,0,7); ctx.fillStyle=fill; ctx.fill(); };

    // horizon and compass ticks
    const hz = []; for (let a=0;a<=360;a+=2) hz.push(proj(a,0)); poly(hz, 'rgba(120,255,140,.85)', 1.5);
    for (let a=0;a<360;a+=10){ const p0=proj(a,0), p1=proj(a, a%30?1.2:2.5); if (p0&&p1) poly([p0,p1],'rgba(120,255,140,.85)',1.2); }
    for (const [l,a] of [['N',0],['NE',45],['E',90],['SE',135],['S',180],['SW',225],['W',270],['NW',315]]) label(proj(a,-3.5), l, l==='N'?C.north:'#fff', l.length>1?13:16, true);
    for (let a=30;a<360;a+=30) if (a%90) label(proj(a,-7), a+'°', 'rgba(255,255,255,.75)', 11);

    const st = getState(), {lat} = st, {daily, seasons, now} = sky(st);
    for (const s of seasons){ poly(projAll(s.path), 'rgba(200,210,235,.7)', 1.5, [6,5]); label(proj(s.noon[0], s.noon[1]+3), s.lbl, 'rgba(220,226,245,.9)', 12); }
    // celestial pole: in the north this is Polaris. Its height above the horizon equals your latitude.
    const pole = lat >= 0 ? [0, lat] : [180, -lat], pq = proj(...pole);
    if (pq){
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(pq[0],pq[1],9,0,7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pq[0]-14,pq[1]); ctx.lineTo(pq[0]-5,pq[1]); ctx.moveTo(pq[0]+5,pq[1]); ctx.lineTo(pq[0]+14,pq[1]);
      ctx.moveTo(pq[0],pq[1]-14); ctx.lineTo(pq[0],pq[1]-5); ctx.moveTo(pq[0],pq[1]+5); ctx.lineTo(pq[0],pq[1]+14); ctx.stroke();
      label([pq[0], pq[1]-24], lat >= 0 ? `Polaris · ${lat.toFixed(1)}° up` : `South celestial pole · ${(-lat).toFixed(1)}° up`, '#fff', 12, true);
    }
    if (now.moon){                                   // the Moon's path and the Moon itself, with its phase
      poly(projAll(daily.moonPath), 'rgba(210,218,235,.85)', 2, [7,4]);
      for (const [az,alt,lbl] of daily.moonHours){ const q = proj(az,alt); if (!q) continue; disc(q, 3, '#dfe4ee'); label([q[0],q[1]+14], lbl, '#dfe4ee', 11, true); }
      const m = now.moon, mq = proj(m.az, m.alt);
      if (mq && m.alt > -1){
        ctx.beginPath(); ctx.arc(mq[0],mq[1],14,0,7); ctx.fillStyle='rgba(27,32,51,.85)'; ctx.fill(); ctx.strokeStyle='#dfe4ee'; ctx.lineWidth=1.5; ctx.stroke();
        if (m.lit > 0.01){ ctx.fillStyle='#eef1f7'; ctx.fill(new Path2D(moonLitPath(m.lit, m.waxing, mq[0], mq[1], 14))); }
        label([mq[0], mq[1]+26], `Moon ${Math.round(m.lit*100)}%`, '#eef1f7', 12, true);
      }
    }
    if (typeof planetPos === 'function'){             // bright stars, Big Dipper, planets
      const pos = now.dipper, dq = {};
      for (const n in pos) dq[n] = proj(pos[n].az, pos[n].alt);
      for (const [a2,b2] of DIPPER_LINES) if (dq[a2] && dq[b2]) poly([dq[a2],dq[b2]], 'rgba(200,215,255,.55)', 1.2);
      for (const n in dq) if (dq[n]) disc(dq[n], 2.5, '#dfe8ff');
      if (dq.Dubhe) label([dq.Dubhe[0], dq.Dubhe[1]-14], 'Big Dipper', 'rgba(220,230,255,.9)', 11, true);
      for (const s of now.stars){ const q = proj(s.az,s.alt); if (!q) continue; disc(q, Math.max(2,4-s.mag), '#eef3ff'); label([q[0], q[1]+14], s.n, 'rgba(230,236,255,.9)', 11); }
      for (const p of now.planets){ const q = proj(p.az,p.alt); if (!q) continue;
        ctx.beginPath(); ctx.arc(q[0],q[1],6,0,7); ctx.fillStyle=PLANET_STYLE[p.n]; ctx.fill(); ctx.lineWidth=1.5; ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.stroke();
        label([q[0], q[1]-16], p.n, PLANET_STYLE[p.n], 13, true); }
    }
    poly(projAll(daily.sunPath), C.path, 3);
    for (const [az,alt,lbl] of daily.sunHours){ const q = proj(az,alt); if (!q) continue; disc(q, 4, C.path); label([q[0],q[1]-13], lbl, C.path, 12, true); }
    // the sun now, or an arrow toward it
    const sp = now.sun, sq = proj(sp.az, sp.alt);
    if (sq && sq[0]>-20 && sq[0]<W+20 && sq[1]>-20 && sq[1]<H+20){
      ctx.beginPath(); ctx.arc(sq[0],sq[1],18,0,7); ctx.fillStyle='rgba(255,224,138,.55)'; ctx.fill(); ctx.lineWidth=2.5; ctx.strokeStyle=C.sunEdge; ctx.stroke();
    } else {
      const v = vecOf(sp.az+cal.dAz, sp.alt+cal.dAlt), ang = Math.atan2(-dot3(v,u), dot3(v,r));
      const ex = cx + Math.cos(ang)*(Math.min(W,H)/2-34), ey = cy + Math.sin(ang)*(Math.min(W,H)/2-34);
      ctx.save(); ctx.translate(ex,ey); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(14,0); ctx.lineTo(-8,-9); ctx.lineTo(-8,9); ctx.closePath();
      ctx.fillStyle=C.sunEdge; ctx.fill(); ctx.restore(); label([ex,ey+22], 'Sun', C.sunEdge, 12, true);
    }
    // crosshair and readout of where the camera points (true bearing, after alignment)
    ctx.strokeStyle='rgba(120,255,140,.95)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(cx,cy,16,0,7);
    ctx.moveTo(cx-28,cy); ctx.lineTo(cx+28,cy); ctx.moveTo(cx,cy-28); ctx.lineTo(cx,cy+28); ctx.stroke();
    const [paz, palt] = azAltOf(c);
    const taz = (paz - cal.dAz + 360) % 360, talt = palt - cal.dAlt;
    const where = talt < -75 ? 'Pointing at the ground' : talt > 75 ? 'Pointing straight up' : `${taz.toFixed(1)}° true ${dirName(taz)}`;
    $('arRead').textContent = `${where} · ${talt>=0?'+':''}${talt.toFixed(1)}°` + ((cal.dAz||cal.dAlt) ? ' · aligned' : '')
      + (motion.stat.relative ? ' · compass not ready, directions may be off' : '');
  }

  // Align: put the crosshair on the real sun, moon, a bright planet or a bright star, and tap. Whatever bright object is
  // nearest the crosshair becomes the reference, and the correction is shared with the live Dome.
  function skyTargets(lat, lon, ms){
    // Only what you can actually see: by day the Sun and the Moon; in twilight add Venus and Jupiter; at night everything bright
    const out = [], up = (n, p, min) => { if (p.alt > min) out.push({n, az:p.az, alt:p.alt}); }, sunAlt = sunPos(ms,lat,lon).alt;
    up('the Sun', sunPos(ms,lat,lon), 0);
    if (typeof moonPos === 'function') up('the Moon', moonPos(ms,lat,lon), 0);
    if (typeof planetPos === 'function' && sunAlt < 0 && sunAlt >= -6){ for (const n of ['Venus','Jupiter']) up(n, planetPos(n,ms,lat,lon), 3); }
    else if (typeof planetPos === 'function' && sunAlt < -6){
      for (const n of ['Venus','Jupiter','Mars','Saturn']) up(n, planetPos(n,ms,lat,lon), 3);
      for (const [n,ra,dec,mag] of STARS) if (mag < 1.0) up(n, starPos(ra,dec,ms,lat,lon), 5);
    }
    return out;
  }
  $('arAlign').addEventListener('click', () => {
    const ax = motion.axes();
    if (!started || !ax) { toast('Start the camera first'); return; }
    const st = getState(), now = Date.now(), [paz, palt] = azAltOf(ax.c), cal = motion.cal;
    const aimAz = paz - cal.dAz, aimAlt = palt - cal.dAlt;          // where the crosshair points with today's correction
    const sep = q => Math.acos(Math.min(1, Math.sin(aimAlt*R)*Math.sin(q.alt*R) + Math.cos(aimAlt*R)*Math.cos(q.alt*R)*Math.cos((aimAz-q.az)*R)))*D;
    const best = skyTargets(st.lat, st.lon, now).map(q => ({...q, d: sep(q)})).sort((a,b) => a.d - b.d)[0];
    if (!best || best.d > 20){ toast('Put the crosshair on the sun, the moon or a bright planet, then tap Align'); return; }
    const tf = new Intl.DateTimeFormat('en-US',{timeZone:st.tz, month:'short', day:'numeric', hour:'numeric', minute:'2-digit'});
    motion.setCal({dAz: ((paz - best.az + 540) % 360) - 180, dAlt: palt - best.alt, on: best.n, at: tf.format(new Date(now))});
    toast(`Locked on ${best.n} (${motion.cal.dAz>=0?'+':''}${motion.cal.dAz.toFixed(1)}° compass correction) · Camera and Dome`);
  });
  $('arFov').addEventListener('input', e => { fov = +e.target.value; store.set('arFov', fov); });
  $('arGo').addEventListener('click', start);

  return {
    show(){ visible = true; resume(); },
    hide(){ visible = false; stopCamera(); }
  };
}
