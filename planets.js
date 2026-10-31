/* Planets and bright stars. Needs sun.js (R, D, refraction) and moon.js (norm360).
   Planets: JPL "Keplerian Elements for Approximate Positions of the Major Planets" (Standish), 1800-2050 table,
   J2000 ecliptic; geocentric with light-time; precessed to date. Accuracy: a few arcminutes. */

const PLANET_EL = {  // a(AU), e, I, L, long.peri, long.node  and their rates per Julian century
  Mercury: [[0.38709927,0.20563593,7.00497902,252.25032350,77.45779628,48.33076593],[0.00000037,0.00001906,-0.00594749,149472.67411175,0.16047689,-0.12534081]],
  Venus:   [[0.72333566,0.00677672,3.39467605,181.97909950,131.60246718,76.67984255],[0.00000390,-0.00004107,-0.00078890,58517.81538729,0.00268329,-0.27769418]],
  Earth:   [[1.00000261,0.01671123,-0.00001531,100.46457166,102.93768193,0],[0.00000562,-0.00004392,-0.01294668,35999.37244981,0.32327364,0]],
  Mars:    [[1.52371034,0.09339410,1.84969142,-4.55343205,-23.94362959,49.55953891],[0.00001847,0.00007882,-0.00813131,19140.30268499,0.44441088,-0.29257343]],
  Jupiter: [[5.20288700,0.04838624,1.30439695,34.39644051,14.72847983,100.47390909],[-0.00011607,-0.00013253,-0.00183714,3034.74612775,0.21252668,0.20469106]],
  Saturn:  [[9.53667594,0.05386179,2.48599187,49.95424423,92.59887831,113.66242448],[-0.00125060,-0.00050991,0.00193609,1222.49362201,-0.41897216,-0.28867794]]
};
const PLANET_STYLE = {Mercury:'#c9b49a', Venus:'#fff3c4', Mars:'#ff7a52', Jupiter:'#f4d9a8', Saturn:'#e8cf7a'};

function helio(name, T){  // heliocentric J2000 ecliptic xyz (AU)
  const [b, r] = PLANET_EL[name], el = b.map((v,i) => v + r[i]*T);
  const [a, e, I, L, wbar, Om] = el, w = wbar - Om;
  let M = ((L - wbar) % 360 + 540) % 360 - 180, Er = M*R + e*Math.sin(M*R);
  for (let k=0;k<8;k++) Er -= (Er - e*Math.sin(Er) - M*R) / (1 - e*Math.cos(Er));
  const xp = a*(Math.cos(Er) - e), yp = a*Math.sqrt(1 - e*e)*Math.sin(Er);
  const cw=Math.cos(w*R), sw=Math.sin(w*R), cO=Math.cos(Om*R), sO=Math.sin(Om*R), cI=Math.cos(I*R), sI=Math.sin(I*R);
  return [ (cw*cO - sw*sO*cI)*xp + (-sw*cO - cw*sO*cI)*yp,
           (cw*sO + sw*cO*cI)*xp + (-sw*sO + cw*cO*cI)*yp,
           (sw*sI)*xp + (cw*sI)*yp ];
}
// equatorial of date (deg) -> horizon (az, apparent alt)
function eq2altaz(ms, raDeg, decDeg, lat, lon){
  const jd = ms/86400000 + 2440587.5, Tu = (jd - 2451545)/36525;
  const gmst = norm360(280.46061837 + 360.98564736629*(jd - 2451545) + 0.000387933*Tu*Tu);
  const H = (gmst + lon - raDeg)*R, L = lat*R, d = decDeg*R;
  const alt = Math.asin(Math.sin(L)*Math.sin(d) + Math.cos(L)*Math.cos(d)*Math.cos(H))*D;
  const az = norm360(Math.atan2(Math.sin(H), Math.cos(H)*Math.sin(L) - Math.tan(d)*Math.cos(L))*D + 180);
  return {az, altGeo: alt, alt: alt + refraction(alt)};
}
function ecl2eqDate(lamDeg, betaDeg, T){   // ecliptic of date -> equatorial of date
  const eps = (23.439291 - 0.0130042*T)*R, l = lamDeg*R, b = betaDeg*R;
  const ra = norm360(Math.atan2(Math.sin(l)*Math.cos(eps) - Math.tan(b)*Math.sin(eps), Math.cos(l))*D);
  const dec = Math.asin(Math.sin(b)*Math.cos(eps) + Math.cos(b)*Math.sin(eps)*Math.sin(l))*D;
  return [ra, dec];
}
function planetPos(name, ms, lat, lon){
  const T = ((ms + 69000)/86400000 + 2440587.5 - 2451545)/36525;
  const E = helio('Earth', T);
  let P = helio(name, T), g = P.map((v,i) => v - E[i]), dist = Math.hypot(...g);
  P = helio(name, T - dist*0.0057755/36525); g = P.map((v,i) => v - E[i]); dist = Math.hypot(...g);  // light-time
  const lamJ2000 = Math.atan2(g[1], g[0])*D, beta = Math.atan2(g[2], Math.hypot(g[0], g[1]))*D;
  const lam = norm360(lamJ2000 + 1.396971*T);                       // precession in longitude to date
  const [ra, dec] = ecl2eqDate(lam, beta, T);
  return {name, lam, beta, dist, ra, dec, ...eq2altaz(ms, ra, dec, lat, lon)};
}
function planetCrossings(name, t0, t1, lat, lon){
  const f = t => planetPos(name,t,lat,lon).altGeo + 0.5667, step = 20*60000, rises=[], sets=[];
  let a=t0, fa=f(a);
  while (a < t1){ const b=Math.min(a+step,t1), fb=f(b);
    if ((fa<0)!==(fb<0)){ let lo=a, hi=b, flo=fa; for (let k=0;k<22;k++){ const m=(lo+hi)/2, fm=f(m); if ((fm<0)===(flo<0)){lo=m;flo=fm;} else hi=m; } (fa<0?rises:sets).push((lo+hi)/2); }
    a=b; fa=fb; }
  return {rise: rises[0] ?? null, set: sets[0] ?? null};
}
const PLANETS = ['Mercury','Venus','Mars','Jupiter','Saturn'];

// ---------- bright stars (J2000 RA/Dec, degrees; magnitude) ----------
const STARS = [
  ['Sirius',101.287,-16.716,-1.46],['Arcturus',213.915,19.182,-0.05],['Vega',279.234,38.784,0.03],['Capella',79.172,45.998,0.08],
  ['Rigel',78.634,-8.202,0.13],['Procyon',114.825,5.225,0.34],['Betelgeuse',88.793,7.407,0.42],['Altair',297.696,8.868,0.77],
  ['Aldebaran',68.980,16.509,0.86],['Antares',247.352,-26.432,0.96],['Spica',201.298,-11.161,0.97],['Pollux',116.329,28.026,1.14],
  ['Fomalhaut',344.413,-29.622,1.16],['Deneb',310.358,45.280,1.25],['Regulus',152.093,11.967,1.35],['Castor',113.650,31.888,1.58],
  ['Polaris',37.955,89.264,1.98]
];
const DIPPER = [['Dubhe',165.932,61.751],['Merak',165.460,56.383],['Phecda',178.458,53.695],['Megrez',183.857,57.033],
                ['Alioth',193.507,55.960],['Mizar',200.981,54.925],['Alkaid',206.885,49.313]];
const DIPPER_LINES = [['Alkaid','Mizar'],['Mizar','Alioth'],['Alioth','Megrez'],['Megrez','Dubhe'],['Dubhe','Merak'],['Merak','Phecda'],['Phecda','Megrez']];
function starPos(raJ, decJ, ms, lat, lon){       // J2000 -> date (rigorous-enough precession for a few decades), then horizon
  const T = (ms/86400000 + 2440587.5 - 2451545)/36525;
  const z = (0.6406161*T)*R, zeta = (0.6406161*T)*R, th = (0.5567530*T)*R, a = raJ*R, d = decJ*R;
  const A = Math.cos(d)*Math.sin(a + zeta), B = Math.cos(th)*Math.cos(d)*Math.cos(a + zeta) - Math.sin(th)*Math.sin(d);
  const Cc = Math.sin(th)*Math.cos(d)*Math.cos(a + zeta) + Math.cos(th)*Math.sin(d);
  const ra = norm360((Math.atan2(A, B) + z)*D), dec = Math.asin(Math.max(-1, Math.min(1, Cc)))*D;
  return eq2altaz(ms, ra, dec, lat, lon);
}
