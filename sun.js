/* Sun engine: NOAA solar position, Meeus seasons. Shared by every view. */
const R = Math.PI/180, D = 180/Math.PI;
// Date/time formatters are slow to build (~80 µs each) and the app formats times constantly,
// so each distinct format is built once and reused. dtf({timeZone, hour, ...}) == new Intl.DateTimeFormat('en-US', ...)
const DTF = new Map();
function dtf(opts){ const k = JSON.stringify(opts); let f = DTF.get(k); if (!f){ f = new Intl.DateTimeFormat('en-US', opts); DTF.set(k, f); } return f; }
const DELTA_T = 69;  // seconds, TT minus UT (good for the late 2020s); shared by the sun, moon and planet engines
function sunCore(ms){
  const jd = ms/86400000 + 2440587.5, T = (jd-2451545)/36525;
  const L0 = ((280.46646 + T*(36000.76983 + T*0.0003032))%360+360)%360;
  const M = 357.52911 + T*(35999.05029 - 0.0001537*T);
  const e = 0.016708634 - T*(0.000042037 + 0.0000001267*T);
  const C = Math.sin(M*R)*(1.914602 - T*(0.004817+0.000014*T)) + Math.sin(2*M*R)*(0.019993-0.000101*T) + Math.sin(3*M*R)*0.000289;
  const om = 125.04 - 1934.136*T;
  const lam = L0 + C - 0.00569 - 0.00478*Math.sin(om*R);
  return {T,L0,M,e,om,lam};
}
function sunPos(ms, lat, lon){
  const {L0,M,e,om,lam,T} = sunCore(ms);
  const eps0 = 23 + (26 + (21.448 - T*(46.815 + T*(0.00059 - T*0.001813)))/60)/60;
  const eps = eps0 + 0.00256*Math.cos(om*R);
  const decl = Math.asin(Math.sin(eps*R)*Math.sin(lam*R))*D;
  const y = Math.tan(eps*R/2)**2;
  const eot = 4*D*(y*Math.sin(2*L0*R) - 2*e*Math.sin(M*R) + 4*e*y*Math.sin(M*R)*Math.cos(2*L0*R) - 0.5*y*y*Math.sin(4*L0*R) - 1.25*e*e*Math.sin(2*M*R));
  const utcMin = ((ms % 86400000) + 86400000) % 86400000 / 60000;
  const tst = ((utcMin + eot + 4*lon) % 1440 + 1440) % 1440;
  const ha = tst/4 - 180;
  const cz = Math.sin(lat*R)*Math.sin(decl*R) + Math.cos(lat*R)*Math.cos(decl*R)*Math.cos(ha*R);
  const altGeo = 90 - Math.acos(Math.max(-1,Math.min(1,cz)))*D;
  let az = Math.atan2(Math.sin(ha*R), Math.cos(ha*R)*Math.sin(lat*R) - Math.tan(decl*R)*Math.cos(lat*R))*D + 180;
  az = (az+360)%360;
  return {az, altGeo, alt: altGeo + refraction(altGeo), decl, eot};
}
function refraction(e){
  if (e > 85) return 0;
  const te = Math.tan(e*R); let r;
  if (e > 5) r = 58.1/te - 0.07/te**3 + 0.000086/te**5;
  else if (e > -0.575) r = 1735 + e*(-518.2 + e*(103.4 + e*(-12.79 + e*0.711)));
  else r = -20.774/te;
  return r/3600;
}
function tzOffset(ms, tz){
  const p = {}; dtf({timeZone:tz,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'})
    .formatToParts(new Date(ms)).forEach(x=>p[x.type]=x.value);
  return Date.UTC(+p.year, +p.month-1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms/1000)*1000;
}
function localToUtc(Y,M,Dd,h,mi,tz){
  const guess = Date.UTC(Y,M-1,Dd,h,mi);
  const o1 = tzOffset(guess,tz); let t = guess - o1;
  const o2 = tzOffset(t,tz);
  if (o2 !== o1){ const t2 = guess - o2; if (tzOffset(t2,tz) === o2) t = t2; } // nonexistent spring-forward times roll forward
  return t;
}
function dayBounds(Y,M,Dd,tz){
  const t0 = localToUtc(Y,M,Dd,0,0,tz), nd = new Date(Date.UTC(Y,M-1,Dd+1));
  return [t0, localToUtc(nd.getUTCFullYear(), nd.getUTCMonth()+1, nd.getUTCDate(),0,0,tz)];
}
function crossings(t0, t1, lat, lon, h){
  // 10-minute scan + bisection gives the same answers as a fine scan (the sun moves smoothly); near the poles the sun can
  // skim a threshold briefly, so scan finer there
  const f = t => sunPos(t,lat,lon).altGeo - h, step = (Math.abs(lat) > 60 ? 2 : 10)*60000, rises=[], sets=[];
  let a = t0, fa = f(a);
  while (a < t1){
    const b = Math.min(a+step, t1), fb = f(b);
    if ((fa < 0) !== (fb < 0)){
      let lo=a, hi=b, flo=fa;
      for (let i=0;i<30;i++){ const m=(lo+hi)/2, fm=f(m); if ((fm<0)===(flo<0)){lo=m;flo=fm;} else hi=m; }
      (fa < 0 ? rises : sets).push((lo+hi)/2);
    }
    a = b; fa = fb;
  }
  return {rise: rises[0] ?? null, set: sets.length ? sets[sets.length-1] : null};
}
function solarNoon(t0, t1, lat, lon){
  let lo=t0, hi=t1;
  for (let i=0;i<80;i++){ const m1=lo+(hi-lo)/3, m2=hi-(hi-lo)/3;
    if (sunPos(m1,lat,lon).altGeo < sunPos(m2,lat,lon).altGeo) lo=m1; else hi=m2; }
  return (lo+hi)/2;
}
// equinox/solstice instant (Meeus, Astronomical Algorithms ch. 27), accurate to about a minute for 2000-3000
const SEASON_TERMS = [[485,324.96,1934.136],[203,337.23,32964.467],[199,342.08,20.186],[182,27.85,445267.112],[156,73.14,45036.886],[136,171.52,22518.443],[77,222.54,65928.934],[74,296.72,3034.906],[70,243.58,9037.513],[58,119.81,33718.147],[52,297.17,150.678],[50,21.02,2281.226],[45,247.54,29929.562],[44,325.15,31555.956],[29,60.93,4443.417],[18,155.12,67555.328],[17,288.79,4562.452],[16,198.04,62894.029],[14,199.76,31436.921],[12,95.39,14577.848],[12,287.11,31931.756],[12,320.81,34777.259],[9,227.73,1222.114],[8,15.45,16859.074]];
const SEASON_BASE = {0:[2451623.80984,365242.37404,0.05169,-0.00411,-0.00057], 90:[2451716.56767,365241.62603,0.00325,0.00888,-0.00030],
  180:[2451810.21715,365242.01767,-0.11575,0.00337,0.00078], 270:[2451900.05952,365242.74049,-0.06223,-0.00823,0.00032]};
function seasonInstant(year, target){
  const Y = (year-2000)/1000, c = SEASON_BASE[target];
  const jde0 = c[0] + c[1]*Y + c[2]*Y*Y + c[3]*Y**3 + c[4]*Y**4, T = (jde0-2451545)/36525;
  const W = (35999.373*T - 2.47)*R, dl = 1 + 0.0334*Math.cos(W) + 0.0007*Math.cos(2*W);
  const Ssum = SEASON_TERMS.reduce((s,[A,B,C]) => s + A*Math.cos((B + C*T)*R), 0);
  const jde = jde0 + 0.00001*Ssum/dl;
  return (jde - 2440587.5)*86400000 - DELTA_T*1000;
}
// golden/blue hour definitions (geometric altitude, degrees)
const DEFS = {
  ss:      {name:'Extended',     blue:[-10,-3], gold:[-0.833,10]},   // internal key 'ss' kept so saved choices carry over
  classic: {name:'Classic',      blue:[-6,-4],  gold:[-4,6]}
};
function dayEvents(Y,M,Dd,lat,lon,tz,mode){
  const d = DEFS[mode], [t0,t1] = dayBounds(Y,M,Dd,tz);
  const X = h => crossings(t0,t1,lat,lon,h);
  return {t0,t1,
    sun:X(-0.833), civ:X(-6), naut:X(-12), astro:X(-18),
    bLo:X(d.blue[0]), bHi:X(d.blue[1]), gLo:X(d.gold[0]), gHi:X(d.gold[1]),
    noon: solarNoon(t0,t1,lat,lon)};
}
const roundMin = ms => Math.floor(ms/60000)*60000; // times are shown to the minute (seconds dropped)
const fmtT = (ms,tz) => ms==null ? '—' : dtf({timeZone:tz,hour:'numeric',minute:'2-digit'}).format(new Date(roundMin(ms)));
const fmtSpanDur = (a,b) => { const m=Math.round((roundMin(b)-roundMin(a))/60000); return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`; };
const fmtDurS = ms => { if (ms==null||ms<0) return '—'; const s=Math.round(ms/1000); return `${Math.floor(s/3600)}h ${Math.floor(s%3600/60)}m ${s%60}s`; };
