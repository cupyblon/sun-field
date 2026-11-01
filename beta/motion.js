/* Phone orientation, shared by any view that follows the phone. Needs sun.js (R, D).
   createMotion({getDecl, store}) -> {start(), use(who, on), axes(), facing(), spread(), reset(), stat, cal, setCal()}
   start() asks for permission (call it from a button tap). use('dome'|'ar'|'cal', true/false) says who needs readings;
   the sensor listener runs only while at least one view uses it, which saves battery.
   Axes are unit vectors in the Earth frame (x=East, y=North, z=Up): r = screen right, u = screen top, c = camera (out the back).
   iPhone: steer with the gyro (smooth at every angle) and use the compass only to set true north while the
   phone is upright, so the heading does not flip when the phone tips toward flat. */
// What to tell someone whose browser won't give motion readings, in their browser's own terms.
function sensorHelp(){
  const ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua), samsung = /SamsungBrowser/.test(ua);
  if (navigator.brave) return android
    ? 'Brave is blocking the motion sensors. Tap ⋮ › Settings › Site settings › Motion sensors › Allow (or tap the lion icon and turn Shields down for this site), then reload. Chrome works too.'
    : 'Brave is blocking the motion sensors. Tap the lion icon and turn Shields down for this site, then reload, or open the page in Safari.';
  if (ios) return 'Motion access was declined. On iPhone: Settings › Safari › Motion & Orientation Access, then reload.';
  if (android) return samsung
    ? 'Motion sensors are blocked. In Samsung Internet: ☰ › Settings › Sites and downloads › Site permissions › Motion sensors › Allow, then reload. Chrome works too.'
    : 'Motion sensors are blocked. Tap ⋮ › Settings › Site settings › Motion sensors › Allow, then reload.';
  return 'This device is not giving motion readings. Live view and the Camera overlay need a phone or tablet with a compass.';
}
// A computer with a mouse and no touch screen has no compass or tilt sensors.
const NO_SENSORS = navigator.maxTouchPoints === 0 && window.matchMedia('(pointer:fine)').matches && !/Android|iPhone|iPad/.test(navigator.userAgent);

function createMotion(opts){
  const getDecl = opts.getDecl || (() => 0), store = opts.store;
  let ori = null, smooth = null, iosOffset = null, granted = false, last = null, handler = null, evName = null;
  const users = new Set();
  // diagnostics: how many readings arrived, last compass value, whether we're running without true north,
  // the phone's own compass accuracy (iPhone only, degrees), and how much the phone has been turned (for the figure-8 meter)
  const stat = {events: 0, lastH: undefined, relative: false, accuracy: null, moved: 0};
  const recent = [];                                   // last ~1.5 s of readings, to tell when the phone is held still
  // Sky correction: set by Align (crosshair on the sun, moon or a planet). Shared by the Camera and the live Dome.
  let cal = Object.assign({dAz:0, dAlt:0}, store ? store.get('arCal', {}) : {});
  const wrap = x => ((x % 360) + 540) % 360 - 180;
  const col = (m,i) => [m[0][i], m[1][i], m[2][i]];
  const azOf = v => ((Math.atan2(v[0], v[1])*D) + 360) % 360;
  function matrix(a,b,g){
    a*=R; b*=R; g*=R;
    const ca=Math.cos(a), sa=Math.sin(a), cb=Math.cos(b), sb=Math.sin(b), cg=Math.cos(g), sg=Math.sin(g);
    return [[ca*cg - sa*sb*sg, -sa*cb, ca*sg + sa*sb*cg],
            [sa*cg + ca*sb*sg,  ca*cb, sa*sg - ca*sb*cg],
            [-cb*sg,            sb,    cb*cg]];
  }
  function onOrient(e, absolute){
    if (e.alpha == null || e.beta == null || e.gamma == null) return;   // blocked sensors send empty events
    stat.events++;
    const decl = getDecl(), H = e.webkitCompassHeading, acc = e.webkitCompassAccuracy;
    stat.lastH = H; stat.accuracy = (typeof acc === 'number' && acc >= 0) ? acc : null;
    if (last) stat.moved += Math.min(30, Math.abs(wrap(e.alpha - last[0])) + Math.abs(e.beta - last[1]) + Math.abs(e.gamma - last[2]));
    last = [e.alpha, e.beta, e.gamma];
    const now = performance.now(); recent.push([now, e.alpha, e.beta, e.gamma]); while (recent.length && now - recent[0][0] > 1500) recent.shift();
    if (typeof H === 'number' && H >= 0){
      const upright = e.beta > 50 && e.beta < 130 && Math.abs(e.gamma) < 40;
      if (upright){
        const camAz = azOf(col(matrix(e.alpha, e.beta, e.gamma), 2).map(x=>-x));
        const target = wrap(camAz - (H + decl));
        iosOffset = iosOffset === null ? target : wrap(iosOffset + wrap(target - iosOffset)*0.05);
      } else if (iosOffset === null){
        iosOffset = wrap((360 - (H + decl)) - e.alpha);
      }
      stat.relative = false;
      ori = {alpha: e.alpha + iosOffset, beta: e.beta, gamma: e.gamma};
      return;
    }
    if (absolute || e.absolute){ stat.relative = false; ori = {alpha: e.alpha - decl, beta: e.beta, gamma: e.gamma}; return; }
    // No compass yet (iPhone reports -1 or nothing until it settles): still follow the phone's motion,
    // keeping the last known north correction if we had one, and flag that directions may be off.
    stat.relative = iosOffset === null;
    ori = {alpha: e.alpha + (iosOffset || 0), beta: e.beta, gamma: e.gamma};
  }
  async function start(){
    if (granted) return;
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function'){
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') throw new Error(sensorHelp());
    }
    granted = true;
  }
  function attach(){
    if (handler || !granted) return;
    evName = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    handler = e => onOrient(e, evName === 'deviceorientationabsolute');
    window.addEventListener(evName, handler);
  }
  function detach(){
    if (!handler) return;
    window.removeEventListener(evName, handler); handler = null; ori = null; smooth = null; last = null; recent.length = 0;
  }
  function use(who, on){ if (on) users.add(who); else users.delete(who); if (users.size) attach(); else detach(); }
  function axes(){
    if (!ori) return null;
    const m = matrix(ori.alpha, ori.beta, ori.gamma);
    const raw = {r: col(m,0), u: col(m,1), c: col(m,2).map(x=>-x)};
    if (!smooth) smooth = raw;
    else for (const k of ['r','u','c']) smooth[k] = smooth[k].map((x,i)=> x*0.75 + raw[k][i]*0.25);
    return smooth;
  }
  // Direction the phone "faces": the top edge when flat (screen up), the camera when upright, and the
  // camera again when tipped back toward the sky (then the top edge points behind you, so it is subtracted).
  function facing(){
    const a = axes(); if (!a) return null;
    const fx = a.c[0] - a.c[2]*a.u[0], fy = a.c[1] - a.c[2]*a.u[1];
    const camAlt = Math.asin(Math.max(-1, Math.min(1, a.c[2])))*D;
    return {heading: (Math.hypot(fx,fy) < 1e-3) ? null : azOf([fx,fy,0]), camAlt};
  }
  // how much the phone wobbled over the last 1.5 s (degrees); small = held still
  function spread(){
    if (recent.length < 5) return null;
    let s = 0; for (const k of [1,2,3]){ const ref = recent[0][k]; let lo = 0, hi = 0;
      for (const r of recent){ const d = wrap(r[k] - ref); lo = Math.min(lo, d); hi = Math.max(hi, d); } s = Math.max(s, hi - lo); }
    return s;
  }
  // forget Sun Field's own idea of north and start fresh (the phone's compass hardware is calibrated by the phone itself)
  function reset(){ iosOffset = null; smooth = null; stat.moved = 0; recent.length = 0; last = null; }
  function setCal(v){ cal = Object.assign({dAz:0, dAlt:0}, v); if (store) store.set('arCal', cal); }
  return { start, use, axes, facing, stat, spread, reset, setCal, get cal(){ return cal; } };
}
