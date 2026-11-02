/* Sky picture for the Dashboard banner: a drawn landscape whose sky follows the real sun and moon for the chosen place
   and time. The view faces the equator (south in the northern hemisphere): east on the left, west on the right.
   Dawn colours, a blue day, the sunset glow, then night with stars. Needs sunPos (sun.js), moonPos and moonLitPath (moon.js). */
(function(){
  // small seeded random numbers, so the hills, tree and stars come out the same every time
  function rng(seed){ return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const r0 = rng(7);
  const STARS = Array.from({length: 150}, () => [r0(), r0()*0.66, r0()*1.1 + 0.4, r0()]);
  const HILL_FAR = Array.from({length: 10}, () => r0()), HILL_NEAR = Array.from({length: 8}, () => r0());

  // sky colour at the top and at the horizon, by the sun's height (degrees)
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i+2), 16));
  const KEYS = [[-90,'#020309','#05070f'], [-18,'#03050c','#0a0f22'], [-12,'#060a1c','#1b2350'], [-6,'#0f1b3e','#55407a'],
                [-2,'#213a6c','#d2725a'], [2,'#33598f','#f2a25a'], [8,'#3a6eae','#f0c890'], [20,'#3d7cc4','#b4d0ea'], [90,'#2a66b8','#9cc4ea']]
    .map(([a, t, b]) => [a, hex(t), hex(b)]);
  const mix = (a, b, f) => a.map((v, i) => Math.round(v + (b[i] - v)*f));
  const rgba = (c, al = 1) => `rgba(${c[0]},${c[1]},${c[2]},${al})`;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function skyAt(alt){
    for (let i = 1; i < KEYS.length; i++) if (alt <= KEYS[i][0]){
      const [a0, t0, h0] = KEYS[i-1], [a1, t1, h1] = KEYS[i], f = (alt - a0)/(a1 - a0);
      return [mix(t0, t1, f), mix(h0, h1, f)];
    }
    return [KEYS[KEYS.length-1][1], KEYS[KEYS.length-1][2]];
  }
  // left-right position from the compass direction: east on the left, west on the right, the equator side in the middle
  const xOf = (az, lat, w) => { const d = lat >= 0 ? az - 180 : ((az + 180) % 360) - 180; return w*(0.5 + (lat >= 0 ? d : -d)/260); };

  // the near ground, a big tree and a small one, drawn once per size and colour into a spare canvas
  const sil = {key: '', cv: document.createElement('canvas')};
  function tree(g, x, y, s, seed){
    const r = rng(seed), tips = [];
    g.lineCap = 'round';
    (function branch(x0, y0, len, ang, wid, depth){
      const x1 = x0 + Math.cos(ang)*len, y1 = y0 - Math.sin(ang)*len;
      g.lineWidth = wid; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      if (depth <= 2) tips.push([x1, y1, depth]);
      if (depth > 0){ const n = 2 + (r() < 0.45 ? 1 : 0);
        for (let k = 0; k < n; k++) branch(x1, y1, len*(0.66 + r()*0.16), ang + (k - (n-1)/2)*0.62 + (r() - 0.5)*0.5, wid*0.64, depth - 1); }
    })(x, y, s*0.3, Math.PI/2, s*0.075, 5);
    for (const [bx, by, d] of tips){ g.beginPath(); g.ellipse(bx, by, s*(0.05 + r()*0.04 + d*0.012), s*(0.035 + r()*0.03 + d*0.01), 0, 0, 7); g.fill(); }
  }
  function silhouette(w, h, horizon, col){
    const key = [w, h, col].join('|'); if (sil.key === key) return sil.cv; sil.key = key;
    const cv = sil.cv; cv.width = w; cv.height = h;
    const g = cv.getContext('2d'); g.fillStyle = g.strokeStyle = col;
    // near ground: a gentle rise across the bottom
    const base = horizon + h*0.07; g.beginPath(); g.moveTo(0, h);
    for (let i = 0; i < HILL_NEAR.length; i++){ const x = w*i/(HILL_NEAR.length - 1), y = base + (HILL_NEAR[i] - 0.5)*h*0.05;
      i ? g.quadraticCurveTo(x - w/(HILL_NEAR.length - 1)/2, y + h*0.01, x, y) : g.lineTo(x, y); }
    g.lineTo(w, h); g.closePath(); g.fill();
    // grass along the near edge
    const gr = rng(11); g.lineWidth = 1;
    for (let x = 0; x < w; x += 3){ const i = x/w*(HILL_NEAR.length - 1), k = Math.min(HILL_NEAR.length - 2, Math.floor(i)), f = i - k;
      const y = base + ((HILL_NEAR[k] + (HILL_NEAR[k+1] - HILL_NEAR[k])*f) - 0.5)*h*0.05 + 2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (gr() - 0.5)*4, y - 2 - gr()*h*0.025); g.stroke(); }
    const s = Math.min(horizon*0.78, w*0.42);             // the big tree's crown stays inside the picture
    tree(g, w*0.82, base + h*0.03, s, 42);
    tree(g, w*0.1, base + h*0.015, s*0.42, 9);
    return cv;
  }

  window.drawScene = function(cv, st){
    // on a phone the picture sits behind the work-light text only (Sky at a Glance is its own card below it)
    const work = cv.parentElement.querySelector('.d-work'), narrow = !window.matchMedia('(min-width:700px)').matches;
    const want = narrow && work ? (work.offsetTop + work.offsetHeight + 14) + 'px' : '';
    if (cv.style.height !== want) cv.style.height = want;
    const dpr = Math.min(2, window.devicePixelRatio || 1), cw = cv.clientWidth, ch = cv.clientHeight; if (!cw || !ch) return;
    const w = Math.round(cw*dpr), h = Math.round(ch*dpr);
    if (cv.width !== w || cv.height !== h){ cv.width = w; cv.height = h; }
    const g = cv.getContext('2d'), {t, lat, lon} = st;
    const sp = sunPos(t, lat, lon), alt = sp.altGeo != null ? sp.altGeo : sp.alt, [top, hor] = skyAt(alt);
    const horizon = h*0.72, lift = horizon - h*0.1;
    // sky
    const sky = g.createLinearGradient(0, 0, 0, horizon); sky.addColorStop(0, rgba(top)); sky.addColorStop(1, rgba(hor));
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    // stars fade in after civil dusk
    const starA = clamp((-alt - 6)/10, 0, 1);
    if (starA > 0) for (const [sx, sy, sr, tw] of STARS){ g.fillStyle = `rgba(230,236,255,${(0.35 + tw*0.65)*starA})`; g.fillRect(sx*w, sy*horizon, sr*dpr, sr*dpr); }
    // sun glow (strongest near the horizon) and the sun
    const sx = xOf(sp.az, lat, w), sy = horizon - clamp(alt, -10, 90)/70*lift;
    const glowA = 0.6*Math.exp(-Math.pow((alt - 1)/8, 2)) + (alt > 0 ? 0.14 : 0);
    if (glowA > 0.02){
      const gy = Math.min(sy, horizon + h*0.05), rad = w*0.55, gl = g.createRadialGradient(sx, gy, 0, sx, gy, rad);
      gl.addColorStop(0, `rgba(255,190,110,${glowA})`); gl.addColorStop(0.35, `rgba(255,140,70,${glowA*0.45})`); gl.addColorStop(1, 'rgba(255,140,70,0)');
      g.fillStyle = gl; g.fillRect(0, 0, w, h);
    }
    if (alt > -1){
      const sr = Math.max(7*dpr, h*0.05), warm = clamp(alt/20, 0, 1);
      const halo = g.createRadialGradient(sx, sy, 0, sx, sy, sr*3.2); halo.addColorStop(0, 'rgba(255,240,200,.85)'); halo.addColorStop(1, 'rgba(255,220,150,0)');
      g.fillStyle = halo; g.beginPath(); g.arc(sx, sy, sr*3.2, 0, 7); g.fill();
      g.fillStyle = rgba(mix([255, 176, 80], [255, 250, 225], warm)); g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.fill();
    }
    // the moon, with its real phase, dimmer in daylight
    const mp = moonPos(t, lat, lon);
    if (mp.alt > -1 && typeof moonLitPath === 'function'){
      const mx = xOf(mp.az, lat, w), my = horizon - clamp(mp.alt, -2, 90)/70*lift, mr = Math.max(6*dpr, h*0.035), day = clamp((alt + 4)/10, 0, 1);
      if (day < 1){ const mg = g.createRadialGradient(mx, my, 0, mx, my, mr*4); mg.addColorStop(0, `rgba(210,220,255,${0.25*(1 - day)*mp.lit})`); mg.addColorStop(1, 'rgba(210,220,255,0)');
        g.fillStyle = mg; g.beginPath(); g.arc(mx, my, mr*4, 0, 7); g.fill(); }
      if (day < 0.3){ g.fillStyle = `rgba(20,26,44,${0.55*(1 - day/0.3)})`; g.beginPath(); g.arc(mx, my, mr, 0, 7); g.fill(); }   // the dark part shows only at night
      if (mp.lit > 0.01){ g.fillStyle = `rgba(232,236,246,${0.95 - day*0.4})`; g.fill(new Path2D(moonLitPath(mp.lit, mp.waxing, mx, my, mr))); }
    }
    // land colours: dark silhouettes at dawn, dusk and night; deep green in full day
    const green = clamp((alt - 4)/16, 0, 1), land = mix([8, 10, 15], [26, 48, 31], green);
    const far = mix(land, hor, 0.38 - green*0.12);
    g.fillStyle = rgba(far); g.beginPath(); g.moveTo(0, h);
    for (let i = 0; i < HILL_FAR.length; i++){ const x = w*i/(HILL_FAR.length - 1), y = horizon - h*0.02 + (HILL_FAR[i] - 0.5)*h*0.07;
      i ? g.quadraticCurveTo(x - w/(HILL_FAR.length - 1)/2, y - h*0.015, x, y) : g.lineTo(x, y); }
    g.lineTo(w, h); g.closePath(); g.fill();
    // a soft haze where the land meets the sky
    const hz = g.createLinearGradient(0, horizon - h*0.08, 0, horizon + h*0.06);
    hz.addColorStop(0, rgba(hor, 0)); hz.addColorStop(0.6, rgba(hor, 0.28)); hz.addColorStop(1, rgba(hor, 0));
    g.fillStyle = hz; g.fillRect(0, horizon - h*0.08, w, h*0.14);
    g.drawImage(silhouette(w, h, horizon, rgba(land)), 0, 0);
    // shade the left and bottom so the text on top stays easy to read
    const sh = g.createLinearGradient(0, 0, w, 0); sh.addColorStop(0, 'rgba(4,6,12,.62)'); sh.addColorStop(0.55, 'rgba(4,6,12,.18)'); sh.addColorStop(1, 'rgba(4,6,12,0)');
    g.fillStyle = sh; g.fillRect(0, 0, w, h);
    const sb = g.createLinearGradient(0, h*0.6, 0, h); sb.addColorStop(0, 'rgba(4,6,12,0)'); sb.addColorStop(1, 'rgba(4,6,12,.45)');
    g.fillStyle = sb; g.fillRect(0, h*0.6, w, h*0.4);
  };
})();
