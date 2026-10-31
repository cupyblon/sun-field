/* Phone orientation, shared by any view that follows the phone. Needs sun.js (R, D).
   createMotion({getDecl}) -> {start() (call from a button tap), axes() -> {r,u,c} or null, heading(), running}
   Axes are unit vectors in the Earth frame (x=East, y=North, z=Up): r = screen right, u = screen top, c = camera (out the back).
   iPhone: steer with the gyro (smooth at every angle) and use the compass only to set true north while the
   phone is upright, so the heading does not flip when the phone tips toward flat. */
function createMotion(opts){
  const getDecl = opts.getDecl || (() => 0);
  let ori = null, smooth = null, iosOffset = null, started = false;
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
    if (e.alpha == null || e.beta == null || e.gamma == null) return;
    const decl = getDecl(), H = e.webkitCompassHeading;
    if (typeof H === 'number' && H >= 0){
      const upright = e.beta > 50 && e.beta < 130 && Math.abs(e.gamma) < 40;
      if (upright){
        const camAz = azOf(col(matrix(e.alpha, e.beta, e.gamma), 2).map(x=>-x));
        const target = wrap(camAz - (H + decl));
        iosOffset = iosOffset === null ? target : wrap(iosOffset + wrap(target - iosOffset)*0.05);
      } else if (iosOffset === null){
        iosOffset = wrap((360 - (H + decl)) - e.alpha);
      }
      ori = {alpha: e.alpha + iosOffset, beta: e.beta, gamma: e.gamma};
      return;
    }
    if (!absolute && !e.absolute) return;
    ori = {alpha: e.alpha - decl, beta: e.beta, gamma: e.gamma};
  }
  async function start(){
    if (started) return;
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function'){
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') throw new Error('Motion access was declined. On iPhone: Settings › Safari › Motion & Orientation Access, then reload.');
    }
    if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', e=>onOrient(e,true));
    else window.addEventListener('deviceorientation', e=>onOrient(e,false));
    started = true;
  }
  function axes(){
    if (!ori) return null;
    const m = matrix(ori.alpha, ori.beta, ori.gamma);
    const raw = {r: col(m,0), u: col(m,1), c: col(m,2).map(x=>-x)};
    if (!smooth) smooth = raw;
    else for (const k of ['r','u','c']) smooth[k] = smooth[k].map((x,i)=> x*0.75 + raw[k][i]*0.25);
    return smooth;
  }
  // Direction the phone "faces": the top edge when flat, the camera when upright, blended in between.
  function facing(){
    const a = axes(); if (!a) return null;
    const fx = a.u[0] + a.c[0], fy = a.u[1] + a.c[1];
    const camAlt = Math.asin(Math.max(-1, Math.min(1, a.c[2])))*D;
    return {heading: (Math.hypot(fx,fy) < 1e-3) ? null : azOf([fx,fy,0]), camAlt};
  }
  return { start, axes, facing, get started(){ return started; } };
}
