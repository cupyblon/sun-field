/* Swipeable info strip: Sun, Twilight, Shadow, Moon, Moon phases, Milky Way. Load after app.js and moon.js.
   Turns the bottom strip into pages you swipe (or tap the arrows / dots); remembers the last page. */
(function(){
  const strip = document.querySelector('.strip');
  if (!strip || typeof moonPos !== 'function') return;
  const sunCols = strip.innerHTML;                       // keep the original Sun page and its ids (app.js still fills them)
  strip.classList.add('pages');
  strip.innerHTML = `
    <div class="pager" id="pager">
      <div class="page cols3" data-name="Sun">${sunCols}</div>
      <div class="page twi" data-name="Twilight">
        <span></span><b>Civil</b><b>Nautical</b><b>Astronomical</b>
        <span class="rl">Dawn</span><span class="data" id="tCd">—</span><span class="data" id="tNd">—</span><span class="data" id="tAd">—</span>
        <span class="rl">Dusk</span><span class="data" id="tCk">—</span><span class="data" id="tNk">—</span><span class="data" id="tAk">—</span>
      </div>
      <div class="page shadow" data-name="Shadow">
        <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true"><rect x="28" y="6" width="6" height="30" rx="1" fill="var(--fg)"/><path d="M4 36 L28 36 L34 36 L34 40 L4 40 Z" fill="var(--muted)"/></svg>
        <div class="sh-rows">
          <div><span class="muted">Object height</span><button type="button" class="sh-edit" id="shEdit" aria-label="Change object height"><span class="data" id="shH">—</span> <span aria-hidden="true">✎</span></button>
            <input id="shInput" type="number" inputmode="decimal" min="0" step="any" aria-label="Object height in inches" hidden></div>
          <div><span class="muted">Shadow length</span><span class="data" id="shL">—</span></div>
        </div>
      </div>
      <div class="page cols3" data-name="Moon">
        <div style="--c:#c8d0e0"><b>Moon</b><span class="data" id="mNow">—</span></div>
        <div style="--c:#9aa5c2"><b>Moonrise</b><span class="data" id="mRise">—</span></div>
        <div style="--c:#6b7491"><b>Moonset</b><span class="data" id="mSet">—</span></div>
      </div>
      <div class="page phases" data-name="Moon phases" id="phases"></div>
      <div class="page cols2" data-name="Milky Way">
        <div style="--c:#b9a7ff"><b>Milky Way core</b><span class="data" id="mwNow">—</span></div>
        <div style="--c:#7d6be0"><b>Dark-sky window</b><span class="data" id="mwWin">—</span></div>
      </div>
      ${typeof skyEvents === 'function' ? '<div class="page skytoday" data-name="Sky today" id="skyToday"><span class="muted">Checking the sky…</span></div>' : ''}
    </div>
    <button type="button" class="pg-arrow prev" id="pgPrev" aria-label="Previous page">‹</button>
    <button type="button" class="pg-arrow next" id="pgNext" aria-label="Next page">›</button>
    <div class="dots" id="dots" role="tablist" aria-label="Info pages"></div>`;

  const pager = document.getElementById('pager'), pages = [...pager.querySelectorAll('.page')];
  const dots = document.getElementById('dots');
  dots.innerHTML = pages.map((p,i)=>`<button type="button" role="tab" aria-label="${p.dataset.name}" data-i="${i}"></button>`).join('');
  const cur = () => Math.round(pager.scrollLeft / Math.max(1, pager.clientWidth));
  function mark(){ const i = cur(); dots.querySelectorAll('button').forEach((b,k)=>b.setAttribute('aria-selected', k===i));
    document.getElementById('pgPrev').disabled = i === 0; document.getElementById('pgNext').disabled = i === pages.length-1; store.set('infoPage', i); }
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  const go = i => pager.scrollTo({left: i*pager.clientWidth, behavior: calm.matches ? 'auto' : 'smooth'});
  pager.addEventListener('scroll', () => { clearTimeout(pager._t); pager._t = setTimeout(mark, 60); });
  dots.addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(+b.dataset.i); });
  document.getElementById('pgPrev').addEventListener('click', () => go(Math.max(0, cur()-1)));
  document.getElementById('pgNext').addEventListener('click', () => go(Math.min(pages.length-1, cur()+1)));
  requestAnimationFrame(() => { pager.scrollLeft = store.get('infoPage', 0) * pager.clientWidth; mark(); });
  window.addEventListener('resize', () => { pager.scrollLeft = store.get('infoPage', 0) * pager.clientWidth; });

  // shadow height editing (shares the height setting with the Times tab)
  const shIn = document.getElementById('shInput'), shEdit = document.getElementById('shEdit');
  shEdit.addEventListener('click', () => { shIn.value = S.heightIn; shEdit.hidden = true; shIn.hidden = false; shIn.focus(); shIn.select(); });
  const commit = () => { const v = +shIn.value; if (v > 0){ S.heightIn = v; store.set('heightIn', v); const h = document.getElementById('height'); if (h) h.value = v; }
    shIn.hidden = true; shEdit.hidden = false; render(); };
  shIn.addEventListener('change', commit); shIn.addEventListener('blur', commit);
  shIn.addEventListener('keydown', e => { if (e.key === 'Enter') shIn.blur(); });

  // ---- Times tab: today's highlight banner and a 30-day "coming up" list ----
  const pad = document.querySelector('#view-times .pad');
  if (pad && typeof skyEvents === 'function'){
    const banner = document.createElement('div'); banner.className = 'sky-banner'; banner.id = 'skyBanner'; banner.hidden = true;
    const card = document.createElement('div'); card.className = 'card'; card.innerHTML = '<h2>Coming up in the sky</h2><table><tbody id="skyList"><tr><td class="muted">Working it out…</td></tr></tbody></table><p class="muted small">Meteor peaks from the IMO calendar; eclipses calculated for your spot and checked against NASA. Times are local.</p>';
    pad.insertBefore(banner, pad.firstChild);
    const settings = pad.querySelector('.card.settings'); pad.insertBefore(card, settings);   // after the sun lists, above Settings
  }

  // ---- filling the pages ----
  // one slot per kind ("mrs", "ph", "mw"): keeps only the latest result, so the cache can't grow without limit
  const cache = {};
  const memo = (key, fn) => { const [kind, ...rest] = key.split('|'), k = rest.join('|');
    if (!cache[kind] || cache[kind].k !== k) cache[kind] = {k, v: fn()}; return cache[kind].v; };
  const fmtLenIn = v => v >= 12 ? `${(v/12).toFixed(2)} ft (${Math.floor(v/12)}′ ${(v%12).toFixed(1)}″)` : `${v.toFixed(1)} in`;
  const dateFmt = tz => dtf({timeZone:tz,month:'numeric',day:'numeric',year:'2-digit'});

  function fill(){
    const st = state(), {t, t0, t1, lat, lon, tz, ev} = st, T = id => document.getElementById(id);
    // twilight
    T('tCd').textContent = fmtT(ev.civ.rise,tz);  T('tNd').textContent = fmtT(ev.naut.rise,tz);  T('tAd').textContent = fmtT(ev.astro.rise,tz);
    T('tCk').textContent = fmtT(ev.civ.set,tz);   T('tNk').textContent = fmtT(ev.naut.set,tz);   T('tAk').textContent = fmtT(ev.astro.set,tz);
    // shadow
    const sp = sunPos(t,lat,lon), H = S.heightIn;
    T('shH').textContent = fmtLenIn(H);
    T('shL').textContent = sp.alt > 0 ? fmtLenIn(H/Math.tan(sp.alt*R)) + (sp.alt < 5 ? ' (rough, sun very low)' : '') : 'No shadow (sun down)';
    // moon
    const dayKey = [t0, lat, lon].join(',');
    const mp = moonPos(t,lat,lon), mrs = memo('mrs|'+dayKey, () => moonCrossings(t0,t1,lat,lon));
    T('mNow').textContent = `${mp.az.toFixed(1)}°\n${mp.alt>=0?'+':''}${mp.alt.toFixed(1)}°\n${(mp.lit*100).toFixed(1)}% ${mp.waxing?'waxing':'waning'}`;
    T('mRise').textContent = mrs.rise ? `${fmtT(mrs.rise,tz)}\n${moonPos(mrs.rise,lat,lon).az.toFixed(1)}°` : 'none today';
    T('mSet').textContent  = mrs.set  ? `${fmtT(mrs.set,tz)}\n${moonPos(mrs.set,lat,lon).az.toFixed(1)}°` : 'none today';
    // phases (next four from the selected time)
    const ph = memo('ph|'+Math.floor(t/3600000), () => nextPhases(t)), df = dateFmt(tz);
    const icon = {'New Moon':[0,true],'First Quarter':[0.5,true],'Full Moon':[1,true],'Last Quarter':[0.5,false]};
    T('phases').innerHTML = ph.map(p => `<div>${moonSVG(icon[p.name][0], icon[p.name][1], 30)}<b>${p.name}</b><span class="data">${p.t ? df.format(new Date(p.t)) : '—'}\n${p.t ? fmtT(p.t,tz) : ''}</span></div>`).join('');
    // milky way
    const mw = mwCorePos(t,lat,lon), win = memo('mw|'+dayKey, () => mwWindow(t0,t1,lat,lon));
    T('mwNow').textContent = `${mw.az.toFixed(1)}°  ${mw.alt>=0?'+':''}${mw.alt.toFixed(1)}°\n${mw.alt > 0 ? 'above the horizon' : 'below the horizon'}`;
    T('mwWin').textContent = win.start && win.end
      ? `${fmtT(win.start,tz)} – ${fmtT(win.end,tz)}\nhighest +${win.best.alt.toFixed(0)}° @ ${win.best.az.toFixed(0)}°, ${fmtT(win.best.t,tz)}`
      : 'not visible tonight\n(core is up only in daylight)';
  }
  // sky events: heavier, so computed once per day/place and a moment after the page settles
  let skyKey = '', skyTimer = null;
  function fillSky(){
    if (typeof skyEvents !== 'function') return;
    const st = state(), {t0, t1, lat, lon, tz} = st, key = [t0, lat, lon, tz].join(',');
    if (key === skyKey) return; skyKey = key;
    clearTimeout(skyTimer);
    skyTimer = setTimeout(() => {
      const T = id => document.getElementById(id);
      const df = dtf({timeZone:tz,weekday:'short',month:'short',day:'numeric'});
      const tonight = skyEvents(t0, t1 + 12*3600000, lat, lon, tz);
      const vis = planetsVisible(t0, t1, lat, lon);
      const pl = [vis.evening.length ? `Evening: ${vis.evening.join(', ')}` : '', vis.morning.length ? `Before dawn: ${vis.morning.join(', ')}` : ''].filter(Boolean).join(' · ');
      const rows = tonight.slice(0, 2).map(e => `<div class="sk-row"><span class="sk-ic">${e.icon}</span><span><b>${e.title}</b> <span class="muted">${e.detail}</span></span></div>`).join('');
      T('skyToday').innerHTML = (rows || '<div class="sk-row"><span class="sk-ic">✓</span><span class="muted">Nothing special today or tonight</span></div>')
        + `<div class="sk-row"><span class="sk-ic">🪐</span><span class="muted">${pl || 'No bright planets well placed tonight'}</span></div>`
        + (tonight.length > 2 ? `<div class="sk-more muted">+${tonight.length-2} more in the Times tab</div>` : '');
      const big = tonight.filter(e => e.major);
      const banner = T('skyBanner');
      if (banner){ banner.hidden = !big.length;
        banner.innerHTML = big.map(e => `<div><span class="sk-ic">${e.icon}</span><span><b>${e.title}</b><br><span class="small">${e.detail}</span></span></div>`).join(''); }
      const list = T('skyList');
      if (list){ const month = skyEvents(t0, t0 + 30*86400000, lat, lon, tz);
        list.innerHTML = month.length ? month.map(e => `<tr><td><span class="sk-ic">${e.icon}</span><b>${e.title}</b><div class="sub">${e.detail}</div></td><td class="t">${df.format(new Date(e.t))}</td></tr>`).join('')
                                      : '<tr><td class="muted">Nothing notable in the next 30 days</td></tr>'; }
    }, 150);
  }
  const baseRender = render;
  render = function(){ baseRender.apply(this, arguments); try { fill(); fillSky(); } catch(e){ console.error(e); } };
  render();
})();
