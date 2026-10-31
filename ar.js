/* Camera AR: live camera with the sun's path drawn on top, aimed by the phone's compass and tilt sensors.
   createAR({getState, colors, store, toast}) -> {start(), show(), hide()}.
   Sensor math follows the W3C DeviceOrientation spec: R = Rz(alpha)·Rx(beta)·Ry(gamma), Earth frame x=East, y=North, z=Up. */
function createAR(opts){
  const {getState, colors, store, toast} = opts;
  const $ = id => document.getElementById(id);
  const video = $('arVideo'), canvas = $('arCanvas'), ctx = canvas.getContext('2d');
  let ori = null, running = false, visible = false, stream = null, smooth = null;
  let cal = store.get('arCal', {dAz:0, dAlt:0});
  let fov = store.get('arFov', 67);                 // field of view along the camera image's long side, degrees
  $('arFov').value = fov;

  // ---- sensors ----
  // iPhone fix (v2): the gyro's alpha is smooth at every angle but starts from an arbitrary zero, while
  // webkitCompassHeading knows true north but changes what it measures as the phone tilts (top edge when flat,
  // camera when upright), so it jumps when you look down. Steer with alpha, and use the compass only to set
  // alpha's zero, only while the phone is held upright, smoothed so a bad reading can't yank the view.
  let iosOffset = null;
  const wrap = x => ((x % 360) + 540) % 360 - 180;
  function onOrient(e, absolute){
    if (e.alpha == null || e.beta == null || e.gamma == null) return;
    const decl = getState().decl, H = e.webkitCompassHeading;
    if (typeof H === 'number' && H >= 0){                        // iPhone: H = degrees clockwise from magnetic north
      const upright = e.beta > 50 && e.beta < 130 && Math.abs(e.gamma) < 40;
      if (upright){
        const camAz = azAltOf(col(matrix(e.alpha, e.beta, e.gamma), 2).map(x=>-x))[0];
        const target = wrap(camAz - (H + decl));
        iosOffset = iosOffset === null ? target : wrap(iosOffset + wrap(target - iosOffset)*0.05);
      } else if (iosOffset === null){
        iosOffset = wrap((360 - (H + decl)) - e.alpha);           // first reading with the phone flat
      }
      ori = {alpha: e.alpha + iosOffset, beta: e.beta, gamma: e.gamma};
      return;
    }
    if (!absolute && !e.absolute) return;                        // Android relative-only readings can't be aimed
    ori = {alpha: e.alpha - decl, beta: e.beta, gamma: e.gamma}; // Android absolute alpha is magnetic: correct to true north
  }
  function matrix(a,b,g){
    a*=R; b*=R; g*=R;
    const ca=Math.cos(a), sa=Math.sin(a), cb=Math.cos(b), sb=Math.sin(b), cg=Math.cos(g), sg=Math.sin(g);
    return [[ca*cg - sa*sb*sg, -sa*cb, ca*sg + sa*sb*cg],
            [sa*cg + ca*sb*sg,  ca*cb, sa*sg - ca*sb*cg],
            [-cb*sg,            sb,    cb*cg]];
  }
  const col = (m,i) => [m[0][i], m[1][i], m[2][i]];
  const dot3 = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const vecOf = (az, alt) => { const a=az*R, h=alt*R; return [Math.cos(h)*Math.sin(a), Math.cos(h)*Math.cos(a), Math.sin(h)]; };
  const azAltOf = v => [((Math.atan2(v[0], v[1])*D)+360)%360, Math.asin(Math.max(-1,Math.min(1,v[2])))*D];

  // low-pass the camera axes so the overlay doesn't shake
  function axes(){
    const m = matrix(ori.alpha, ori.beta, ori.gamma);
    const raw = {r: col(m,0), u: col(m,1), c: col(m,2).map(x=>-x)};
    if (!smooth) smooth = raw;
    else for (const k of ['r','u','c']) smooth[k] = smooth[k].map((x,i)=> x*0.75 + raw[k][i]*0.25);
    return smooth;
  }

  // ---- start: permissions must be requested from the button tap ----
  async function start(){
    $('arErr').textContent = '';
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function'){
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') throw new Error('Motion and orientation access was declined. On iPhone: Settings › Safari › Motion & Orientation Access, then reload.');
      }
      if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', e=>onOrient(e,true));
      else window.addEventListener('deviceorientation', e=>onOrient(e,false));
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser has no camera access. Open the page in Safari or Chrome over https.');
      stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}, width:{ideal:1920}, height:{ideal:1080}}, audio:false});
      video.srcObject = stream; await video.play();
      $('arStart').hidden = true; running = true; loop();
    } catch (err){
      $('arErr').textContent = (err && err.name === 'NotAllowedError') ? 'Camera access was declined. Allow camera for this site in your browser settings, then reload.' : (err.message || String(err));
    }
  }

  // ---- drawing ----
  function loop(){ if (running && visible) draw(); if (running) requestAnimationFrame(loop); }
  function draw(){
    const dpr = window.devicePixelRatio||1, W = canvas.clientWidth, H = canvas.clientHeight;
    if (canvas.width !== Math.round(W*dpr) || canvas.height !== Math.round(H*dpr)){ canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr); }
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H);
    const C = colors();
    if (!ori){ $('arRead').textContent = 'Waiting for compass… move the phone in a figure 8'; return; }
    const {r,u,c} = axes();
    // focal length in screen pixels: camera image is scaled to cover the screen
    const vw = video.videoWidth || W, vh = video.videoHeight || H, scale = Math.max(W/vw, H/vh);
    const f = (Math.max(vw,vh)*scale/2) / Math.tan(fov*R/2), cx = W/2, cy = H/2;
    const proj = (az, alt) => { const v = vecOf(az + cal.dAz, alt + cal.dAlt), z = dot3(v,c); if (z < 0.08) return null; return [cx + f*dot3(v,r)/z, cy - f*dot3(v,u)/z]; };
    const poly = (pts, color, width, dash) => { ctx.strokeStyle=color; ctx.lineWidth=width; ctx.setLineDash(dash||[]); let open=false; ctx.beginPath();
      for (const p of pts){ if (!p){ open=false; continue; } open ? ctx.lineTo(p[0],p[1]) : ctx.moveTo(p[0],p[1]); open=true; } ctx.stroke(); ctx.setLineDash([]); };
    const label = (p, s, color, size, bold) => { if (!p) return; ctx.font = `${bold?700:600} ${size}px ${C.font}`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,.65)'; ctx.strokeText(s,p[0],p[1]); ctx.fillStyle=color; ctx.fillText(s,p[0],p[1]); };

    // horizon and compass ticks
    const hz = []; for (let a=0;a<=360;a+=2) hz.push(proj(a,0)); poly(hz, 'rgba(120,255,140,.85)', 1.5);
    for (let a=0;a<360;a+=10){ const p0=proj(a,0), p1=proj(a, a%30?1.2:2.5); if (p0&&p1) poly([p0,p1],'rgba(120,255,140,.85)',1.2); }
    for (const [l,a] of [['N',0],['NE',45],['E',90],['SE',135],['S',180],['SW',225],['W',270],['NW',315]]) label(proj(a,-3.5), l, l==='N'?C.north:'#fff', l.length>1?13:16, true);
    for (let a=30;a<360;a+=30) if (a%90) label(proj(a,-7), a+'°', 'rgba(255,255,255,.75)', 11);

    const st = getState(), {lat, lon, t0, t1, t, Y, tz} = st;
    const path = (a,b) => { const out=[]; for (let x=a;x<=b;x+=5*60000){ const p=sunPos(x,lat,lon); out.push(p.alt>-1 ? proj(p.az,p.alt) : null); } return out; };
    for (const [m,d,lbl] of [[6,21,'Jun 21'],[12,21,'Dec 21']]){
      const [a,b] = dayBounds(Y,m,d,tz); poly(path(a,b), 'rgba(200,210,235,.7)', 1.5, [6,5]);
      const n = sunPos(solarNoon(a,b,lat,lon),lat,lon); label(proj(n.az, n.alt+3), lbl, 'rgba(220,226,245,.9)', 12);
    }
    // celestial pole: in the north this is Polaris. Its height above the horizon equals your latitude.
    const pole = lat >= 0 ? [0, lat] : [180, -lat], pq = proj(...pole);
    if (pq){
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(pq[0],pq[1],9,0,7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pq[0]-14,pq[1]); ctx.lineTo(pq[0]-5,pq[1]); ctx.moveTo(pq[0]+5,pq[1]); ctx.lineTo(pq[0]+14,pq[1]);
      ctx.moveTo(pq[0],pq[1]-14); ctx.lineTo(pq[0],pq[1]-5); ctx.moveTo(pq[0],pq[1]+5); ctx.lineTo(pq[0],pq[1]+14); ctx.stroke();
      label([pq[0], pq[1]-24], lat >= 0 ? `Polaris · ${lat.toFixed(1)}° up` : `South celestial pole · ${(-lat).toFixed(1)}° up`, '#fff', 12, true);
    }
    if (typeof moonPos === 'function'){              // the Moon's path and the Moon itself, with its phase
      const mp = []; for (let x=t0; x<=t1; x+=10*60000){ const m = moonPos(x,lat,lon); mp.push(m.alt > -1 ? proj(m.az, m.alt) : null); }
      poly(mp, 'rgba(210,218,235,.85)', 2, [7,4]);
      const m = moonPos(t,lat,lon), mq = proj(m.az, m.alt);
      if (mq && m.alt > -1){
        ctx.beginPath(); ctx.arc(mq[0],mq[1],14,0,7); ctx.fillStyle='rgba(27,32,51,.85)'; ctx.fill(); ctx.strokeStyle='#dfe4ee'; ctx.lineWidth=1.5; ctx.stroke();
        if (m.lit > 0.01){ ctx.fillStyle='#eef1f7'; ctx.fill(new Path2D(moonLitPath(m.lit, m.waxing, mq[0], mq[1], 14))); }
        label([mq[0], mq[1]+26], `Moon ${Math.round(m.lit*100)}%`, '#eef1f7', 12, true);
      }
    }
    poly(path(t0,t1), C.path, 3);
    const hf = new Intl.DateTimeFormat('en-US',{timeZone:tz,hour:'numeric',hourCycle:'h23'});
    for (let x=Math.ceil(t0/3600000)*3600000; x<t1; x+=3600000){
      const p = sunPos(x,lat,lon); if (p.alt <= -1) continue; const q = proj(p.az,p.alt); if (!q) continue;
      ctx.beginPath(); ctx.arc(q[0],q[1],4,0,7); ctx.fillStyle=C.path; ctx.fill();
      const hr=+hf.format(new Date(x))%24; label([q[0],q[1]-13], hr===0?'12a':hr===12?'12p':hr<12?hr+'a':(hr-12)+'p', C.path, 12, true);
    }
    // the sun now, or an arrow toward it
    const sp = sunPos(t,lat,lon), sq = proj(sp.az, sp.alt);
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
    $('arRead').textContent = `${where} · ${talt>=0?'+':''}${talt.toFixed(1)}°` + ((cal.dAz||cal.dAlt) ? ' · aligned' : '');
  }
  const DIRS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const dirName = a => DIRS[Math.round(a/22.5)%16];

  // Align: put the crosshair on the real sun (squint, or use a shadow-safe view), tap, and the overlay locks to it.
  $('arAlign').addEventListener('click', () => {
    if (!ori) { toast('Start the camera first'); return; }
    const st = getState(), sp = sunPos(Date.now(), st.lat, st.lon);
    if (sp.alt < 0){ toast('The sun is below the horizon right now'); return; }
    const [paz, palt] = azAltOf(axes().c);
    cal = {dAz: ((paz - sp.az + 540) % 360) - 180, dAlt: palt - sp.alt};
    store.set('arCal', cal); toast(`Aligned (${cal.dAz>=0?'+':''}${cal.dAz.toFixed(1)}° compass correction)`);
  });
  $('arReset').addEventListener('click', () => { cal = {dAz:0, dAlt:0}; store.set('arCal', cal); toast('Alignment cleared'); });
  $('arFov').addEventListener('input', e => { fov = +e.target.value; store.set('arFov', fov); });
  $('arGo').addEventListener('click', start);

  return {
    show(){ visible = true; },
    hide(){ visible = false; }
  };
}
