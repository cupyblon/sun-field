/* Sky events: moon phases, supermoons, seasons, meteor shower peaks, eclipses (computed, so they work for any year),
   Moon-planet conjunctions, planet visibility. Needs sun.js, moon.js, planets.js. */

// ---- meteor showers: IMO working list (peak solar longitude, J2000; radiant RA/Dec; ZHR; speed km/s) ----
const SHOWERS = [
  {name:'Quadrantids',          lam:283.15, ra:230, dec:49,  zhr:80,  v:41, major:true},
  {name:'Lyrids',               lam:32.32,  ra:271, dec:34,  zhr:18,  v:49, major:true},
  {name:'Eta Aquariids',        lam:45.245,   ra:338, dec:-1,  zhr:50,  v:66, major:true},
  {name:'Southern Delta Aquariids', lam:128, ra:340, dec:-16, zhr:25, v:41, major:false},
  {name:'Alpha Capricornids',   lam:128,    ra:307, dec:-10, zhr:5,   v:23, major:false},
  {name:'Perseids',             lam:140.0,  ra:48,  dec:58,  zhr:110, v:59, major:true},
  {name:'Draconids',            lam:195.4,  ra:263, dec:56,  zhr:5,   v:20, major:false},
  {name:'Orionids',             lam:208,    ra:95,  dec:16,  zhr:20,  v:66, major:true},
  {name:'Southern Taurids',     lam:223,    ra:52,  dec:15,  zhr:7,   v:27, major:false},
  {name:'Northern Taurids',     lam:230,    ra:58,  dec:22,  zhr:5,   v:29, major:false},
  {name:'Leonids',              lam:235.27, ra:152, dec:22,  zhr:15,  v:71, major:true},
  {name:'Geminids',             lam:262.2,  ra:112, dec:33,  zhr:150, v:35, major:true},
  {name:'Ursids',               lam:270.7,  ra:217, dec:76,  zhr:10,  v:33, major:false}
];
const wrap180 = x => ((x % 360) + 540) % 360 - 180;
function sunLonJ2000(ms){ const c = sunCore(ms); return norm360(c.lam - 1.396971*c.T); }
// instants in [from,to) when the Sun's J2000 longitude equals lam
function whenSunAt(lam, from, to){
  const out = [], step = 86400000; let a = from, ga = wrap180(sunLonJ2000(a) - lam);
  while (a < to){ const b = a + step, gb = wrap180(sunLonJ2000(b) - lam);
    if (ga < 0 && gb >= 0){ let lo=a, hi=b; for (let k=0;k<40;k++){ const m=(lo+hi)/2; if (wrap180(sunLonJ2000(m)-lam) < 0) lo=m; else hi=m; } out.push((lo+hi)/2); }
    a = b; ga = gb; }
  return out;
}
function meteorPeaks(from, to){
  const out = []; for (const s of SHOWERS) for (const t of whenSunAt(s.lam, from, to)) out.push({...s, t});
  return out.sort((a,b) => a.t - b.t);
}

// ---- moon phase instants in a range (deg: 0 new, 90 first quarter, 180 full, 270 last quarter) ----
function phaseTimes(deg, from, to){
  const g = t => wrap180(moonEcliptic(t).lam - (sunCore(t).lam - 0.00569) - deg), out = [];
  let a = from, ga = g(a);
  while (a < to){ const b = a + 86400000/2, gb = g(b);
    if (ga < 0 && gb >= 0 && gb - ga < 90){ let lo=a, hi=b; for (let k=0;k<40;k++){ const m=(lo+hi)/2; if (g(m) < 0) lo=m; else hi=m; } out.push((lo+hi)/2); }
    a = b; ga = gb; }
  return out;
}

// ---- lunar eclipses (geometry of the Moon and Earth's shadow; Danjon 1/50 enlargement as NASA uses) ----
function sunDistAU(ms){ const c = sunCore(ms), Mr = c.M*R;
  const C = Math.sin(Mr)*(1.914602 - c.T*0.004817) + Math.sin(2*Mr)*0.019993 + Math.sin(3*Mr)*0.000289;
  return 1.000001018*(1 - c.e*c.e)/(1 + c.e*Math.cos((c.M + C)*R)); }
function shadowGeom(ms){
  const m = moonEcliptic(ms), sl = sunCore(ms).lam - 0.00569, r = sunDistAU(ms);
  const pm = Math.asin(6378.14/m.dist)*D, ps = 8.794/3600/r, ss = 959.63/3600/r, sm = 0.2725076*pm;
  const d = Math.acos(Math.cos(m.beta*R)*Math.cos((m.lam - sl - 180)*R))*D;
  const ru = 1.02*(pm + ps - ss), rp = 1.02*(pm + ps + ss);
  return {d, sm, ru, rp, umag: (ru + sm - d)/(2*sm), pmag: (rp + sm - d)/(2*sm)};
}
function lunarEclipses(from, to, lat, lon){
  const out = [];
  for (const full of phaseTimes(180, from - 86400000, to)){
    if (Math.abs(moonEcliptic(full).beta) > 1.8) continue;         // too far from the shadow: no eclipse this month
    let best = null; for (let t=full-6*3600000; t<=full+6*3600000; t+=60000){ const g = shadowGeom(t); if (!best || g.d < best.g.d) best = {t, g}; }
    if (best.g.pmag <= 0) continue;
    // refine greatest eclipse to the second
    let lo = best.t - 60000, hi = best.t + 60000; for (let k=0;k<30;k++){ const m1=lo+(hi-lo)/3, m2=hi-(hi-lo)/3; if (shadowGeom(m1).d < shadowGeom(m2).d) hi=m2; else lo=m1; }
    const tg = (lo+hi)/2, g = shadowGeom(tg); if (tg < from || tg >= to) continue;
    const contact = (fn) => { const res = [];          // fn(t) > 0 inside the phase
      for (const dir of [-1, 1]){ let a = tg, b = tg + dir*6*3600000; if (fn(tg) <= 0){ res.push(null); continue; }
        for (let k=0;k<40;k++){ const m=(a+b)/2; if (fn(m) > 0) a=m; else b=m; } res.push((a+b)/2); }
      return res; };
    const [penStart, penEnd] = contact(t => shadowGeom(t).pmag);
    const [parStart, parEnd] = contact(t => shadowGeom(t).umag);
    const [totStart, totEnd] = contact(t => shadowGeom(t).umag - 1);
    const type = g.umag >= 1 ? 'Total' : g.umag > 0 ? 'Partial' : 'Penumbral';
    // watchable from here: Moon above the horizon and the Sun below it, during the main (or penumbral) phase
    const s = parStart || penStart, e = parEnd || penEnd, step = 2*60000;
    const canSee = t => moonPos(t,lat,lon).altTopo > 0 && sunPos(t,lat,lon).altGeo < -0.833;
    let up = 0, n = 0, seeFrom = null, seeTo = null, why = '';
    for (let t=s; t<=e; t+=step){ n++; if (canSee(t)){ up++; if (seeFrom === null) seeFrom = t; seeTo = t; } }
    if (up && up < n){                                         // say why part of it is missed: Sun up, or Moon below the horizon
      const atStart = seeFrom > s + step, atEnd = seeTo < e - step;
      const sunUp = t => sunPos(t,lat,lon).altGeo >= -0.833;
      why = [atStart ? (sunUp(s) ? 'after dark' : 'after moonrise') : '', atEnd ? (sunUp(e) ? 'until dawn' : 'until moonset') : ''].filter(Boolean).join(', ');
    }
    out.push({kind:'lunar', type, t: tg, umag: g.umag, pmag: g.pmag, penStart, penEnd, parStart, parEnd, totStart, totEnd,
              visibleFrac: n ? up/n : 0, seeFrom, seeTo: seeTo !== null ? Math.min(e, seeTo + step) : null, why});
  }
  return out;
}

// ---- solar eclipses as seen from this place (topocentric Moon over the Sun) ----
function solarLocal(t, lat, lon){
  const s = sunPos(t,lat,lon), m = moonPos(t,lat,lon), r = sunDistAU(t);
  const a1=s.altGeo*R, a2=m.altTopo*R, dz=(s.az-m.az)*R;
  const sep = Math.acos(Math.min(1, Math.sin(a1)*Math.sin(a2) + Math.cos(a1)*Math.cos(a2)*Math.cos(dz)))*D;
  const ss = 959.63/3600/r, sm = 0.2725076*m.par*(1 + Math.sin(a2)*Math.sin(m.par*R));
  return {sep, ss, sm, sunAlt: s.altGeo, mag: (ss + sm - sep)/(2*ss)};
}
function overlapFrac(r1, r2, d){   // fraction of disc r1 covered by disc r2 at center distance d
  if (d >= r1 + r2) return 0; if (d <= Math.abs(r2 - r1)) return r2 >= r1 ? 1 : (r2*r2)/(r1*r1);
  const a = r1*r1*Math.acos((d*d + r1*r1 - r2*r2)/(2*d*r1)) + r2*r2*Math.acos((d*d + r2*r2 - r1*r1)/(2*d*r2))
          - 0.5*Math.sqrt((-d+r1+r2)*(d+r1-r2)*(d-r1+r2)*(d+r1+r2));
  return a/(Math.PI*r1*r1);
}
function solarEclipsesLocal(from, to, lat, lon){
  const out = [];
  for (const nm of phaseTimes(0, from - 86400000, to)){
    if (Math.abs(moonEcliptic(nm).beta) > 1.7) continue;           // beyond the eclipse limit: no solar eclipse anywhere
    let start=null, end=null, best=null;
    for (let t=nm-5*3600000; t<=nm+5*3600000; t+=30000){
      const e = solarLocal(t,lat,lon), on = e.mag > 0 && e.sunAlt > -0.833;
      if (on){ if (start===null) start=t; end=t; if (!best || e.mag > best.e.mag) best = {t, e}; }
    }
    if (!best || best.t < from || best.t >= to) continue;
    const ob = overlapFrac(best.e.ss, best.e.sm, best.e.sep);
    out.push({kind:'solar', t: best.t, start, end, mag: best.e.mag, obscuration: ob});
  }
  return out;
}

// ---- Moon-planet close approaches (geocentric separation under maxDeg) ----
function angSep(ra1, d1, ra2, d2){ return Math.acos(Math.min(1, Math.sin(d1*R)*Math.sin(d2*R) + Math.cos(d1*R)*Math.cos(d2*R)*Math.cos((ra1-ra2)*R)))*D; }
function moonPlanetConjunctions(from, to, lat, lon, maxDeg=4){
  const out = [], step = 6*3600000, moon = [];   // the Moon moves ~3.3° per 6 h, so a sampled minimum is within ~1.7° of the true one
  for (let t=from; t<=to; t+=step) moon.push(moonPos(t,lat,lon));
  for (const name of PLANETS){
    let prev = null, prev2 = null;
    for (let i=0, t=from; t<=to; i++, t+=step){
      const m = moon[i], p = planetPos(name,t,lat,lon), s = angSep(m.ra, m.dec, p.ra, p.dec);
      if (prev && prev2 && prev.s < prev2.s && prev.s <= s && prev.s < maxDeg + 2){
        let lo = prev.t - step, hi = t;
        for (let k=0;k<30;k++){ const m1=lo+(hi-lo)/3, m2=hi-(hi-lo)/3;
          const f = x => { const a = moonPos(x,lat,lon), b = planetPos(name,x,lat,lon); return angSep(a.ra,a.dec,b.ra,b.dec); };
          if (f(m1) < f(m2)) hi = m2; else lo = m1; }
        const tc = (lo+hi)/2, a = moonPos(tc,lat,lon), b = planetPos(name,tc,lat,lon);
        const sep = angSep(a.ra,a.dec,b.ra,b.dec); if (sep < maxDeg) out.push({kind:'conj', name, t: tc, sep});
      }
      prev2 = prev; prev = {t, s};
    }
  }
  return out.sort((a,b)=>a.t-b.t);
}

// ---- planets visible this evening / morning (above 8 degrees while the sky is dark enough) ----
function planetsVisible(t0, t1, lat, lon){
  const evening = [], morning = [];
  const civ = crossings(t0, t1, lat, lon, -6);
  const probe = (tt) => PLANETS.filter(n => { const p = planetPos(n, tt, lat, lon); return p.alt > 8; });
  if (civ.set) evening.push(...probe(civ.set + 30*60000));
  if (civ.rise) morning.push(...probe(civ.rise - 30*60000));
  return {evening, morning};
}

// ---- everything notable in [from,to): returns [{t, kind, title, detail, icon, major}] ----
function skyEvents(from, to, lat, lon, tz){
  const tf = dtf({timeZone:tz,hour:'numeric',minute:'2-digit'});
  const ft = ms => tf.format(new Date(ms)), ev = [];
  for (const [deg, name, icon] of [[0,'New Moon','●'],[90,'First Quarter','◑'],[180,'Full Moon','○'],[270,'Last Quarter','◐']])
    for (const t of phaseTimes(deg, from, to)){
      const dist = moonEcliptic(t).dist, sup = deg===180 && dist < 360000;
      ev.push({t, kind:'phase', icon, major: deg===180 || deg===0, title: sup ? 'Supermoon (Full Moon)' : name,
               detail: `${ft(t)}${sup ? ` · Moon ${Math.round(dist).toLocaleString()} km away, among the closest full moons of the year` : ''}`});
    }
  const yrs = new Set([new Date(from).getUTCFullYear(), new Date(to).getUTCFullYear()]);
  for (const Y of yrs) for (const [deg, name] of [[0,'March equinox'],[90,'June solstice'],[180,'September equinox'],[270,'December solstice']]){
    const t = seasonInstant(Y, deg); if (t >= from && t < to) ev.push({t, kind:'season', icon:'☀', major:true, title:name, detail: ft(t)});
  }
  for (const s of meteorPeaks(from, to)){
    const m = moonPos(s.t, lat, lon);
    // best viewing: radiant highest while the sky is dark, on the night around the peak
    let best = null; for (let t=s.t-12*3600000; t<=s.t+12*3600000; t+=15*60000){
      if (sunPos(t,lat,lon).altGeo > -18) continue; const r = starPos(s.ra, s.dec, t, lat, lon); if (!best || r.alt > best.alt) best = {t, alt: r.alt}; }
    const rate = best && best.alt > 0 ? Math.round(s.zhr*Math.sin(best.alt*R)) : 0;
    ev.push({t: s.t, kind:'meteor', icon:'☄', major: s.major, title: `${s.name} peak`,
      detail: best && best.alt > 0 ? `up to ~${rate}/hr here around ${ft(best.t)} (radiant ${best.alt.toFixed(0)}° up) · Moon ${Math.round(m.lit*100)}% lit` : `radiant stays low here · Moon ${Math.round(m.lit*100)}% lit`});
  }
  for (const e of lunarEclipses(from, to, lat, lon)){
    if (e.visibleFrac <= 0) continue;
    const span = e.type === 'Penumbral' ? `${ft(e.penStart)}–${ft(e.penEnd)}` : `partial ${ft(e.parStart)}–${ft(e.parEnd)}`;
    ev.push({t: e.t, kind:'eclipse', icon:'◐', major: e.type !== 'Penumbral', title: `${e.type} lunar eclipse`,
      detail: `max ${ft(e.t)}${e.type==='Total' ? ` · total ${ft(e.totStart)}–${ft(e.totEnd)}` : ''} · ${span}${e.type==='Penumbral' ? ' · faint shading only' : ''}${e.visibleFrac < 1 ? ` · watchable here ${ft(e.seeFrom)}–${ft(e.seeTo)}${e.why ? ` (${e.why})` : ''}` : ''}`});
  }
  for (const e of solarEclipsesLocal(from, to, lat, lon))
    ev.push({t: e.t, kind:'eclipse', icon:'◑', major: e.obscuration > 0.1, title: 'Partial solar eclipse',
      detail: `${ft(e.start)}–${ft(e.end)}, max ${ft(e.t)} · ${Math.max(1, Math.round(e.obscuration*100))}% of the Sun covered · never look without eclipse glasses`});
  for (const c of moonPlanetConjunctions(from, to, lat, lon))
    ev.push({t: c.t, kind:'conj', icon:'☌', major: c.sep < 2, title: `Moon near ${c.name}`, detail: `${c.sep.toFixed(1)}° apart around ${ft(c.t)}`});
  return ev.sort((a,b) => a.t - b.t);
}
