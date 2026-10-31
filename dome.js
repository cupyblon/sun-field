/* 3D sky dome with toggleable layers, like Sun Surveyor's 3D Compass.
   Needs sun.js loaded first. createDome(canvas, colors) returns {draw(state), setView(name), setLayers(obj), layers}.
   state = {t, t0, t1, lat, lon, Y, tz}; colors() returns CSS colors.
   Layers: altaz (horizon grid), celestial (equatorial grid + poles), sphere (below-horizon half + night path),
           seasons (Jun/equinox/Dec paths), bearings (sunrise/sunset/sun lines + shadow), hours (hour labels). */
const DOME_LAYERS = [
  ['altaz',     'Horizon grid',    'Altitude rings and compass lines'],
  ['celestial', 'Celestial grid',  'Tilted to your latitude, with the celestial poles'],
  ['sphere',    'Full sphere',     'Below the ground, with the sun\'s night path'],
  ['seasons',   'Season paths',    'June solstice, equinox, December solstice'],
  ['bearings',  'Bearings',        'Sunrise, sunset and sun lines, plus the shadow'],
  ['hours',     'Hour labels',     '8a, 9a, …']
];
const DOME_DEFAULTS = {altaz:true, celestial:false, sphere:false, seasons:true, bearings:true, hours:true};

function createDome(canvas, colors, initialLayers){
  let yaw = 180, pitch = 28, zoom = 1;          // yaw = compass direction the viewer faces; pitch = how far above the ground we look down from
  let last = null;
  const layers = Object.assign({}, DOME_DEFAULTS, initialLayers || {});
  const pts = new Map();
  const ctx = canvas.getContext('2d');

  function project(E, N, U){
    const y = yaw*R, p = pitch*R;
    const X = E*Math.cos(y) - N*Math.sin(y);    // screen right
    const F = E*Math.sin(y) + N*Math.cos(y);    // away from viewer
    return [X, U*Math.cos(p) + F*Math.sin(p), F*Math.cos(p) - U*Math.sin(p)];
  }
  const sky = (az, alt, r=1) => { const a=az*R, h=alt*R; return project(r*Math.cos(h)*Math.sin(a), r*Math.cos(h)*Math.cos(a), r*Math.sin(h)); };
  const gp = (a, r) => [r*Math.sin(a*R), r*Math.cos(a*R), 0];
  // equatorial (hour angle, declination) -> horizon (az, alt) for this latitude
  function eq2hor(ha, dec, lat){
    const H=ha*R, d=dec*R, L=lat*R;
    const alt = Math.asin(Math.sin(L)*Math.sin(d) + Math.cos(L)*Math.cos(d)*Math.cos(H))*D;
    const az = (Math.atan2(Math.sin(H), Math.cos(H)*Math.sin(L) - Math.tan(d)*Math.cos(L))*D + 180 + 360) % 360;
    return [az, alt];
  }

  function draw(state){
    if (state) last = state;
    if (!last) return;
    const C = colors(), dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w*dpr) || canvas.height !== Math.round(h*dpr)){ canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr); }
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
    const full = layers.sphere;
    // fit: dome top at cos(pitch); bottom is the near ground edge, or the sphere's bottom when the full sphere is shown
    const top = Math.cos(pitch*R), bot = full ? -1 : -Math.sin(pitch*R)*1.2;
    const s = Math.min(w*0.36, (h*0.80)/(top-bot+0.25))*zoom, cx = w/2, cy = h/2 + s*(top+bot)/2;
    const S = ([X,Y]) => [cx + X*s, cy - Y*s];
    const line = (arr, color, width, dash) => { if (arr.length<2) return; ctx.beginPath(); arr.forEach((q,i)=>{ const [x,y]=S(q); i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
      ctx.strokeStyle=color; ctx.lineWidth=width; ctx.setLineDash(dash||[]); ctx.stroke(); ctx.setLineDash([]); };
    const text = (q, str, color, size, weight) => { const [x,y]=S(q); ctx.font=`${weight||500} ${size}px ${C.font}`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.lineWidth=3; ctx.strokeStyle=C.halo; ctx.strokeText(str,x,y); ctx.fillStyle=color; ctx.fillText(str,x,y); };
    const dot = (q, r, fill, stroke) => { const [x,y]=S(q); ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fillStyle=fill; ctx.fill(); if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke();} };
    // draw a list of [az,alt] as connected runs, keeping only points that pass keep(alt)
    const runs = (azalt, keep, color, width, dash) => { let seg=[]; for (const [a,al] of azalt){ if (keep(al)) seg.push(sky(a,al)); else { line(seg,color,width,dash); seg=[]; } } line(seg,color,width,dash); };
    const above = al => al >= 0, below = al => al <= 0, any = () => true;

    const {t, t0, t1, lat, lon, Y, tz} = last;
    const hf = new Intl.DateTimeFormat('en-US',{timeZone:tz,hour:'numeric',hourCycle:'h23'});
    const hourLbl = u => { const hr=+hf.format(new Date(u))%24; return hr===0?'12a':hr===12?'12p':hr<12?hr+'a':(hr-12)+'p'; };
    const sunTrack = (a,b,step=5) => { const out=[]; for (let u=a;u<=b;u+=step*60000){ const p=sunPos(u,lat,lon); out.push([p.az,p.alt]); } return out; };
    const today = sunTrack(t0,t1);

    // grids as az/alt polylines
    const altazRings = (keep) => { for (const alt of [-75,-60,-45,-30,-15,15,30,45,60,75]){ if (!keep(alt)) continue; const r=[]; for(let a=0;a<=360;a+=4) r.push([a,alt]); runs(r, any, C.altaz, alt%30?0.6:1); } };
    const altazMeridians = (lo, hi) => { for (let a=0;a<360;a+=30){ const m=[]; for(let al=lo;al<=hi;al+=3) m.push([a,al]); runs(m, any, C.altaz, 0.7); } };
    const celestial = (keep) => {
      for (let dec=-75; dec<=75; dec+=15){ const r=[]; for (let ha=-180; ha<=180; ha+=4) r.push(eq2hor(ha,dec,lat)); runs(r, keep, C.celes, dec===0?1.8:0.8); }
      for (let ha=0; ha<360; ha+=15){ const m=[]; for (let dec=-88; dec<=88; dec+=4) m.push(eq2hor(ha,dec,lat)); runs(m, keep, C.celes, 0.7); }
    };

    // ---- below the ground (full sphere only) ----
    if (full){
      if (layers.altaz){ altazRings(below); altazMeridians(-90, 0); }
      if (layers.celestial) celestial(below);
      runs(today, below, C.night, 2.4, [7,5]);
      for (let u=Math.ceil(t0/3600000)*3600000; u<t1; u+=3600000){ const p=sunPos(u,lat,lon); if (p.alt>=0) continue;
        dot(sky(p.az,p.alt),3.2,C.night); if (layers.hours) text(sky(p.az,p.alt-5), hourLbl(u), C.path, 11, 600); }
    }

    // ---- ground disc (see-through when the full sphere is on) ----
    const ring = []; for (let a=0;a<=360;a+=3) ring.push(sky(a,0));
    ctx.beginPath(); ring.forEach((q,i)=>{const [x,y]=S(q); i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
    ctx.globalAlpha = full ? 0.55 : 1; ctx.fillStyle=C.ground; ctx.fill(); ctx.globalAlpha = 1;
    for (let a=0;a<360;a+=5){ const big=a%15===0; line([project(...gp(a,1)), project(...gp(a, big?1.06:1.03))], C.muted, big?1.2:0.8); }
    for (let a=0;a<360;a+=30){ if (a%90) text(project(...gp(a,1.14)), a+'°', C.muted, 10, 500); }
    [['N',0],['E',90],['S',180],['W',270]].forEach(([l,a])=>text(project(...gp(a,1.17)), l, l==='N'?C.north:C.fg, 15, 700));

    // ---- sky half ----
    if (layers.altaz){ altazRings(above); altazMeridians(0, 90); }
    if (layers.celestial) celestial(above);
    line(ring, C.line, 1.6);

    if (layers.seasons){
      for (const [m,d,lbl] of [[6,21,'Jun 21'],[3,20,'Equinox'],[12,21,'Dec 21']]){
        const [a,b] = dayBounds(Y,m,d,tz); runs(sunTrack(a,b), above, C.season, 1.2, [5,4]);
        const lp = sunPos(solarNoon(a,b,lat,lon) + 4*3600000, lat, lon);
        if (lp.alt>0) text(sky(lp.az + (lat>=0 ? 9 : -9), lp.alt + (m===6 ? 6 : m===12 ? -6 : 0)), lbl, C.muted, 10, 600);
      }
    }

    runs(today, above, C.path, 2.6);
    for (let u=Math.ceil(t0/3600000)*3600000; u<t1; u+=3600000){
      const p=sunPos(u,lat,lon); if (p.alt<=0) continue;
      dot(sky(p.az,p.alt),3.2,C.path); if (layers.hours) text(sky(p.az,p.alt+5), hourLbl(u), C.path, 11, 600);
    }

    const O = project(0,0,0);
    if (layers.bearings){
      const ev = crossings(t0,t1,lat,lon,-0.833);
      if (ev.rise) line([O, sky(sunPos(ev.rise,lat,lon).az,0)], C.rise, 2.2);
      if (ev.set)  line([O, sky(sunPos(ev.set,lat,lon).az,0)], C.set, 2.2);
    }
    // celestial poles: the north one is where Polaris sits
    if (layers.celestial){
      const np = lat>=0 ? [0, lat] : [180, -lat], sp = lat>=0 ? [180, -lat] : [0, lat];
      if (np[1] >= 0 || full){ dot(sky(...np), 5, C.celes, C.fg); text(sky(np[0], np[1]+7), lat>=0 ? 'N pole · Polaris' : 'S pole', C.fg, 11, 700); }
      if (sp[1] >= 0 || full){ dot(sky(...sp), 5, C.celes, C.fg); text(sky(sp[0], sp[1]-7), lat>=0 ? 'S pole' : 'N pole', C.fg, 11, 700); }
    }
    // current sun
    const p = sunPos(t,lat,lon);
    if (p.alt > 0){
      const sun = sky(p.az,p.alt);
      if (layers.bearings){
        const foot = sky(p.az,0,Math.cos(p.alt*R));
        line([O, sky(p.az,0)], C.sunLine, 2);
        line([foot, sun], C.sunLine, 1.2, [3,3]);
        const sh = Math.min(0.95, 0.25/Math.tan(p.alt*R)), sa=(p.az+180)*R;
        line([O, project(sh*Math.sin(sa), sh*Math.cos(sa), 0)], C.shadow, 4);
      }
      dot(sun, 12, C.sun, C.sunEdge);
    } else if (full || p.alt > -12){
      dot(sky(p.az, p.alt), 9, C.below, C.sunEdge);
    }
    dot(O, 4, C.fg);
  }

  // touch / mouse: drag to spin and tilt, pinch or wheel to zoom
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId,{x:e.clientX,y:e.clientY}); });
  canvas.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId), cur = {x:e.clientX,y:e.clientY};
    if (pts.size === 1){ yaw = (yaw - (cur.x-prev.x)*0.45 + 360) % 360; pitch = Math.max(-30, Math.min(89, pitch + (cur.y-prev.y)*0.3)); }
    else if (pts.size === 2){ const [a,b] = [...pts.values()], other = a===prev ? b : a;
      const d0 = Math.hypot(prev.x-other.x, prev.y-other.y), d1 = Math.hypot(cur.x-other.x, cur.y-other.y);
      if (d0 > 0) zoom = Math.max(0.6, Math.min(2.2, zoom*d1/d0)); }
    pts.set(e.pointerId, cur); draw();
  });
  const up = e => pts.delete(e.pointerId);
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoom = Math.max(0.6, Math.min(2.2, zoom*(e.deltaY<0?1.08:0.93))); draw(); }, {passive:false});
  new ResizeObserver(()=>draw()).observe(canvas);

  return {
    draw, layers,
    setLayers(obj){ Object.assign(layers, obj); draw(); },
    setView(name){ if (name==='top'){ pitch=89; yaw=0; } else if (name==='side'){ pitch=12; yaw=180; } else { pitch=28; yaw=180; zoom=1; } draw(); }
  };
}

/* Builds the on/off layer panel. host = element to fill; onChange(layers) is called after each toggle. */
function buildLayerPanel(host, dome, onChange){
  host.innerHTML = DOME_LAYERS.map(([k,name,sub]) =>
    `<button type="button" class="layer" data-k="${k}" aria-pressed="${dome.layers[k]}"><span class="tick" aria-hidden="true"></span><span><b>${name}</b><small>${sub}</small></span></button>`).join('');
  host.querySelectorAll('.layer').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.k, v = !dome.layers[k]; dome.setLayers({[k]: v}); b.setAttribute('aria-pressed', v); if (onChange) onChange(dome.layers);
  }));
}
