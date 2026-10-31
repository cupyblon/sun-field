/* Moon and Milky Way engine. Needs sun.js (R, D, sunCore, sunPos, dayBounds, refraction).
   Moon: Meeus, Astronomical Algorithms ch. 47 (main periodic terms), topocentric altitude with refraction.
   Phases: times when Moon-minus-Sun ecliptic longitude hits 0/90/180/270 degrees.
   Milky Way core: Sgr A* (J2000 RA 266.405, Dec -29.008), precessed to date. */

const MOON_LR = [ // D, M, M', F, sin coeff for longitude (1e-6 deg), cos coeff for distance (1e-3 km)
 [0,0,1,0,6288774,-20905355],[2,0,-1,0,1274027,-3699111],[2,0,0,0,658314,-2955968],[0,0,2,0,213618,-569925],
 [0,1,0,0,-185116,48888],[0,0,0,2,-114332,-3149],[2,0,-2,0,58793,246158],[2,-1,-1,0,57066,-152138],
 [2,0,1,0,53322,-170733],[2,-1,0,0,45758,-204586],[0,1,-1,0,-40923,-129620],[1,0,0,0,-34720,108743],
 [0,1,1,0,-30383,104755],[2,0,0,-2,15327,10321],[0,0,1,2,-12528,0],[0,0,1,-2,10980,79661],
 [4,0,-1,0,10675,-34782],[0,0,3,0,10034,-23210],[4,0,-2,0,8548,-21636],[2,1,-1,0,-7888,24208],
 [2,1,0,0,-6766,30824],[1,0,-1,0,-5163,-8379],[1,1,0,0,4987,-16675],[2,-1,1,0,4036,-12831],
 [2,0,2,0,3994,-10445],[4,0,0,0,3861,-11650],[2,0,-3,0,3665,14403],[0,1,-2,0,-2689,-7003],
 [2,0,-1,2,-2602,0],[2,-1,-2,0,2390,10056],[1,0,1,0,-2348,6322],[2,-2,0,0,2236,-9884],
 [0,1,2,0,-2120,5751],[0,2,0,0,-2069,0],[2,-2,-1,0,2048,-4950],[2,0,1,-2,-1773,4130],
 [2,0,0,2,-1595,0],[4,-1,-1,0,1215,-3958],[0,0,2,2,-1110,0],[3,0,-1,0,-892,3258],
 [2,1,1,0,-810,2616],[4,-1,-2,0,759,-1897],[0,2,-1,0,-713,-2117],[2,2,-1,0,-700,2354],
 [2,1,-2,0,691,0],[2,-1,0,-2,596,0],[4,0,1,0,549,-1423],[0,0,4,0,537,-1117],
 [4,-1,0,0,520,-1571],[1,0,-2,0,-487,-1739],[2,1,0,-2,-399,0],[0,0,2,-2,-381,-4421],
 [1,1,1,0,351,0],[3,0,-2,0,-340,0],[4,0,-3,0,330,0],[2,-1,2,0,327,0],[0,2,1,0,-323,1165],
 [1,1,-1,0,299,0],[2,0,3,0,294,0],[2,0,-1,-2,0,8752]];
const MOON_B = [ // D, M, M', F, sin coeff for latitude (1e-6 deg)
 [0,0,0,1,5128122],[0,0,1,1,280602],[0,0,1,-1,277693],[2,0,0,-1,173237],[2,0,-1,1,55413],[2,0,-1,-1,46271],
 [2,0,0,1,32573],[0,0,2,1,17198],[2,0,1,-1,9266],[0,0,2,-1,8822],[2,-1,0,-1,8216],[2,0,-2,-1,4324],
 [2,0,1,1,4200],[2,1,0,-1,-3359],[2,-1,-1,1,2463],[2,-1,0,1,2211],[2,-1,-1,-1,2065],[0,1,-1,-1,-1870],
 [4,0,-1,-1,1828],[0,1,0,1,-1794],[0,0,0,3,-1749],[0,1,-1,1,-1565],[1,0,0,1,-1491],[0,1,1,1,-1475],
 [0,1,1,-1,-1410],[0,1,0,-1,-1344],[1,0,0,-1,-1335],[0,0,3,1,1107],[4,0,0,-1,1021],[4,0,-1,1,833],
 [0,0,1,-3,777],[4,0,-2,1,671],[2,0,0,-3,607],[2,0,2,-1,596],[2,-1,1,-1,491],[2,0,-2,1,-451],
 [0,0,3,-1,439],[2,0,2,1,422],[2,0,-3,-1,421],[2,1,-1,1,-366],[2,1,0,1,-351],[4,0,0,1,331],
 [2,-1,1,1,315],[2,-2,0,-1,302],[0,0,1,3,-283],[2,1,1,-1,-229],[1,1,0,-1,223],[1,1,0,1,223]];

const DELTA_T = 69;  // seconds, TT minus UT (good for the late 2020s)
const norm360 = x => ((x % 360) + 360) % 360;

// geocentric ecliptic longitude/latitude (deg) and distance (km) at UTC milliseconds
function moonEcliptic(ms){
  const T = ((ms + DELTA_T*1000)/86400000 + 2440587.5 - 2451545) / 36525;
  const Lp = 218.3164477 + 481267.88123421*T - 0.0015786*T*T + T**3/538841 - T**4/65194000;
  const Dm = 297.8501921 + 445267.1114034*T - 0.0018819*T*T + T**3/545868 - T**4/113065000;
  const M  = 357.5291092 + 35999.0502909*T - 0.0001536*T*T + T**3/24490000;
  const Mp = 134.9633964 + 477198.8675055*T + 0.0087414*T*T + T**3/69699 - T**4/14712000;
  const F  = 93.2720950 + 483202.0175233*T - 0.0036539*T*T - T**3/3526000 + T**4/863310000;
  const A1 = 119.75 + 131.849*T, A2 = 53.09 + 479264.290*T, A3 = 313.45 + 481266.484*T;
  const E = 1 - 0.002516*T - 0.0000074*T*T;
  let sl = 0, sr = 0, sb = 0;
  for (const [d,m,mp,f,cl,cr] of MOON_LR){
    const arg = (d*Dm + m*M + mp*Mp + f*F)*R, e = m === 0 ? 1 : Math.abs(m) === 1 ? E : E*E;
    sl += cl*e*Math.sin(arg); sr += cr*e*Math.cos(arg);
  }
  for (const [d,m,mp,f,cb] of MOON_B){
    const arg = (d*Dm + m*M + mp*Mp + f*F)*R, e = m === 0 ? 1 : Math.abs(m) === 1 ? E : E*E;
    sb += cb*e*Math.sin(arg);
  }
  sl += 3958*Math.sin(A1*R) + 1962*Math.sin((Lp - F)*R) + 318*Math.sin(A2*R);
  sb += -2235*Math.sin(Lp*R) + 382*Math.sin(A3*R) + 175*Math.sin((A1 - F)*R) + 175*Math.sin((A1 + F)*R)
        + 127*Math.sin((Lp - Mp)*R) - 115*Math.sin((Lp + Mp)*R);
  const om = 125.04452 - 1934.136261*T;
  const dpsi = -0.004778*Math.sin(om*R) - 0.000367*Math.sin(2*norm360(280.4665 + 36000.7698*T)*R);  // nutation in longitude
  return {lam: norm360(Lp + sl/1e6 + dpsi), beta: sb/1e6, dist: 385000.56 + sr/1000, T, om};
}

// topocentric azimuth/altitude (altitude includes refraction), phase, illumination
function moonPos(ms, lat, lon){
  const {lam, beta, dist, T, om} = moonEcliptic(ms);
  const eps = (23 + (26 + (21.448 - T*(46.815 + T*(0.00059 - T*0.001813)))/60)/60 + 0.00256*Math.cos(om*R))*R;
  const l = lam*R, b = beta*R;
  const ra = Math.atan2(Math.sin(l)*Math.cos(eps) - Math.tan(b)*Math.sin(eps), Math.cos(l));
  const dec = Math.asin(Math.sin(b)*Math.cos(eps) + Math.cos(b)*Math.sin(eps)*Math.sin(l));
  const jd = ms/86400000 + 2440587.5, Tu = (jd - 2451545)/36525;
  const gmst = norm360(280.46061837 + 360.98564736629*(jd - 2451545) + 0.000387933*Tu*Tu);
  const H = (gmst + lon)*R - ra, L = lat*R;
  const altGeoc = Math.asin(Math.sin(L)*Math.sin(dec) + Math.cos(L)*Math.cos(dec)*Math.cos(H))*D;
  const az = norm360(Math.atan2(Math.sin(H), Math.cos(H)*Math.sin(L) - Math.tan(dec)*Math.cos(L))*D + 180);
  const par = Math.asin(6378.14/dist)*D;                       // horizontal parallax, about 1 degree
  const altTopo = altGeoc - par*Math.cos(altGeoc*R);           // the Moon sits lower seen from Earth's surface
  // phase: elongation from the Sun, phase angle, fraction lit
  const sunLam = sunCore(ms).lam - 0.00569 - 0.00478*Math.sin((125.04 - 1934.136*T)*R);
  const elong = norm360(lam - sunLam);
  const psi = Math.acos(Math.cos(b)*Math.cos((lam - sunLam)*R));
  const i = Math.atan2(149598000*Math.sin(psi), dist - 149598000*Math.cos(psi));
  return {az, altGeoc, altTopo, alt: altTopo + refraction(altTopo), par, dist, elong, ra: norm360(ra*D), dec: dec*D,
          lit: (1 + Math.cos(i))/2, waxing: elong < 180};
}

// moonrise / moonset in [t0,t1): upper limb on the horizon with refraction (Meeus: h0 = 0.7275*parallax - 0.5667 for geocentric altitude)
function moonCrossings(t0, t1, lat, lon){
  const f = t => { const p = moonPos(t,lat,lon); return p.altGeoc - (0.7275*p.par - 0.5667); };
  const step = 10*60000, rises = [], sets = [];
  let a = t0, fa = f(a);
  while (a < t1){
    const b = Math.min(a+step, t1), fb = f(b);
    if ((fa < 0) !== (fb < 0)){
      let lo=a, hi=b, flo=fa;
      for (let k=0;k<25;k++){ const m=(lo+hi)/2, fm=f(m); if ((fm<0)===(flo<0)){lo=m;flo=fm;} else hi=m; }
      (fa < 0 ? rises : sets).push((lo+hi)/2);
    }
    a = b; fa = fb;
  }
  return {rise: rises[0] ?? null, set: sets[0] ?? null};
}

// next instants (after ms) of each principal phase; target elongation 0 new, 90 first quarter, 180 full, 270 last quarter
function nextPhases(ms){
  const out = [];
  for (const [deg, name] of [[270,'Last Quarter'],[0,'New Moon'],[90,'First Quarter'],[180,'Full Moon']]){
    const g = t => ((moonEcliptic(t).lam - (sunCore(t).lam - 0.00569) - deg) % 360 + 540) % 360 - 180;
    // step forward a day at a time until g crosses zero going upward, then bisect
    let a = ms, ga = g(a), found = null;
    for (let k=0;k<31;k++){
      const b = a + 86400000, gb = g(b);
      if (ga < 0 && gb >= 0 && gb - ga < 90){
        let lo=a, hi=b; for (let j=0;j<40;j++){ const m=(lo+hi)/2; if (g(m) < 0) lo=m; else hi=m; } found = (lo+hi)/2; break;
      }
      a = b; ga = gb;
    }
    out.push({name, deg, t: found});
  }
  return out.sort((x,y) => x.t - y.t);
}

// ---------- Milky Way core (Sgr A*) ----------
function mwCorePos(ms, lat, lon){
  const yrs = (ms/86400000 + 2440587.5 - 2451545)/365.25;
  let ra = 266.405, dec = -29.008;                                   // J2000
  ra += yrs*(3.075 + 1.336*Math.sin(ra*R)*Math.tan(dec*R))*15/3600;  // annual precession
  dec += yrs*20.04*Math.cos(ra*R)/3600;
  const jd = ms/86400000 + 2440587.5, Tu = (jd - 2451545)/36525;
  const gmst = norm360(280.46061837 + 360.98564736629*(jd - 2451545) + 0.000387933*Tu*Tu);
  const H = (gmst + lon - ra)*R, L = lat*R, d = dec*R;
  const alt = Math.asin(Math.sin(L)*Math.sin(d) + Math.cos(L)*Math.cos(d)*Math.cos(H))*D;
  const az = norm360(Math.atan2(Math.sin(H), Math.cos(H)*Math.sin(L) - Math.tan(d)*Math.cos(L))*D + 180);
  return {az, alt: alt + refraction(alt)};
}
// tonight's window: core above the horizon while the sky is astronomically dark (sun below -18)
function mwWindow(t0, t1, lat, lon){
  const ok = t => mwCorePos(t,lat,lon).alt > 0 && sunPos(t,lat,lon).altGeo < -18;
  let start = null, end = null, prev = ok(t0);
  if (prev) start = t0;
  for (let t=t0+20000; t<=t1+12*3600000; t+=20000){     // 20-second steps, run into the next morning
    const now = ok(t);
    if (now && !prev && start === null) start = t;
    if (!now && prev && start !== null){ end = t; break; }
    prev = now;
  }
  let best = null;
  if (start !== null && end !== null){
    for (let t=start; t<=end; t+=5*60000){ const p = mwCorePos(t,lat,lon); if (!best || p.alt > best.alt) best = {...p, t}; }
  }
  return {start, end, best};
}

// SVG path for the lit part of a moon disc (northern-hemisphere view: waxing is lit on the right)
function moonLitPath(lit, waxing, cx, cy, r){
  const rx = Math.abs(2*lit - 1)*r;
  const limb = waxing ? 1 : 0, term = waxing ? (lit > 0.5 ? 1 : 0) : (lit > 0.5 ? 0 : 1);
  return `M${cx},${cy-r} A${r},${r} 0 0 ${limb} ${cx},${cy+r} A${rx},${r} 0 0 ${term} ${cx},${cy-r} Z`;
}
function moonSVG(lit, waxing, size){
  const r = size/2 - 1, c = size/2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${c}" cy="${c}" r="${r}" fill="#1b2033" stroke="#4a5270" stroke-width="1"/>`
    + (lit > 0.01 ? `<path d="${moonLitPath(lit, waxing, c, c, r)}" fill="#dfe4ee"/>` : '') + `</svg>`;
}
