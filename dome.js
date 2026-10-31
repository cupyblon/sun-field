/* 3D sky dome: a wireframe hemisphere you can spin with a finger, like Sun Surveyor's 3D Compass.
   Needs sun.js loaded first. createDome(canvas, colors) returns {draw(state), setView(name)}.
   state = {t, t0, t1, lat, lon, Y, tz}; colors() returns an object of CSS colors. */
function createDome(canvas, colors){
  let yaw = 180, pitch = 28, zoom = 1;          // yaw = compass direction the viewer faces; pitch = how far above the ground we look down from
  let last = null;
  const pts = new Map();
  const ctx = canvas.getContext('2d');

  function project(E, N, U){
    const y = yaw*R, p = pitch*R;
    const X = E*Math.cos(y) - N*Math.sin(y);    // screen right
    const F = E*Math.sin(y) + N*Math.cos(y);    // away from viewer
    return [X, U*Math.cos(p) + F*Math.sin(p), F*Math.cos(p) - U*Math.sin(p)];
  }
  const sky = (az, alt, r=1) => { const a=az*R, h=alt*R; return project(r*Math.cos(h)*Math.sin(a), r*Math.cos(h)*Math.cos(a), r*Math.sin(h)); };

  function draw(state){
    if (state) last = state;
    if (!last) return;
    const C = colors(), dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w*dpr) || canvas.height !== Math.round(h*dpr)){ canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr); }
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
    // fit the dome: its top sits at cos(pitch), the near ground edge at -sin(pitch); center that span on the canvas
    const top = Math.cos(pitch*R), bot = -Math.sin(pitch*R) - 0.2*Math.sin(pitch*R);
    const s = Math.min(w*0.36, (h*0.80)/(top-bot+0.25))*zoom, cx = w/2, cy = h/2 + s*(top+bot)/2;
    const S = ([X,Y]) => [cx + X*s, cy - Y*s];
    const line = (arr, color, width, dash) => { if (arr.length<2) return; ctx.beginPath(); arr.forEach((q,i)=>{ const [x,y]=S(q); i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
      ctx.strokeStyle=color; ctx.lineWidth=width; ctx.setLineDash(dash||[]); ctx.stroke(); ctx.setLineDash([]); };
    const text = (q, str, color, size, weight) => { const [x,y]=S(q); ctx.fillStyle=color; ctx.font=`${weight||500} ${size}px ${C.font}`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(str,x,y); };
    const dot = (q, r, fill, stroke) => { const [x,y]=S(q); ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fillStyle=fill; ctx.fill(); if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke();} };

    // ground disc
    const ring = []; for (let a=0;a<=360;a+=3) ring.push(sky(a,0));
    ctx.beginPath(); ring.forEach((q,i)=>{const [x,y]=S(q); i?ctx.lineTo(x,y):ctx.moveTo(x,y);}); ctx.fillStyle=C.ground; ctx.fill();
    // compass ticks and labels on the ground
    for (let a=0;a<360;a+=5){ const big=a%15===0; line([project(...gp(a,1)), project(...gp(a, big?1.06:1.03))], C.muted, big?1.2:0.8); }
    for (let a=0;a<360;a+=30){ if (a%90) text(project(...gp(a,1.14)), a+'°', C.muted, 10, 500); }
    [['N',0],['E',90],['S',180],['W',270]].forEach(([l,a])=>text(project(...gp(a,1.17)), l, l==='N'?C.north:C.fg, 15, 700));
    // dome grid: altitude rings and meridians
    for (const alt of [15,30,45,60,75]){ const r=[]; for(let a=0;a<=360;a+=4) r.push(sky(a,alt)); line(r, C.grid, alt%30?0.6:1); }
    for (let a=0;a<360;a+=30){ const m=[]; for(let h=0;h<=90;h+=3) m.push(sky(a,h)); line(m, C.grid, 0.7); }
    line(ring, C.line, 1.6);

    const {t, t0, t1, lat, lon, Y, tz} = last;
    // faint solstice paths for the year range
    const pathFor = (a,b) => { const out=[]; for(let u=a;u<=b;u+=5*60000){ const p=sunPos(u,lat,lon); out.push(p.alt>0?sky(p.az,p.alt):null); } return out; };
    const strokeSplit = (arr,color,width,dash) => { let seg=[]; arr.forEach(q=>{ if(q) seg.push(q); else { line(seg,color,width,dash); seg=[]; } }); line(seg,color,width,dash); };
    for (const [m,d,lbl] of [[6,21,'Jun 21'],[12,21,'Dec 21']]){
      const [a,b] = dayBounds(Y,m,d,tz); const arr = pathFor(a,b); strokeSplit(arr, C.season, 1.2, [5,4]);
      // label each solstice path 4 hours after noon, offset outward, so it clears today's hour labels
      const nt = solarNoon(a,b,lat,lon), lp = sunPos(nt + 4*3600000, lat, lon);
      if (lp.alt>0) text(sky(lp.az + (lat>=0 ? 9 : -9), lp.alt + (m===6 ? 6 : -6)), lbl, C.muted, 10, 600);
    }
    // today's path with hour dots
    strokeSplit(pathFor(t0,t1), C.path, 2.6);
    const hf = new Intl.DateTimeFormat('en-US',{timeZone:tz,hour:'numeric',hourCycle:'h23'});
    for (let u=Math.ceil(t0/3600000)*3600000; u<t1; u+=3600000){
      const p=sunPos(u,lat,lon); if (p.alt<=0) continue;
      const hr=+hf.format(new Date(u))%24, lbl = hr===0?'12a':hr===12?'12p':hr<12?hr+'a':(hr-12)+'p';
      const q=sky(p.az,p.alt); dot(q,3.2,C.path); text(sky(p.az,p.alt+5), lbl, C.path, 11, 600);
    }
    // sunrise / sunset bearings on the ground
    const ev = crossings(t0,t1,lat,lon,-0.833), O = project(0,0,0);
    if (ev.rise) line([O, sky(sunPos(ev.rise,lat,lon).az,0)], C.rise, 2.2);
    if (ev.set)  line([O, sky(sunPos(ev.set,lat,lon).az,0)], C.set, 2.2);
    // current sun: ground bearing, vertical drop, shadow, disc
    const p = sunPos(t,lat,lon);
    if (p.alt > 0){
      const foot = sky(p.az,0,Math.cos(p.alt*R)), sun = sky(p.az,p.alt);
      line([O, sky(p.az,0)], C.sunLine, 2);
      line([foot, sun], C.sunLine, 1.2, [3,3]);
      const sh = Math.min(0.95, 0.25/Math.tan(p.alt*R)), sa=(p.az+180)*R;
      line([O, project(sh*Math.sin(sa), sh*Math.cos(sa), 0)], C.shadow, 4);
      dot(sun, 12, C.sun, C.sunEdge);
    } else {
      const sun = sky(p.az, p.alt); dot(sun, 9, C.below, C.sunEdge);
    }
    dot(O, 4, C.fg);
  }
  const gp = (a, r) => [r*Math.sin(a*R), r*Math.cos(a*R), 0];

  // touch / mouse: drag to spin and tilt, pinch or wheel to zoom
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId,{x:e.clientX,y:e.clientY}); });
  canvas.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId), cur = {x:e.clientX,y:e.clientY};
    if (pts.size === 1){ yaw = (yaw - (cur.x-prev.x)*0.45 + 360) % 360; pitch = Math.max(2, Math.min(89, pitch + (cur.y-prev.y)*0.3)); }
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
    draw,
    setView(name){ if (name==='top'){ pitch=89; yaw=0; } else if (name==='side'){ pitch=12; yaw=180; } else { pitch=28; yaw=180; zoom=1; } draw(); }
  };
}
