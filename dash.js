/* Dashboard layout: an alternative to the Classic Times screen, idea by Jimmy Villalpando.
   Big icon tabs at the top: Today, Sun, Moon, Planets, Events, then Camera, Dome and Map.
   Today: work light over a drawn sky that follows the sun (scene.js), Sky at a Glance, key times, the sun's path,
   the daylight timeline with totals. Sun, Moon, Planets and Events: a page each. A date bar stays at the bottom.
   Switch layouts with the ▦ button in the header (remembered). Uses the same math and state as the rest of the app.
   Load after infopages.js and scene.js. */
(function(){
  // line icons for the tabs and header buttons
  const svg = d => `<svg viewBox="0 0 24 24">${d}</svg>`;
  const ICON = {
    times: svg('<path d="M2 19h20M6.5 19a5.5 5.5 0 0 1 11 0M12 6.5V9M5.3 10.8l1.6 1.6M18.7 10.8l-1.6 1.6M2.5 15h2M19.5 15h2"/>'),
    sun: svg('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.3M12 19.2v2.3M2.5 12h2.3M19.2 12h2.3M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>'),
    moon: svg('<path d="M20 14.6A8.3 8.3 0 1 1 9.4 4a6.6 6.6 0 0 0 10.6 10.6z"/>'),
    planets: svg('<circle cx="12" cy="12" r="5"/><ellipse cx="12" cy="12" rx="10.5" ry="3.4" transform="rotate(-22 12 12)"/>'),
    events: svg('<path d="M3 13l7-7M9 19l9-9M4 21l4-4"/><circle cx="12" cy="4.5" r="1.3"/><circle cx="20" cy="8" r="1.3"/><circle cx="10" cy="15" r="1.1"/>'),
    ar: svg('<rect x="2.5" y="7" width="19" height="13" rx="2.5"/><path d="M8 7l1.8-2.8h4.4L16 7"/><circle cx="12" cy="13.5" r="3.6"/>'),
    dome: svg('<path d="M2.5 18.5a9.5 9.5 0 0 1 19 0z"/><path d="M12 9v9.5M7.2 10.4c1 2.2 1.5 5.2 1.5 8.1M16.8 10.4c-1 2.2-1.5 5.2-1.5 8.1M4.2 14.3h15.6"/>'),
    map: svg('<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>'),
    loc: svg('<path d="M20.5 3.5L3.5 10.6l7 2.9 2.9 7z"/>')
  };
  const view = $('view-times');
  const dash = document.createElement('div');
  dash.id = 'dash'; dash.className = 'dash';
  const pageHead = (id, icon, name) => `<div class="d-phead"><h2 id="${id}"><span class="tab-ic" aria-hidden="true">${icon}</span>${name}</h2><span class="muted d-pdate"></span></div>`;
  dash.innerHTML = `
    <div class="d-page" data-dp="today">
    <section class="d-hero" aria-labelledby="dWorkTitle">
      <canvas id="dScene" class="d-scene" aria-hidden="true"></canvas>
      <div class="d-work">
        <div class="d-date" id="dDate"></div>
        <h2 id="dWorkTitle"><span aria-hidden="true">⛑</span> <span id="dWorkHead">Today's Work Light</span></h2>
        <div class="d-work-time data" id="dWorkTime"></div>
        <div class="d-work-note" id="dWorkNote"></div>
      </div>
      <div class="d-glance card" aria-labelledby="dGlanceTitle">
        <h2 id="dGlanceTitle">Sky at a Glance</h2>
        <ul id="dGlance"><li class="muted">Checking the sky…</li></ul>
      </div>
    </section>
    <div class="d-grid">
      <section class="card d-card" aria-labelledby="dKeyTitle">
        <h2 id="dKeyTitle">Today's Key Times</h2>
        <table class="d-times"><tbody id="dKey"></tbody></table>
        <div class="seg d-seg" role="group" aria-label="Golden and blue hour definitions">
          <button type="button" data-dmode="ss">Extended</button><button type="button" data-dmode="classic">Classic</button>
        </div>
      </section>
      <section class="card d-card" aria-labelledby="dPathTitle">
        <h2 id="dPathTitle">Sun Path &amp; Light</h2>
        <canvas id="dPath" class="d-path" role="img" aria-label="Today's sun path from sunrise to sunset"></canvas>
        <div class="d-stats">
          <div><b>Sun</b><span class="data" id="dSun">—</span></div>
          <div><b>Shadow ratio</b><span class="data" id="dRatio">—</span></div>
          <div><b>Shadow</b><span class="data" id="dShadow">—</span></div>
        </div>
      </section>
      <section class="card d-card" aria-labelledby="dLineTitle">
        <h2 id="dLineTitle">Daylight Timeline</h2>
        <canvas id="dLine" class="d-line" tabindex="0" role="slider" aria-label="Time of day. Drag, or use the arrow keys." aria-valuemin="0" aria-valuemax="1439"></canvas>
        <table class="d-totals"><tbody id="dTotals"></tbody></table>
      </section>
    </div>
    </div>
    <div class="d-page" data-dp="sun" hidden>
      ${pageHead('dpSun', ICON.sun, 'Sun')}
      <div class="d-cols">
        <section class="card d-card"><h3>Sun now</h3><div class="d-now data" id="spBig"></div><table class="d-times"><tbody id="spNow"></tbody></table></section>
        <section class="card d-card"><h3>Sunrise &amp; sunset</h3><table class="d-times"><tbody id="spRS"></tbody></table></section>
        <section class="card d-card"><h3>Golden &amp; blue hour</h3><table class="d-times"><tbody id="spGB"></tbody></table>
          <div class="seg d-seg" role="group" aria-label="Golden and blue hour definitions"><button type="button" data-dmode="ss">Extended</button><button type="button" data-dmode="classic">Classic</button></div></section>
        <section class="card d-card"><h3>Twilight</h3><table class="d-times"><tbody id="spTw"></tbody></table>
          <p class="muted small">Civil: enough light to work outside. Nautical: you can still see the horizon. Astronomical: the sky is fully dark beyond it.</p></section>
        <section class="card d-card"><h3 id="spSeaT">Seasons</h3><table class="d-times"><tbody id="spSea"></tbody></table></section>
      </div>
    </div>
    <div class="d-page" data-dp="moon" hidden>
      ${pageHead('dpMoon', ICON.moon, 'Moon')}
      <div class="d-cols">
        <section class="card d-card"><h3>Moon now</h3><div class="d-moon"><span id="mpIcon"></span><div><div class="d-now" id="mpPhase"></div><div class="muted" id="mpLit"></div></div></div>
          <table class="d-times"><tbody id="mpNow"></tbody></table></section>
        <section class="card d-card"><h3>Moonrise &amp; moonset</h3><table class="d-times"><tbody id="mpRS"></tbody></table></section>
        <section class="card d-card"><h3>Next phases</h3><table class="d-times"><tbody id="mpPh"></tbody></table></section>
        <section class="card d-card"><h3>Lunar eclipses you can see here</h3><table class="d-times"><tbody id="mpEcl"><tr><td class="muted">Working it out…</td></tr></tbody></table></section>
      </div>
    </div>
    <div class="d-page" data-dp="planets" hidden>
      ${pageHead('dpPlanets', ICON.planets, 'Planets')}
      <section class="card d-card"><h3>Tonight</h3><div id="ppTonight" class="d-tonight"></div></section>
      <div class="d-cols" id="ppList"></div>
      <p class="muted small">Positions are checked against PyEphem to within 0.1°. Rise and set are for a flat, open horizon; "best" is the highest point while the sky is dark.</p>
    </div>
    <div class="d-page" data-dp="events" hidden>
      ${pageHead('dpEvents', ICON.events, 'Events')}
      <div class="d-cols">
        <section class="card d-card"><h3>Today and tonight</h3><table class="d-times d-ev"><tbody id="epTonight"><tr><td class="muted">Checking the sky…</td></tr></tbody></table></section>
        <section class="card d-card"><h3>Milky Way tonight</h3><table class="d-times"><tbody id="epMW"></tbody></table></section>
        <section class="card d-card"><h3>Eclipses: next 3 years</h3><table class="d-times d-ev"><tbody id="epEcl"><tr><td class="muted">Working it out…</td></tr></tbody></table></section>
        <section class="card d-card d-wide"><h3>Coming up: next 60 days</h3><table class="d-times d-ev"><tbody id="epSoon"><tr><td class="muted">Working it out…</td></tr></tbody></table></section>
      </div>
      <p class="muted small">Meteor peaks from the IMO calendar; eclipses calculated for your spot and checked against NASA. Times are local.</p>
    </div>
    <div class="d-bar" role="group" aria-label="Date and time">
      <div class="d-datepick">
        <button type="button" class="chip" id="dPrev" aria-label="Previous day">‹</button>
        <input type="date" id="dDateInput" aria-label="Date">
        <button type="button" class="chip" id="dNext" aria-label="Next day">›</button>
      </div>
      <div class="d-mini"><b>Sunrise</b><span class="data d-big" id="dRise">—</span><span class="data d-deg" id="dRiseAz"></span></div>
      <div class="d-mini"><b id="dNowLbl">Sun</b><span class="data d-big" id="dNow">—</span><span class="data d-deg" id="dNowAz"></span></div>
      <div class="d-mini"><b>Sunset</b><span class="data d-big" id="dSet">—</span><span class="data d-deg" id="dSetAz"></span></div>
      <button type="button" class="chip d-nowbtn" id="dNowBtn">Now</button>
    </div>`;
  view.appendChild(dash);

  // ---------- tabs: icons on the four, plus Sun, Moon, Planets and Events (Dashboard only) ----------
  const nav = document.querySelector('.tabs');
  nav.querySelectorAll('button').forEach(b => { const name = b.textContent;
    b.innerHTML = `<span class="tab-ic" aria-hidden="true">${ICON[b.dataset.view]}</span><span class="tab-lb">${name}</span>`; });
  const timesTab = nav.querySelector('button[data-view="times"]');
  timesTab.insertAdjacentHTML('afterend', [['sun','Sun'], ['moon','Moon'], ['planets','Planets'], ['events','Events']].map(([k, n]) =>
    `<button type="button" class="dp-only" data-view="times" data-dpage="${k}"><span class="tab-ic" aria-hidden="true">${ICON[k]}</span><span class="tab-lb">${n}</span></button>`).join(''));
  const isDash = () => document.body.classList.contains('layout-dash');
  let dpage = store.get('dpage', 'today');
  function markTabs(){
    nav.querySelectorAll('button').forEach(b => {
      const cur = b.dataset.view === S.view && (S.view !== 'times' || (isDash() ? (b.dataset.dpage || 'today') === dpage : !b.dataset.dpage));
      b.setAttribute('aria-current', cur ? 'page' : 'false');
      if (cur && isDash() && b.scrollIntoView && nav.scrollWidth > nav.clientWidth) b.scrollIntoView({block: 'nearest', inline: 'nearest'});
    });
    dash.querySelectorAll('.d-page').forEach(p => p.hidden = p.dataset.dp !== dpage);
  }
  // picking a tab: which page of the Dashboard to show (runs before app.js switches the view)
  nav.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.dataset.view !== 'times') return;
    const next = b.dataset.dpage || 'today', changed = next !== dpage;
    dpage = next; store.set('dpage', dpage);
    if (changed) view.scrollTop = 0;
    if (b.classList.contains('dp-only')) show('times');            // the four new tabs have no handler of their own in app.js
  }, true);
  const baseShow = show;
  show = function(v){ baseShow(v); markTabs(); };

  // header: Jimmy's round icon buttons in the Dashboard (? opens How to use; the arrow gets your GPS location)
  $('locateBtn').innerHTML = `<span class="loc-ic" aria-hidden="true">${ICON.loc}</span><span class="loc-lb">Locate</span>`;
  $('locateBtn').setAttribute('aria-label', 'Use my GPS location'); $('locateBtn').title = 'Use my GPS location';
  $('aboutBtn').insertAdjacentHTML('beforebegin', '<button type="button" id="helpBtn" class="chip dash-only" aria-label="How to use" title="How to use">?</button>');
  $('helpBtn').addEventListener('click', () => { $('aboutBtn').click(); const t = document.querySelector('.about-tabs button[data-at="howto"]'); if (t) t.click(); });

  // ---------- switching layouts ----------
  function setLayout(which, quiet){
    const on = which === 'dash';
    document.body.classList.toggle('layout-dash', on); store.set('layout', which);
    $('layoutBtn').setAttribute('aria-pressed', on); $('layoutBtn').title = on ? 'Switch to Classic layout' : 'Switch to Dashboard layout';
    timesTab.querySelector('.tab-lb').textContent = on ? 'Today' : 'Times';
    markTabs();
    renderTimes.key = '';                                // Classic rebuilds its season table when it comes back
    if (!quiet) toast(on ? 'Dashboard layout · ▦ switches back' : 'Classic layout');
    setTimeout(render, 20);
  }
  window.sfSetLayout = setLayout;
  window.sfLayout = () => document.body.classList.contains('layout-dash') ? 'dash' : 'classic';
  $('layoutBtn').addEventListener('click', () => { if (S.view !== 'times') show('times'); setLayout(window.sfLayout() === 'dash' ? 'classic' : 'dash'); });
  setLayout(store.get('layout', 'classic'), true);

  // ---------- helpers ----------
  const R2 = Math.PI/180;
  const span = (a, b, tz) => a && b ? `${fmtT(a,tz)} – ${fmtT(b,tz)}` : '—';
  const dur = ms => { if (ms == null || ms < 0) return '—'; const m = Math.round(ms/60000); return `${Math.floor(m/60)} hr ${m%60} min`; };
  const fmtLen = inches => inches >= 12 ? `${(inches/12).toFixed(1)} ft` : `${inches.toFixed(1)} in`;
  function setDay(offset){
    const d = new Date(Date.UTC(S.Y, S.M-1, S.D + offset));
    S.Y = d.getUTCFullYear(); S.M = d.getUTCMonth()+1; S.D = d.getUTCDate(); S.live = false;
    $('date').value = `${S.Y}-${String(S.M).padStart(2,'0')}-${String(S.D).padStart(2,'0')}`;
    render();
  }
  $('dPrev').addEventListener('click', () => setDay(-1));
  $('dNext').addEventListener('click', () => setDay(1));
  $('dNowBtn').addEventListener('click', () => { setNow(); render(); });
  $('dDateInput').addEventListener('change', e => { const [y,m,d] = e.target.value.split('-').map(Number); if (y){ S.Y=y; S.M=m; S.D=d; S.live=false; $('date').value = e.target.value; render(); } });
  dash.querySelectorAll('[data-dmode]').forEach(b => b.addEventListener('click', () => { S.mode = b.dataset.dmode; store.set('mode', S.mode); render(); }));

  // ---------- Sun Path card: altitude over the day, sunrise to sunset, with the sun now ----------
  function drawPath(st){
    const cv = $('dPath'), dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight; if (!w) return;
    if (cv.width !== Math.round(w*dpr) || cv.height !== Math.round(h*dpr)){ cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,w,h);
    const {t, t0, t1, lat, lon, tz, ev} = st, font = cssv('--font');
    // the curve covers the whole day; the band above the horizon is the part that matters
    // x runs from an hour before sunrise to an hour after sunset (the whole day when the sun doesn't rise or set)
    const a0 = ev.sun.rise && ev.sun.set ? Math.max(t0, ev.sun.rise - 3600000) : t0, a1 = ev.sun.rise && ev.sun.set ? Math.min(t1, ev.sun.set + 3600000) : t1;
    const pts = []; let maxAlt = 5;
    for (let u = a0; u <= a1; u += 5*60000){ const a = sunPos(u,lat,lon).alt; pts.push([u, a]); maxAlt = Math.max(maxAlt, a); }
    const padX = 16, top = 16, horizon = h - 36, scaleY = (horizon - top) / (maxAlt + 2);
    const X = u => padX + (u - a0)/(a1 - a0)*(w - 2*padX), Y = a => horizon - Math.max(-4, a)*scaleY;
    const sky = g.createLinearGradient(0, top, 0, horizon); sky.addColorStop(0, 'rgba(47,111,184,.10)'); sky.addColorStop(1, 'rgba(242,168,64,.22)');
    g.fillStyle = sky; g.fillRect(0, top - 8, w, horizon - top + 8);
    g.strokeStyle = cssv('--line'); g.lineWidth = 1; g.beginPath(); g.moveTo(0, horizon); g.lineTo(w, horizon); g.stroke();
    g.strokeStyle = cssv('--path'); g.lineWidth = 2.5; g.beginPath(); let on = false;
    for (const [u, a] of pts){ if (a < -1){ on = false; continue; } on ? g.lineTo(X(u), Y(a)) : g.moveTo(X(u), Y(a)); on = true; } g.stroke();
    g.fillStyle = cssv('--path');
    for (let u = Math.ceil(a0/3600000)*3600000; u < a1; u += 3600000){ const a = sunPos(u,lat,lon).alt; if (a > 0){ g.beginPath(); g.arc(X(u), Y(a), 2.6, 0, 7); g.fill(); } }
    g.font = `600 11px ${font}`; g.textAlign = 'center'; g.fillStyle = cssv('--muted');
    for (const [k, ms] of [['rise', ev.sun.rise], ['set', ev.sun.set]]) if (ms){
      const x = Math.min(Math.max(X(ms), 34), w - 34);
      g.fillStyle = cssv(k === 'rise' ? '--rise' : '--set'); g.beginPath(); g.arc(X(ms), horizon, 4, 0, 7); g.fill();
      g.fillStyle = cssv('--fg'); g.fillText(fmtT(ms, tz), x, horizon + 15);
      g.fillStyle = cssv('--muted'); g.fillText(sunPos(ms,lat,lon).az.toFixed(1) + '°', x, horizon + 28);
    }
    const p = sunPos(t, lat, lon), x = X(t), y = Y(p.alt);
    if (p.alt > -1 && t >= a0 && t <= a1){
      g.fillStyle = cssv('--sun'); g.strokeStyle = cssv('--sun-edge'); g.lineWidth = 2; g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill(); g.stroke();
      const label = `${fmtT(t,tz)}  ${p.az.toFixed(1)}° ${p.alt >= 0 ? '+' : ''}${p.alt.toFixed(1)}°`;
      g.font = `700 11px ${font}`; const tw = g.measureText(label).width + 14, bx = Math.min(Math.max(x - tw/2, 2), w - tw - 2), by = y - 34 > 2 ? y - 34 : y + 14;
      g.fillStyle = 'rgba(7,9,15,.85)'; g.strokeStyle = cssv('--line'); g.lineWidth = 1; g.beginPath(); g.roundRect ? g.roundRect(bx, by, tw, 20, 6) : g.rect(bx, by, tw, 20); g.fill(); g.stroke();
      g.fillStyle = cssv('--fg'); g.textAlign = 'left'; g.fillText(label, bx + 7, by + 14);
    } else {
      g.fillStyle = cssv('--muted'); g.font = `600 12px ${font}`; g.textAlign = 'center'; g.fillText(p.alt > -1 ? 'Sun is up (outside this view)' : 'The sun is down', w/2, top + 12);
    }
  }

  // ---------- Daylight Timeline card: the same colour bar as the bottom bar, scrubbable ----------
  const bar = {key: null, cv: document.createElement('canvas')};
  function drawLine(st){
    const cv = $('dLine'), dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight; if (!w) return;
    if (cv.width !== Math.round(w*dpr) || cv.height !== Math.round(h*dpr)){ cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr); }
    const {t, t0, t1, tz} = st, barH = h - 18, key = [t0, st.lat, st.lon, tz, S.mode, cv.width, cv.height].join('|');
    if (bar.key !== key){ bar.key = key; drawTimelineBar(bar.cv, cv.width, cv.height, dpr, w, h, st, false, 11, 1, barH); }
    const g = cv.getContext('2d'); g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,cv.width,cv.height); g.drawImage(bar.cv, 0, 0);
    g.setTransform(dpr,0,0,dpr,0,0);
    const mx = (t - t0)/(t1 - t0)*w; g.fillStyle = cssv('--fg'); g.fillRect(mx - 1, 0, 2, barH);
    g.beginPath(); g.moveTo(mx - 6, 0); g.lineTo(mx + 6, 0); g.lineTo(mx, 7); g.closePath(); g.fill();
    cv.setAttribute('aria-valuenow', S.minute); cv.setAttribute('aria-valuetext', fmtT(t, tz));
  }
  let drag = false;
  function scrub(e){
    const r = $('dLine').getBoundingClientRect(), f = Math.min(Math.max((e.clientX - r.left)/r.width, 0), 0.9999), st = state();
    const x = st.t0 + (st.t1 - st.t0)*f, p = {}; dtf({timeZone:S.tz, hourCycle:'h23', hour:'2-digit', minute:'2-digit'}).formatToParts(new Date(x)).forEach(q => p[q.type] = q.value);
    S.minute = (+p.hour)*60 + (+p.minute); S.live = false; render();
  }
  $('dLine').addEventListener('pointerdown', e => { drag = true; $('dLine').setPointerCapture(e.pointerId); scrub(e); });
  $('dLine').addEventListener('pointermove', e => { if (drag) scrub(e); });
  $('dLine').addEventListener('pointerup', () => drag = false);
  $('dLine').addEventListener('pointercancel', () => drag = false);
  $('dLine').addEventListener('keydown', e => {
    const step = e.shiftKey ? 60 : 5; let m = S.minute;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') m += step; else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') m -= step; else return;
    e.preventDefault(); S.minute = Math.max(0, Math.min(1439, m)); S.live = false; render();
  });
  new ResizeObserver(() => { if (document.body.classList.contains('layout-dash') && S.view === 'times') render(); }).observe(dash);

  // ---------- Sky at a Glance: tonight's events, then the next meteor shower, eclipse and full moon (worked out once per day and place) ----------
  let glanceKey = '', glanceTimer = null;
  function fillGlance(st){
    const key = [st.t0, st.lat, st.lon, st.tz].join(','); if (key === glanceKey) return; glanceKey = key;
    clearTimeout(glanceTimer);
    glanceTimer = setTimeout(() => {
      const {t0, t1, lat, lon, tz} = st, day = 86400000, df = dtf({timeZone:tz, month:'short', day:'numeric'}), dfy = dtf({timeZone:tz, month:'short', day:'numeric', year:'numeric'});
      const rows = [];
      for (const e of skyEvents(t0, t1 + 12*3600000, lat, lon, tz).slice(0, 2))
        rows.push([e.icon, e.title, e.kind === 'conj' ? e.detail.split(' apart')[0] : '', fmtT(e.t, tz)]);
      const met = meteorPeaks(t1, t1 + 366*day).find(s => s.major);
      if (met) rows.push(['☄', `Next: ${met.name}`, '', df.format(new Date(met.t))]);
      const ecl = [...lunarEclipses(t1, t1 + 3*366*day, lat, lon).filter(e => e.visibleFrac > 0).map(e => ({t: e.t, what: `${e.type} lunar`})),
                   ...solarEclipsesLocal(t1, t1 + 3*366*day, lat, lon).map(e => ({t: e.t, what: 'Partial solar'}))].sort((a, b) => a.t - b.t)[0];
      if (ecl) rows.push(['◐', `Next eclipse (${ecl.what})`, '', dfy.format(new Date(ecl.t))]);
      const full = phaseTimes(180, t1, t1 + 32*day)[0];
      if (full && rows.length < 5) rows.push(['○', 'Next full moon', '', df.format(new Date(full))]);
      $('dGlance').innerHTML = rows.map(([ic, title, extra, when]) =>
        `<li><span class="g-ic" aria-hidden="true">${ic}</span><span class="g-t">${title}${extra ? ` <span class="muted">(${extra})</span>` : ''}</span><span class="g-w data">${when}</span></li>`).join('')
        || '<li class="muted">Nothing notable in the sky</li>';
    }, 60);
  }

  // ---------- small helpers for the pages ----------
  const compass = az => DIRS16[Math.round(az/22.5) % 16];
  const where = p => `${p.alt >= 0 ? '+' : ''}${p.alt.toFixed(1)}° high, ${p.az.toFixed(0)}° ${compass(p.az)}`;
  const tr = (name, val, sub) => `<tr><td>${name}${sub ? `<div class="sub">${sub}</div>` : ''}</td><td class="t">${val}</td></tr>`;
  const LIGHT = {'--day':'Daylight', '--gold':'Golden hour', '--gap':'Between golden and blue hour', '--blue':'Blue hour',
                 '--civil':'Civil twilight (work light)', '--naut':'Nautical twilight', '--astro':'Astronomical twilight', '--night':'Night'};
  const memo = {};                                       // one slot per kind; keeps only the latest day and place
  const once = (kind, key, fn) => { if (!memo[kind] || memo[kind].k !== key) memo[kind] = {k: key, v: fn()}; return memo[kind].v; };
  const later = {};                                      // heavier lists: worked out a moment after the page shows
  function soon(kind, key, fn){ if (later[kind] === key) return; later[kind] = key; setTimeout(() => { if (later[kind] === key) fn(); }, 40); }
  // first upward and downward crossing of the horizon in [t0, t1) for any body (alt in degrees)
  function crossing(altFn, t0, t1, step){
    let a = t0, fa = altFn(a), rise = null, set = null;
    for (let b = t0 + step; a < t1 && (rise == null || set == null); a = b, b += step){
      const fb = altFn(Math.min(b, t1));
      if ((fa < 0) !== (fb < 0)){ let lo = a, hi = Math.min(b, t1), flo = fa;
        for (let k = 0; k < 14; k++){ const m = (lo + hi)/2, fm = altFn(m); if ((fm < 0) === (flo < 0)){ lo = m; flo = fm; } else hi = m; }
        if (fa < 0){ if (rise == null) rise = (lo + hi)/2; } else if (set == null) set = (lo + hi)/2; }
      fa = fb;
    }
    return {rise, set};
  }
  const dayKey = st => [st.t0, st.lat, st.lon, st.tz].join(',');
  const dfDay = tz => dtf({timeZone:tz, weekday:'short', month:'short', day:'numeric'});

  // ---------- Sun page ----------
  function renderSun(st){
    const {t, ev, tz, lat, lon, t0} = st, d = DEFS[S.mode], p = sunPos(t, lat, lon), H = S.heightIn;
    $('spBig').textContent = `${p.az.toFixed(1)}° ${compass(p.az)} · ${p.alt >= 0 ? '+' : ''}${p.alt.toFixed(1)}°`;
    $('spNow').innerHTML = tr('Light', LIGHT[phaseOf(p.alt)], fmtT(t, tz)) +
      tr('Shadow ratio', p.alt > 0 ? `${(1/Math.tan(p.alt*R2)).toFixed(2)} : 1` : 'sun down', 'shadow length per unit of height') +
      tr('Shadow', p.alt > 0 ? fmtLen(H/Math.tan(p.alt*R2)) : '—', p.alt > 0 ? `for ${fmtLen(H)} tall · points ${compass((p.az + 180) % 360)}` : '');
    const np = sunPos(ev.noon, lat, lon);
    const y = once('sunY', dayKey(st) + S.mode, () => { const [a, b] = dayBounds(...ymd(S.Y, S.M, S.D - 1), tz); return crossings(a, b, lat, lon, -0.833); });
    const len = ev.sun.rise && ev.sun.set ? ev.sun.set - ev.sun.rise : null, ylen = y.rise && y.set ? y.set - y.rise : null;
    const diff = len != null && ylen != null ? Math.round((len - ylen)/1000) : null;
    $('spRS').innerHTML =
      tr('Sunrise', fmtT(ev.sun.rise, tz), ev.sun.rise ? `${sunPos(ev.sun.rise, lat, lon).az.toFixed(1)}° ${compass(sunPos(ev.sun.rise, lat, lon).az)}` : "doesn't rise today") +
      tr('Solar noon', fmtT(ev.noon, tz), `${np.alt >= 0 ? '+' : ''}${np.alt.toFixed(1)}° high, the sun's highest today`) +
      tr('Sunset', fmtT(ev.sun.set, tz), ev.sun.set ? `${sunPos(ev.sun.set, lat, lon).az.toFixed(1)}° ${compass(sunPos(ev.sun.set, lat, lon).az)}` : "doesn't set today") +
      tr('Day length', len != null ? dur(len) : '—', diff == null ? '' : diff === 0 ? 'same as yesterday' : `${Math.floor(Math.abs(diff)/60)} min ${Math.abs(diff) % 60} s ${diff > 0 ? 'longer' : 'shorter'} than yesterday`);
    const sp2 = (a, b) => a && b ? `${fmtT(a, tz)} – ${fmtT(b, tz)}` : 'does not occur', dd = (a, b) => a && b ? fmtSpanDur(a, b) : '';
    $('spGB').innerHTML =
      tr('Morning blue hour', sp2(ev.bLo.rise, ev.bHi.rise), `sun ${d.blue[0]}° to ${d.blue[1]}° ${dd(ev.bLo.rise, ev.bHi.rise) && '· ' + dd(ev.bLo.rise, ev.bHi.rise)}`) +
      tr('Morning golden hour', sp2(ev.gLo.rise, ev.gHi.rise), `${S.mode === 'ss' ? 'sunrise to +10°' : '−4° to +6°'} ${dd(ev.gLo.rise, ev.gHi.rise) && '· ' + dd(ev.gLo.rise, ev.gHi.rise)}`) +
      tr('Evening golden hour', sp2(ev.gHi.set, ev.gLo.set), `${S.mode === 'ss' ? '+10° to sunset' : '+6° to −4°'} ${dd(ev.gHi.set, ev.gLo.set) && '· ' + dd(ev.gHi.set, ev.gLo.set)}`) +
      tr('Evening blue hour', sp2(ev.bHi.set, ev.bLo.set), `sun ${d.blue[1]}° to ${d.blue[0]}° ${dd(ev.bHi.set, ev.bLo.set) && '· ' + dd(ev.bHi.set, ev.bLo.set)}`);
    $('spTw').innerHTML = tr('Astronomical dawn', fmtT(ev.astro.rise, tz), 'sun at −18°') + tr('Nautical dawn', fmtT(ev.naut.rise, tz), 'sun at −12°') +
      tr('Civil dawn', fmtT(ev.civ.rise, tz), 'sun at −6°, work light starts') + tr('Civil dusk', fmtT(ev.civ.set, tz), 'work light ends') +
      tr('Nautical dusk', fmtT(ev.naut.set, tz), 'sun at −12°') + tr('Astronomical dusk', fmtT(ev.astro.set, tz), 'full dark');
    $('spSeaT').textContent = `Solstices and equinoxes ${S.Y}`;
    $('spSea').innerHTML = once('sea', [S.Y, lat, lon, tz].join(','), () => {
      const df = dtf({timeZone:tz, month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}), pf = dtf({timeZone:tz, year:'numeric', month:'numeric', day:'numeric'});
      return [['March equinox', 0], ['June solstice', 90], ['September equinox', 180], ['December solstice', 270]].map(([n, deg]) => {
        const ms = seasonInstant(S.Y, deg), q = {}; pf.formatToParts(new Date(ms)).forEach(x => q[x.type] = x.value);
        const [a, b] = dayBounds(+q.year, +q.month, +q.day, tz), r = crossings(a, b, lat, lon, -0.833);
        return tr(n, df.format(new Date(roundMin(ms))), r.rise && r.set ? `day length ${dur(r.set - r.rise)}` : '');
      }).join(''); });
  }
  const ymd = (Y, M, D) => { const d = new Date(Date.UTC(Y, M - 1, D)); return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]; };

  // ---------- Moon page ----------
  const phaseName = (lit, waxing) => lit < 0.02 ? 'New moon' : lit > 0.98 ? 'Full moon' : Math.abs(lit - 0.5) < 0.04 ? (waxing ? 'First quarter' : 'Last quarter')
    : `${waxing ? 'Waxing' : 'Waning'} ${lit < 0.5 ? 'crescent' : 'gibbous'}`;
  function renderMoon(st){
    const {t, tz, lat, lon, t0, t1} = st, m = moonPos(t, lat, lon);
    $('mpIcon').innerHTML = moonSVG(m.lit, m.waxing, 64);
    $('mpPhase').textContent = phaseName(m.lit, m.waxing);
    $('mpLit').textContent = `${(m.lit*100).toFixed(0)}% lit`;
    $('mpNow').innerHTML = tr('Where', m.alt >= 0 ? where(m) : 'Below the horizon', m.alt >= 0 ? fmtT(t, tz) : `${m.az.toFixed(0)}° ${compass(m.az)}, ${m.alt.toFixed(1)}°`) +
      tr('Distance', `${Math.round(moonEcliptic(t).dist).toLocaleString()} km`, 'from Earth\'s center');
    const rs = once('mrs', dayKey(st), () => moonCrossings(t0, t1, lat, lon));
    const at = ms => { const q = moonPos(ms, lat, lon); return `${q.az.toFixed(1)}° ${compass(q.az)}`; };
    $('mpRS').innerHTML = tr('Moonrise', rs.rise ? fmtT(rs.rise, tz) : 'none today', rs.rise ? at(rs.rise) : '') +
      tr('Moonset', rs.set ? fmtT(rs.set, tz) : 'none today', rs.set ? at(rs.set) : '');
    const ph = once('mph', Math.floor(t/3600000), () => nextPhases(t)), df = dfDay(tz);
    const ic = {'New Moon':[0, true], 'First Quarter':[0.5, true], 'Full Moon':[1, true], 'Last Quarter':[0.5, false]};
    $('mpPh').innerHTML = ph.map(p => `<tr><td><span class="d-mi">${moonSVG(ic[p.name][0], ic[p.name][1], 20)}</span>${p.name}</td><td class="t">${p.t ? `${df.format(new Date(p.t))} · ${fmtT(p.t, tz)}` : '—'}</td></tr>`).join('');
    soon('mecl', dayKey(st), () => {
      const dfy = dtf({timeZone:tz, month:'short', day:'numeric', year:'numeric'});
      const list = lunarEclipses(t1, t1 + 6*366*86400000, lat, lon).filter(e => e.visibleFrac > 0).slice(0, 4);
      $('mpEcl').innerHTML = list.length ? list.map(e => tr(`${e.type} lunar eclipse`, dfy.format(new Date(e.t)),
        `max ${fmtT(e.t, tz)}${e.visibleFrac < 1 ? ` · watchable here ${fmtT(e.seeFrom, tz)}–${fmtT(e.seeTo, tz)}` : ''}${e.type === 'Penumbral' ? ' · faint shading only' : ''}`)).join('')
        : '<tr><td class="muted">None visible here in the next 6 years</td></tr>';
    });
  }

  // ---------- Planets page ----------
  function renderPlanets(st){
    const {t, tz, lat, lon, t0, t1} = st;
    const info = once('pl', dayKey(st), () => {
      const vis = planetsVisible(t0, t1, lat, lon), out = {};
      for (const n of PLANETS){
        const alt = ms => planetPos(n, ms, lat, lon).alt, rs = crossing(alt, t0, t1, 20*60000);
        let best = null;                                  // highest while the sky is dark, tonight
        for (let u = t0 + 12*3600000; u <= t1 + 12*3600000; u += 15*60000){
          if (sunPos(u, lat, lon).altGeo > -8) continue; const q = planetPos(n, u, lat, lon); if (!best || q.alt > best.alt) best = {...q, t: u}; }
        out[n] = {rs, best: best && best.alt > 5 ? best : null};
      }
      return {vis, out};
    });
    const {vis, out} = info;
    $('ppTonight').innerHTML = [vis.evening.length ? `<div><b>After sunset:</b> ${vis.evening.join(', ')}</div>` : '',
      vis.morning.length ? `<div><b>Before dawn:</b> ${vis.morning.join(', ')}</div>` : ''].join('') || '<div class="muted">No bright planets well placed tonight.</div>';
    const at = (n, ms) => { const q = planetPos(n, ms, lat, lon); return `${q.az.toFixed(0)}° ${compass(q.az)}`; };
    $('ppList').innerHTML = PLANETS.map(n => {
      const q = planetPos(n, t, lat, lon), {rs, best} = out[n];
      return `<section class="card d-card d-pl"><h3><span class="pl-dot" style="background:${PLANET_STYLE[n]}"></span>${n}</h3><table class="d-times"><tbody>` +
        tr('Now', q.alt > 0 ? 'Up' : 'Below horizon', q.alt > 0 ? where(q) : '') +
        tr('Rises', rs.rise ? fmtT(rs.rise, tz) : 'not today', rs.rise ? at(n, rs.rise) : '') +
        tr('Sets', rs.set ? fmtT(rs.set, tz) : 'not today', rs.set ? at(n, rs.set) : '') +
        tr('Best tonight', best ? fmtT(best.t, tz) : 'not up after dark', best ? where(best) : '') + '</tbody></table></section>';
    }).join('');
  }

  // ---------- Events page ----------
  function renderEvents(st){
    const {t, tz, lat, lon, t0, t1} = st;
    const evRow = (e, df) => `<tr><td><span class="sk-ic" aria-hidden="true">${e.icon}</span><b>${e.title}</b><div class="sub">${e.detail}</div></td><td class="t">${df.format(new Date(e.t))}</td></tr>`;
    const mw = once('mw', dayKey(st), () => mwWindow(t0, t1, lat, lon)), mc = mwCorePos(t, lat, lon), ml = moonPos(t0 + 24*3600000, lat, lon).lit;
    $('epMW').innerHTML = tr('Core now', mc.alt > 0 ? 'Up' : 'Below horizon', where(mc)) +
      tr('Dark-sky window', mw.start && mw.end ? `${fmtT(mw.start, tz)} – ${fmtT(mw.end, tz)}` : 'not tonight', mw.best ? `highest +${mw.best.alt.toFixed(0)}° at ${fmtT(mw.best.t, tz)}, ${compass(mw.best.az)}` : 'the core is only up in daylight') +
      tr('Moonlight', `${Math.round(ml*100)}% lit`, ml > 0.5 ? 'a bright moon washes out the Milky Way while it is up' : 'a dim moon helps');
    soon('ev', dayKey(st), () => {
      const tf = dtf({timeZone:tz, hour:'numeric', minute:'2-digit'}), df = dfDay(tz), dfy = dtf({timeZone:tz, month:'short', day:'numeric', year:'numeric'});
      const tonight = skyEvents(t0, t1 + 12*3600000, lat, lon, tz);
      $('epTonight').innerHTML = tonight.length ? tonight.map(e => evRow(e, tf)).join('') : '<tr><td class="muted">Nothing special today or tonight</td></tr>';
      const next = skyEvents(t1 + 12*3600000, t0 + 60*86400000, lat, lon, tz);
      $('epSoon').innerHTML = next.length ? next.map(e => evRow(e, df)).join('') : '<tr><td class="muted">Nothing notable in the next 60 days</td></tr>';
      const yr = 3*366*86400000;
      const ecl = [...lunarEclipses(t0, t0 + yr, lat, lon).filter(e => e.visibleFrac > 0).map(e => ({t: e.t, icon: '◐', title: `${e.type} lunar eclipse`, detail: `max ${tf.format(new Date(e.t))}${e.visibleFrac < 1 ? ' · partly visible here' : ''}`})),
                   ...solarEclipsesLocal(t0, t0 + yr, lat, lon).map(e => ({t: e.t, icon: '◑', title: 'Partial solar eclipse', detail: `${Math.max(1, Math.round(e.obscuration*100))}% of the Sun covered · eclipse glasses only`}))].sort((a, b) => a.t - b.t);
      $('epEcl').innerHTML = ecl.length ? ecl.map(e => evRow(e, dfy)).join('') : '<tr><td class="muted">None visible here in the next 3 years</td></tr>';
    });
  }

  // ---------- the whole dashboard ----------
  const PAGES = {sun: renderSun, moon: renderMoon, planets: renderPlanets, events: renderEvents};
  // ---------- the whole dashboard ----------
  window.renderDash = function(st){
    const pdate = dtf({timeZone:st.tz, weekday:'long', month:'long', day:'numeric', year:'numeric'}).format(new Date(st.t)) + (S.live ? '' : ` · ${fmtT(st.t, st.tz)}`);
    dash.querySelectorAll('.d-pdate').forEach(el => el.textContent = pdate);
    dash.querySelectorAll('[data-dmode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.dmode === S.mode));
    renderBar(st);
    if (PAGES[dpage]){ PAGES[dpage](st); return; }
    renderToday(st);
  };
  function renderToday(st){
    const {t, ev, tz, lat, lon, t0, t1} = st, d = DEFS[S.mode], wl = workLight(st);
    const now = {}; dtf({timeZone:tz, year:'numeric', month:'numeric', day:'numeric'}).formatToParts(new Date()).forEach(x => now[x.type] = x.value);
    const isToday = +now.year === S.Y && +now.month === S.M && +now.day === S.D;
    $('dDate').textContent = dtf({timeZone:tz, weekday:'short', month:'short', day:'numeric', year:'numeric'}).format(new Date(t));
    $('dWorkHead').textContent = isToday ? "Today's Work Light" : 'Work Light';
    $('dWorkTime').textContent = wl.end ? `Good outdoor light: ${wl.start} – ${wl.end}` : wl.start === 'All day' ? 'Good outdoor light: all day' : 'No usable outdoor light';
    $('dWorkNote').textContent = wl.note;
    $('dKeyTitle').textContent = isToday ? "Today's Key Times" : 'Key Times';
    const row = (sw, name, val, durTxt) => `<tr><td><span class="sw" style="background:var(${sw})"></span>${name}</td><td class="t">${val}${durTxt ? ` <span class="muted">(${durTxt})</span>` : ''}</td></tr>`;
    const sp = (a, b) => a && b ? fmtSpanDur(a, b) : '';
    $('dKey').innerHTML =
      row('--civil', 'Dawn (civil)', fmtT(ev.civ.rise, tz)) +
      row('--blue', 'Blue hour', span(ev.bLo.rise, ev.bHi.rise, tz), sp(ev.bLo.rise, ev.bHi.rise)) +
      row('--rise', 'Sunrise', fmtT(ev.sun.rise, tz)) +
      row('--gold', 'Golden hour', span(ev.gLo.rise, ev.gHi.rise, tz), sp(ev.gLo.rise, ev.gHi.rise)) +
      row('--day', 'Solar noon', fmtT(ev.noon, tz)) +
      row('--gold', 'Golden hour', span(ev.gHi.set, ev.gLo.set, tz), sp(ev.gHi.set, ev.gLo.set)) +
      row('--set', 'Sunset', fmtT(ev.sun.set, tz)) +
      row('--blue', 'Blue hour', span(ev.bHi.set, ev.bLo.set, tz), sp(ev.bHi.set, ev.bLo.set)) +
      row('--civil', 'Dusk (civil)', fmtT(ev.civ.set, tz));
    // sun now
    const p = sunPos(t, lat, lon), H = S.heightIn;
    $('dSun').textContent = `${p.az.toFixed(1)}° az · ${p.alt >= 0 ? '+' : ''}${p.alt.toFixed(1)}° alt`;
    $('dRatio').textContent = p.alt > 0 ? `${(1/Math.tan(p.alt*R2)).toFixed(1)} : 1` : 'sun down';
    $('dShadow').textContent = p.alt > 0 ? `${fmtLen(H/Math.tan(p.alt*R2))} for ${fmtLen(H)} tall` : '—';
    // totals
    const dayLen = t1 - t0, daylight = ev.sun.rise && ev.sun.set ? ev.sun.set - ev.sun.rise : (wl.start === 'All day' && !ev.sun.rise && !ev.sun.set ? dayLen : 0);
    const usable = ev.civ.rise && ev.civ.set ? ev.civ.set - ev.civ.rise : (wl.start === 'All day' ? dayLen : 0);
    $('dTotals').innerHTML = [['☀️', 'Daylight', dur(daylight)], ['⛑', 'Usable light', dur(usable)], ['🌙', 'Night', dur(dayLen - daylight)]]
      .map(([ic, n, v]) => `<tr><td><span aria-hidden="true">${ic}</span> ${n}</td><td class="t data">${v}</td></tr>`).join('');
    drawScene($('dScene'), st); drawPath(st); drawLine(st); fillGlance(st);
  }
  function renderBar(st){
    const {t, ev, tz, lat, lon} = st, p = sunPos(t, lat, lon);
    $('dDateInput').value = `${S.Y}-${String(S.M).padStart(2,'0')}-${String(S.D).padStart(2,'0')}`;
    $('dRise').textContent = ev.sun.rise ? fmtT(ev.sun.rise, tz) : '—'; $('dRiseAz').textContent = ev.sun.rise ? sunPos(ev.sun.rise,lat,lon).az.toFixed(1) + '°' : '';
    $('dSet').textContent = ev.sun.set ? fmtT(ev.sun.set, tz) : '—';   $('dSetAz').textContent = ev.sun.set ? sunPos(ev.sun.set,lat,lon).az.toFixed(1) + '°' : '';
    $('dNowLbl').textContent = S.live ? 'Sun now' : 'Sun';
    $('dNow').textContent = fmtT(t, tz); $('dNowAz').textContent = `${p.az.toFixed(1)}° ${p.alt >= 0 ? '+' : ''}${p.alt.toFixed(1)}°`;
  }
})();
