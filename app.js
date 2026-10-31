/* Sun Field app shell: shared state, times list, timeline, tabs, map. Needs sun.js, dome.js, ar.js. */
const $ = id => document.getElementById(id);
const store = {
  get(k, d){ try { const v = localStorage.getItem('sf-'+k); return v == null ? d : JSON.parse(v); } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem('sf-'+k, JSON.stringify(v)); } catch(e){} }
};
const HOME = {lat:41.8228, lon:-87.8517, place:'Brookfield, IL (village center)'};
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const colors = () => ({fg:cssv('--fg'),muted:cssv('--muted'),line:cssv('--domeline'),grid:cssv('--grid'),ground:cssv('--ground'),path:cssv('--path'),
  season:cssv('--season'),rise:cssv('--rise'),set:cssv('--set'),sun:cssv('--sun'),sunEdge:cssv('--sun-edge'),sunLine:cssv('--path'),
  shadow:cssv('--shadow'),north:cssv('--north'),below:cssv('--below'),font:cssv('--font'),
  altaz:cssv('--altaz'),celes:cssv('--celes'),night:cssv('--nightpath'),halo:cssv('--halo')});

const S = {
  lat: store.get('lat', HOME.lat), lon: store.get('lon', HOME.lon), place: store.get('place', HOME.place),
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago',
  mode: store.get('mode', 'ss'), heightIn: store.get('heightIn', 36), decl: store.get('decl', -4.1),
  view: store.get('view', 'times'), Y:0, M:0, D:0, minute:0, live:true
};
let toastTimer;
function toast(msg){ const el=$('toast'); el.textContent=msg; el.hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.hidden=true, 2600); }

// ---------- derived state ----------
let D_ = null;  // cache of the current day's events
function state(){
  const t = localToUtc(S.Y,S.M,S.D,Math.floor(S.minute/60),S.minute%60,S.tz);
  const key = [S.Y,S.M,S.D,S.lat,S.lon,S.tz,S.mode].join('|');
  if (!D_ || D_.key !== key) D_ = {key, ev: dayEvents(S.Y,S.M,S.D,S.lat,S.lon,S.tz,S.mode)};
  return {t, t0:D_.ev.t0, t1:D_.ev.t1, lat:S.lat, lon:S.lon, Y:S.Y, tz:S.tz, decl:S.decl, ev:D_.ev};
}
function setNow(){
  const p={}; new Intl.DateTimeFormat('en-US',{timeZone:S.tz,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})
    .formatToParts(new Date()).forEach(x=>p[x.type]=x.value);
  S.Y=+p.year; S.M=+p.month; S.D=+p.day; S.minute=(+p.hour)*60+(+p.minute); S.live = true;
  $('date').value = `${p.year}-${p.month}-${String(p.day).padStart(2,'0')}`;
}

// ---------- phases (shared by timeline + times) ----------
function phaseOf(alt){
  const d = DEFS[S.mode];
  if (alt >= d.gold[1]) return '--day';
  if (alt >= d.gold[0]) return '--gold';
  if (alt >= d.blue[1]) return '--gap';
  if (alt >= d.blue[0]) return '--blue';
  if (alt >= -6) return '--civil';
  if (alt >= -12) return '--naut';
  if (alt >= -18) return '--astro';
  return '--night';
}

// ---------- views ----------
const dome = createDome($('dome'), colors, store.get('domeLayers', {}));
buildLayerPanel($('layerPanel'), dome, l => store.set('domeLayers', l));
$('layersBtn').addEventListener('click', () => { const open = $('layerPanel').hidden; $('layerPanel').hidden = !open; $('layersBtn').setAttribute('aria-expanded', open); });
$('dome').addEventListener('pointerdown', () => { $('layerPanel').hidden = true; $('layersBtn').setAttribute('aria-expanded', false); });
const ar = createAR({getState: state, colors, store, toast});
let map = null, mapLayer = null;

function render(){
  const st = state(), {t, ev, tz, lat, lon} = st;
  // strip
  const p = sunPos(t,lat,lon);
  $('sNow').textContent = `${p.az.toFixed(1)}°\n${p.alt>=0?'+':''}${p.alt.toFixed(1)}°\n${p.alt>0 ? (1/Math.tan(p.alt*R)).toFixed(1)+':1' : '—'}`;
  $('sRise').textContent = ev.sun.rise ? `${fmtT(ev.sun.rise,tz)}\n${sunPos(ev.sun.rise,lat,lon).az.toFixed(1)}°` : '—';
  $('sSet').textContent  = ev.sun.set  ? `${fmtT(ev.sun.set,tz)}\n${sunPos(ev.sun.set,lat,lon).az.toFixed(1)}°` : '—';
  $('timeLabel').textContent = fmtT(t,tz);
  $('placeLabel').textContent = S.place;
  drawTimeline(st);
  if (S.view === 'times') renderTimes(st);
  if (S.view === 'dome') dome.draw(st);
  if (S.view === 'map') renderMap(st);
}

function renderTimes(st){
  const {ev, tz, lat, lon} = st, d = DEFS[S.mode];
  const row = (sw,name,sub,time,dur) => `<tr><td><span class="sw" style="background:var(${sw})"></span>${name}${sub?`<div class="sub">${sub}</div>`:''}</td><td class="t">${time}${dur?`<span class="d">${dur}</span>`:''}</td></tr>`;
  const span = (a,b) => a&&b ? [`${fmtT(a,tz)} – ${fmtT(b,tz)}`, `(${fmtSpanDur(a,b)})`] : ['does not occur',''];
  const az = ms => ms ? ` @ ${sunPos(ms,lat,lon).az.toFixed(1)}°` : '';
  $('workStart').textContent = fmtT(ev.civ.rise,tz); $('workEnd').textContent = fmtT(ev.civ.set,tz);
  $('workNote').textContent = ev.civ.rise && ev.sun.rise ? `Usable light starts ${Math.round((ev.sun.rise-ev.civ.rise)/60000)} min before sunrise and lasts ${Math.round((ev.civ.set-ev.sun.set)/60000)} min after sunset.` : 'Civil dawn to civil dusk: enough natural light to work outside.';
  $('am').innerHTML =
    row('--astro','Dawn (astronomical)','sun at −18°',fmtT(ev.astro.rise,tz)) +
    row('--naut','Dawn (nautical)','can see shapes and the horizon',fmtT(ev.naut.rise,tz)) +
    row('--civil','Dawn (civil)','enough light to work outside',fmtT(ev.civ.rise,tz)) +
    row('--blue','Blue hour',`sun ${d.blue[0]}° to ${d.blue[1]}°`,...span(ev.bLo.rise,ev.bHi.rise)) +
    row('--rise','Sunrise','top edge on horizon'+az(ev.sun.rise),fmtT(ev.sun.rise,tz)) +
    row('--gold','Golden hour',S.mode==='ss'?'sunrise to +10°':'−4° to +6°',...span(ev.gLo.rise,ev.gHi.rise));
  $('pm').innerHTML =
    row('--gold','Golden hour',S.mode==='ss'?'+10° to sunset':'+6° to −4°',...span(ev.gHi.set,ev.gLo.set)) +
    row('--set','Sunset','top edge on horizon'+az(ev.sun.set),fmtT(ev.sun.set,tz)) +
    row('--blue','Blue hour',`sun ${d.blue[1]}° to ${d.blue[0]}°`,...span(ev.bHi.set,ev.bLo.set)) +
    row('--civil','Dusk (civil)','work light ends',fmtT(ev.civ.set,tz)) +
    row('--naut','Dusk (nautical)','shapes fade',fmtT(ev.naut.set,tz)) +
    row('--astro','Dusk (astronomical)','full dark',fmtT(ev.astro.set,tz));
  const np = sunPos(ev.noon,lat,lon), H = S.heightIn;
  $('day').innerHTML =
    row('--day','Solar noon',`${np.alt>=0?'+':''}${np.alt.toFixed(1)}° @ ${np.az.toFixed(1)}°`,fmtT(ev.noon,tz)) +
    row('--day','Day length','sunrise to sunset', ev.sun.rise&&ev.sun.set ? fmtDurS(ev.sun.set-ev.sun.rise) : '—') +
    row('--civil','Work light','civil dawn to dusk', ev.civ.rise&&ev.civ.set ? fmtDurS(ev.civ.set-ev.civ.rise) : '—') +
    row('--shadow',`Noon shadow (${+H.toFixed(2)} in object)`,'shortest of the day, points north', np.alt>0&&H>0 ? (H/Math.tan(np.alt*R)).toFixed(1)+' in' : '—');
  if (renderTimes.key !== S.Y+'|'+S.lat+'|'+S.lon+'|'+S.tz){
    renderTimes.key = S.Y+'|'+S.lat+'|'+S.lon+'|'+S.tz;
    $('seasonTitle').textContent = `Solstices and equinoxes ${S.Y}`;
    const df = new Intl.DateTimeFormat('en-US',{timeZone:tz,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
    const pf = new Intl.DateTimeFormat('en-US',{timeZone:tz,year:'numeric',month:'numeric',day:'numeric'});
    $('seasons').innerHTML = [['March equinox',0,'--accent'],['June solstice',90,'--day'],['September equinox',180,'--accent'],['December solstice',270,'--blue']].map(([n,deg,sw])=>{
      const ms = seasonInstant(S.Y,deg), q={}; pf.formatToParts(new Date(ms)).forEach(x=>q[x.type]=x.value);
      const [a,b] = dayBounds(+q.year,+q.month,+q.day,tz), r = crossings(a,b,lat,lon,-0.833);
      return row(sw, n, df.format(new Date(roundMin(ms))), r.rise&&r.set ? fmtDurS(r.set-r.rise) : '—', 'day length');
    }).join('');
  }
  document.querySelectorAll('.seg button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.mode===S.mode));
}

function drawTimeline(st){
  const cv = $('tl'), dpr = window.devicePixelRatio||1, w = cv.clientWidth, h = cv.clientHeight; if (!w) return;
  if (cv.width !== Math.round(w*dpr)) { cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0);
  const {t0,t1,t,lat,lon,tz} = st, span = t1-t0, barH = h-18, cache = {};
  for (let x=0;x<w;x+=2){ const a = sunPos(t0+span*(x+1)/w,lat,lon).altGeo, k = phaseOf(a); g.fillStyle = cache[k] || (cache[k]=cssv(k)); g.fillRect(x,0,2.2,barH); }
  g.fillStyle = cssv('--muted'); g.font = `11px ${cssv('--font')}`; g.textAlign='center';
  const hf = new Intl.DateTimeFormat('en-US',{timeZone:tz,hourCycle:'h23',hour:'2-digit'});
  for (let k=0, x0=t0; x0<=t1+1; k++, x0+=3600000){
    const x = (x0-t0)/span*w, hr = parseInt(hf.format(new Date(x0)),10)%24;
    g.fillRect(Math.min(Math.round(x),w-1), barH, 1, k%3?3:6);
    if (k%6===0 && x0<t1) g.fillText(hr===0?'12a':hr===12?'12p':hr<12?hr+'a':(hr-12)+'p', Math.min(Math.max(x,12),w-12), h-1);
  }
  const mx = (t-t0)/span*w; g.fillStyle = cssv('--fg'); g.fillRect(mx-1,0,2,barH);
  g.beginPath(); g.moveTo(mx-6,0); g.lineTo(mx+6,0); g.lineTo(mx,7); g.closePath(); g.fill();
}

// ---------- map (OpenStreetMap via Leaflet) ----------
function dest(lat, lon, az, m){ // point m meters away along bearing az
  const r = m/6371000, b = az*R, p1 = lat*R, l1 = lon*R;
  const p2 = Math.asin(Math.sin(p1)*Math.cos(r) + Math.cos(p1)*Math.sin(r)*Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b)*Math.sin(r)*Math.cos(p1), Math.cos(r) - Math.sin(p1)*Math.sin(p2));
  return [p2*D, l2*D];
}
function initMap(){
  if (map) return;
  if (typeof L === 'undefined'){ $('map').innerHTML = '<p style="padding:24px;color:var(--muted)">The map needs an internet connection. Check your signal and reload.</p>'; return; }
  map = L.map('map', {zoomControl:false, attributionControl:true}).setView([S.lat,S.lon], 18);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19, attribution:'© OpenStreetMap contributors'}).addTo(map);
  mapLayer = L.layerGroup().addTo(map);
  map.on('zoomend moveend', () => renderMap(state()));
  map.on('click', e => { setLocation(e.latlng.lat, e.latlng.lng, 'Map pin', false); toast('Spot moved'); });
}
function renderMap(st){
  if (!map) return;
  mapLayer.clearLayers();
  const {lat, lon, ev, t, tz, Y, t0, t1} = st, c = colors();
  const b = map.getBounds(), halfH = map.distance(b.getNorthWest(), b.getSouthWest())/2, len = Math.max(15, halfH*0.62);
  const ray = (az, color, weight, dash, scale=1) => L.polyline([[lat,lon], dest(lat,lon,az,len*scale)], {color, weight, dashArray:dash, opacity:.95, interactive:false}).addTo(mapLayer);
  for (const [m,d] of [[6,21],[12,21]]){ const [a,bb] = dayBounds(Y,m,d,tz), r = crossings(a,bb,lat,lon,-0.833);
    if (r.rise) ray(sunPos(r.rise,lat,lon).az, c.muted, 2, '6 6'); if (r.set) ray(sunPos(r.set,lat,lon).az, c.muted, 2, '6 6'); }
  if (ev.sun.rise) ray(sunPos(ev.sun.rise,lat,lon).az, c.rise, 4);
  if (ev.sun.set)  ray(sunPos(ev.sun.set,lat,lon).az, c.set, 4);
  // hour dots on a ring, like a sundial seen from above
  const hf = new Intl.DateTimeFormat('en-US',{timeZone:tz,hour:'numeric',hourCycle:'h23'});
  for (let x=Math.ceil(t0/3600000)*3600000; x<t1; x+=3600000){
    const p = sunPos(x,lat,lon); if (p.alt <= 0) continue; const q = dest(lat,lon,p.az,len*0.8), hr = +hf.format(new Date(x))%24;
    L.circleMarker(q,{radius:4,color:c.path,fillColor:c.path,fillOpacity:1,weight:1,interactive:false}).addTo(mapLayer);
    L.marker(dest(lat,lon,p.az,len*0.93),{interactive:false,icon:L.divIcon({className:'hour-lbl',html:hr===0?'12a':hr===12?'12p':hr<12?hr+'a':(hr-12)+'p',iconSize:[26,14],iconAnchor:[13,7]})}).addTo(mapLayer);
  }
  const p = sunPos(t,lat,lon);
  if (p.alt > 0){
    ray(p.az, c.path, 5);
    ray((p.az+180)%360, c.shadow, 6, null, Math.min(1, 0.22/Math.tan(p.alt*R)));
  }
  L.circleMarker([lat,lon],{radius:7,color:'#fff',weight:2,fillColor:c.north,fillOpacity:1,interactive:false}).addTo(mapLayer);
}

// ---------- location ----------
function setLocation(lat, lon, place, recenter=true){
  S.lat = +(+lat).toFixed(5); S.lon = +(+lon).toFixed(5); S.place = place;
  store.set('lat',S.lat); store.set('lon',S.lon); store.set('place',S.place);
  $('lat').value = S.lat; $('lon').value = S.lon; renderTimes.key = '';
  if (map && recenter) map.setView([S.lat,S.lon], map.getZoom());
  render();
}
$('locateBtn').addEventListener('click', () => {
  if (!navigator.geolocation){ toast('Location is not available in this browser'); return; }
  toast('Finding you…');
  navigator.geolocation.getCurrentPosition(
    pos => { setLocation(pos.coords.latitude, pos.coords.longitude, `Your location (±${Math.round(pos.coords.accuracy)} m)`); toast('Location set'); },
    err => toast(err.code === 1 ? 'Location access was declined' : 'Could not get your location'),
    {enableHighAccuracy:true, timeout:15000, maximumAge:60000});
});
$('homeBtn').addEventListener('click', () => { setLocation(HOME.lat, HOME.lon, HOME.place); toast('Back to Brookfield'); });
for (const id of ['lat','lon']) $(id).addEventListener('change', () => { const la=+$('lat').value, lo=+$('lon').value;
  if (la>=-90&&la<=90&&lo>=-180&&lo<=180) setLocation(la, lo, 'Custom spot'); else toast('Latitude −90 to 90, longitude −180 to 180'); });
$('height').addEventListener('change', e => { const v=+e.target.value; if (v>0){ S.heightIn=v; store.set('heightIn',v); render(); } });
$('decl').addEventListener('change', e => { const v=+e.target.value; if (isFinite(v)){ S.decl=v; store.set('decl',v); } });
document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => { S.mode=b.dataset.mode; store.set('mode',S.mode); render(); }));

// ---------- date / time ----------
$('date').addEventListener('change', e => { const [y,m,d] = e.target.value.split('-').map(Number); if (y){ S.Y=y; S.M=m; S.D=d; S.live=false; render(); } });
$('nowBtn').addEventListener('click', () => { setNow(); render(); });
let drag = false;
function scrub(e){ const r=$('tl').getBoundingClientRect(), f=Math.min(Math.max((e.clientX-r.left)/r.width,0),0.9999), st=state();
  const x = st.t0 + (st.t1-st.t0)*f, p={}; new Intl.DateTimeFormat('en-US',{timeZone:S.tz,hourCycle:'h23',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date(x)).forEach(q=>p[q.type]=q.value);
  S.minute = (+p.hour)*60 + (+p.minute); S.live = false; render(); }
$('tl').addEventListener('pointerdown', e => { drag=true; $('tl').setPointerCapture(e.pointerId); scrub(e); });
$('tl').addEventListener('pointermove', e => { if (drag) scrub(e); });
$('tl').addEventListener('pointerup', () => drag=false);
$('tl').addEventListener('pointercancel', () => drag=false);

// ---------- tabs ----------
function show(view){
  S.view = view; store.set('view', view);
  for (const v of ['times','dome','ar','map']) $('view-'+v).hidden = v !== view;
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.view===view ? 'page' : 'false'));
  if (view === 'ar') ar.show(); else ar.hide();
  if (view !== 'dome' && typeof setDomeLive === 'function' && domeLive) setDomeLive(false);
  if (view === 'map'){ initMap(); if (map) setTimeout(()=>{ map.invalidateSize(); map.setView([S.lat,S.lon]); renderMap(state()); }, 30); }
  render();
}
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));
document.querySelectorAll('[data-dv]').forEach(b => b.addEventListener('click', () => dome.setView(b.dataset.dv)));

// ---------- live motion dome: the dome turns with the phone; Freeze holds the view ----------
const motion = createMotion({getDecl: () => S.decl});
const DIRS16 = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const wrapDeg = x => ((x % 360) + 540) % 360 - 180;
let domeLive = false, vYaw = null, vPitch = null;
function domeFrame(){
  if (!domeLive) return;
  const f = motion.facing(), s = motion.stat;
  if (f && f.heading != null){
    const pitch = Math.max(5, Math.min(89, -f.camAlt));
    vYaw = vYaw == null ? f.heading : (vYaw + wrapDeg(f.heading - vYaw)*0.25 + 360) % 360;
    vPitch = vPitch == null ? pitch : vPitch + (pitch - vPitch)*0.25;
    dome.setCamera(vYaw, vPitch);
    $('domeRead').innerHTML = s.relative
      ? 'Following motion · compass not ready<small>Hold upright and move in a figure 8</small>'
      : `${vYaw.toFixed(0)}° true ${DIRS16[Math.round(vYaw/22.5)%16]}<small>Flat = top view · upright = side view</small>`;
  } else {
    $('domeRead').innerHTML = s.events === 0
      ? `No motion readings yet<small>${navigator.brave ? 'Brave blocks sensors: use Safari, or turn Shields off for this site' : 'Check Motion & Orientation access, then reload'}</small>`
      : 'Waiting for compass…<small>Move the phone in a figure 8</small>';
  }
  requestAnimationFrame(domeFrame);
}
function setDomeLive(on){
  domeLive = on;
  $('domeLive').setAttribute('aria-pressed', on); $('domeLive').textContent = on ? 'Freeze' : 'Live';
  $('domeRead').hidden = !on; $('domeHint').hidden = on;
  if (on){ vYaw = null; vPitch = null; requestAnimationFrame(domeFrame); }
}
$('domeLive').addEventListener('click', async () => {
  if (domeLive){ setDomeLive(false); toast('Frozen · drag to spin'); return; }
  try { await motion.start(); setDomeLive(true); }
  catch(err){ toast(err.message || 'Motion access is not available'); }
});

// ---------- hide / show the bottom sun info (strip + date/time bar) ----------
function setInfo(show){
  $('sunInfo').hidden = !show; $('infoToggle').setAttribute('aria-expanded', show);
  $('infoToggleText').textContent = show ? 'Hide sun info' : 'Show sun info';
  store.set('infoShown', show);
  if (map) setTimeout(()=>map.invalidateSize(), 50);
  setTimeout(render, 30);
}
$('infoToggle').addEventListener('click', () => setInfo($('sunInfo').hidden));
setInfo(store.get('infoShown', true));

// keep "now" ticking while live
setInterval(() => { if (S.live){ setNow(); render(); } }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.live){ setNow(); render(); } });
new ResizeObserver(() => render()).observe($('tl'));

// ---------- boot ----------
$('lat').value = S.lat; $('lon').value = S.lon; $('height').value = S.heightIn; $('decl').value = S.decl;
setNow(); show(S.view);
