/* Dashboard layout: an alternative to the Classic Times screen, idea by Jimmy Villalpando.
   One screen with everything for the day: work light up top, Sky at a Glance, key times, the sun's path,
   the daylight timeline with totals, and a date bar. Switch with the ▦ button in the header (remembered).
   Uses the same math and state as the rest of the app (sun.js, events.js, app.js). Load after infopages.js. */
(function(){
  const view = $('view-times');
  const dash = document.createElement('div');
  dash.id = 'dash'; dash.className = 'dash';
  dash.innerHTML = `
    <section class="d-hero" aria-labelledby="dWorkTitle">
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

  // ---------- switching layouts ----------
  const timesTab = document.querySelector('.tabs button[data-view="times"]');
  function setLayout(which, quiet){
    const on = which === 'dash';
    document.body.classList.toggle('layout-dash', on); store.set('layout', which);
    $('layoutBtn').setAttribute('aria-pressed', on); $('layoutBtn').title = on ? 'Switch to Classic layout' : 'Switch to Dashboard layout';
    timesTab.textContent = on ? 'Today' : 'Times';
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

  // ---------- the whole dashboard ----------
  window.renderDash = function(st){
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
    dash.querySelectorAll('[data-dmode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.dmode === S.mode));
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
    // bottom bar
    $('dDateInput').value = `${S.Y}-${String(S.M).padStart(2,'0')}-${String(S.D).padStart(2,'0')}`;
    $('dRise').textContent = ev.sun.rise ? fmtT(ev.sun.rise, tz) : '—'; $('dRiseAz').textContent = ev.sun.rise ? sunPos(ev.sun.rise,lat,lon).az.toFixed(1) + '°' : '';
    $('dSet').textContent = ev.sun.set ? fmtT(ev.sun.set, tz) : '—';   $('dSetAz').textContent = ev.sun.set ? sunPos(ev.sun.set,lat,lon).az.toFixed(1) + '°' : '';
    $('dNowLbl').textContent = S.live ? 'Sun now' : 'Sun';
    $('dNow').textContent = fmtT(t, tz); $('dNowAz').textContent = `${p.az.toFixed(1)}° ${p.alt >= 0 ? '+' : ''}${p.alt.toFixed(1)}°`;
    drawPath(st); drawLine(st); fillGlance(st);
  };
})();
