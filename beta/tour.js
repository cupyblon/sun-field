/* Guided tour: a one-time walk through the app after the first How to use is closed.
   Each step switches to the real screen, spotlights it (the rest of the screen dims) and shows a short card;
   Next moves on, Skip ends it. "Take the tour" in How to use starts it again. Load after sheets.js.
   The tour runs in Dashboard mode. Steps 8–9 introduce the layout switch and the location/compass tip.
   Uses $, store, show, setInfo, NO_SENSORS, toast from the other files. */
(function(){
  const phone = !NO_SENSORS;
  const STEPS = [
    // 1 — Dashboard Today page
    {layout:'dash', view:'times', dpage:'today', target:'.d-page[data-dp="today"]', tab:'times',
     title:'Dashboard: Today',
     text:"The sky picture follows the real sun and moon for the time you pick — dawn, day, golden hour or night with stars. Work light, your glance card and key times are right below."},
    // 2 — Pick a time (date bar in Dashboard)
    {layout:'dash', view:'times', dpage:'today', target:'#dDateBar',
     title:'Pick a date & time',
     text:'Use the arrows to step through days. The sky picture, all the numbers and the map update instantly.'},
    // 3 — Sun / Moon / Planets / Events tabs
    {layout:'dash', view:'times', dpage:'sun', target:'.tabs',
     title:'Sun, Moon, Planets & Events',
     text:'Tap the tabs to dig into rise and set times, moon phase and distance, planet positions and upcoming sky events. All calculated on this phone — no server needed.'},
    // 4 — Dome
    {layout:'dash', view:'dome', target:'#view-dome', tab:'dome',
     title:'Sky Dome',
     text: phone ? "The whole sky as a 3D bowl: today's sun path, the moon and planets. Drag to spin, Layers to choose what shows, Live to follow your phone."
                 : "The whole sky as a 3D bowl: today's sun path, the moon and planets. Drag to spin, scroll to zoom, Layers to choose what shows."},
    // 5 — Camera
    {layout:'dash', view:'ar', target:'#view-ar', tab:'ar',
     title:'Camera (AR)',
     text: phone ? "Point your phone at the sky to see the sun's path drawn over the camera. Tap Calibrate → put the crosshair on the sun → Align to lock it in."
                 : "On a phone, this draws the sun's path over the camera feed. It needs a phone compass, so it's off on a computer."},
    // 6 — Map
    {layout:'dash', view:'map', target:'#view-map', tab:'map',
     title:'Map',
     text:"Sunrise and sunset direction lines from your spot, plus the sun's current bearing. Tap anywhere on the map to move your spot."},
    // 7 — Help ⓘ
    {layout:'dash', view:'times', dpage:'today', target:'#aboutBtn',
     title:'Help any time',
     text:'How to use, tips, accuracy notes, feedback and ways to support Sun Field are all under ⓘ — including a replay of this tour.'},
    // 8 — Switch to Classic
    {layout:'dash', view:'times', dpage:'today', target:'#layoutBtn',
     title:'Switch to Classic view',
     text:"Tap ▦ to switch to the Classic layout — one scrolling page with the full timeline and swipe strip. Tap it again to come back to Dashboard. Your choice is remembered."},
    // 9 — Location arrow + figure-8 compass tip
    {layout:'dash', view:'times', dpage:'today', target:'#locateBtn',
     title:'Location & compass',
     text: phone ? "Tap the arrow to get a GPS fix — the header shows your town and the map centres on you. For a sharp compass reading, swing the phone in a figure-8 a few times before aligning in the Camera tab; it clears out magnetic drift."
                 : "Tap the arrow to get a GPS fix. The header shows your town and the map centres on your spot."}
  ];

  // overlay: a spotlight hole (its huge shadow dims everything else) and a card with an arrow
  const root = document.createElement('div');
  root.className = 'tour'; root.hidden = true;
  root.innerHTML = `<div class="tour-spot" aria-hidden="true"></div>
    <div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tourTitle" aria-describedby="tourText">
      <i class="tour-arrow" aria-hidden="true"></i>
      <div class="tour-count" id="tourCount"></div>
      <h3 id="tourTitle"></h3><p id="tourText" aria-live="polite"></p>
      <div class="tour-btns"><button type="button" class="chip" id="tourSkip">Skip tour</button><button type="button" class="big-btn" id="tourNext">Next</button></div>
    </div>`;
  document.body.appendChild(root);
  const spot = root.querySelector('.tour-spot'), card = root.querySelector('.tour-card'), arrow = root.querySelector('.tour-arrow');
  let i = -1, replay = false, layoutBefore = null;
  const app = document.querySelector('.app');            // everything behind the tour; made inert while it runs

  function place(){
    const s = STEPS[i], el = document.querySelector(s.target); if (!el) return;
    const r = el.getBoundingClientRect(), pad = 6, vw = window.innerWidth, vh = window.innerHeight;
    Object.assign(spot.style, {left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + 2*pad) + 'px', height: (r.height + 2*pad) + 'px'});
    // measure real header bottom so safeTop works on any screen size
    const hdr = document.querySelector('.top-bar') || document.querySelector('header');
    const hdrBottom = hdr ? hdr.getBoundingClientRect().bottom : 0;
    const tabBar = document.querySelector('.tabs');
    const tabBottom = tabBar ? tabBar.getBoundingClientRect().bottom : hdrBottom;
    const headerH = Math.max(hdrBottom, tabBottom);
    const gap = 16;
    // card width: narrower on small screens, up to 340 on wide
    const cw = Math.min(340, vw - 24);
    // set width before reading height so ch is accurate
    card.style.width = cw + 'px';
    const ch = card.offsetHeight || 180;
    let top, side;
    const inHeader = r.top < headerH + 4;   // target is in the fixed header/tab zone
    if (inHeader || r.bottom + gap + ch < vh - 16){
      // place below target; clamp so it never goes above tab bar
      top = Math.max(tabBottom + gap, r.bottom + gap); side = 'up';
    } else if (r.top - gap - ch > headerH + gap){
      top = r.top - gap - ch; side = 'down';
    } else {
      top = Math.max(tabBottom + gap, Math.min(vh - ch - 16, r.top + r.height / 2 - ch / 2)); side = 'none';
    }
    // final clamp: never above tab bar, never off bottom
    top = Math.max(tabBottom + gap, Math.min(vh - ch - 16, top));
    const left = Math.max(12, Math.min(vw - cw - 12, r.left + r.width / 2 - cw / 2));
    Object.assign(card.style, {left: left + 'px', top: top + 'px'});
    arrow.className = 'tour-arrow ' + side;
    arrow.style.left = Math.max(16, Math.min(cw - 32, r.left + r.width / 2 - left - 8)) + 'px';
  }
  function go(n){
    i = n; const s = STEPS[i];
    // switch layout if this step needs a specific one
    if (s.layout && window.sfLayout && window.sfLayout() !== s.layout) window.sfSetLayout(s.layout, true);
    // switch view
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('tour-tab', b.dataset.view === s.tab));
    if (s.view && S.view !== s.view) show(s.view);
    // switch dashboard page if specified
    if (s.dpage && typeof window.sfShowDPage === 'function') window.sfShowDPage(s.dpage);
    $('tourCount').textContent = `${i + 1} of ${STEPS.length}`;
    $('tourTitle').textContent = s.title; $('tourText').textContent = s.text;
    $('tourNext').textContent = i === STEPS.length - 1 ? 'Done' : 'Next';
    const delay = s.view === 'map' ? 500 : s.dpage ? 200 : 120;
    setTimeout(() => { place(); $('tourNext').focus(); }, delay);
  }
  function start(fromReplay){
    if (!root.hidden) return;
    replay = !!fromReplay;
    // remember where the user was; tour always uses Dashboard
    layoutBefore = window.sfLayout ? window.sfLayout() : null;
    if ($('sunInfo') && $('sunInfo').hidden) setInfo(true);
    if (app) app.inert = true;
    root.hidden = false; document.body.classList.add('touring'); go(0);
  }
  function end(finished){
    root.hidden = true; document.body.classList.remove('touring'); store.set('toured', true);
    if (app) app.inert = false;
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('tour-tab'));
    // restore the layout the user had before the tour (or stay in dash if they had it)
    if (layoutBefore && window.sfSetLayout) window.sfSetLayout(layoutBefore, true);
    show('times');
    // put keyboard focus somewhere useful
    const back = replay ? $('aboutBtn') : document.querySelector('.tabs button[data-view="times"]');
    if (back) back.focus();
    if (finished) toast("You're all set. ⓘ has help any time.");
  }
  $('tourNext').addEventListener('click', () => i < STEPS.length - 1 ? go(i + 1) : end(true));
  $('tourSkip').addEventListener('click', () => end(false));
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape'){ e.preventDefault(); end(false); }
    else if (e.key === 'Tab'){ e.preventDefault(); (document.activeElement === $('tourNext') ? $('tourSkip') : $('tourNext')).focus(); }
  });
  window.addEventListener('resize', () => { if (!root.hidden) place(); });

  // first visit: the tour starts when the welcome / How to use sheet is closed; it then shows only once
  new MutationObserver(() => {
    if ($('aboutSheet').hidden && window.sfFirstVisit && !store.get('toured', false)){ window.sfFirstVisit = false; setTimeout(start, 350); }
    else if ($('aboutSheet').hidden && window.sfFirstVisit === false && S.view !== 'times' && root.hidden && !store.get('toured', false)) show('times');
  }).observe($('aboutSheet'), {attributes: true, attributeFilter: ['hidden']});
  // "Take the tour" in How to use
  const again = $('tourAgain');
  if (again) again.addEventListener('click', () => { $('aboutSheet').hidden = true; document.body.classList.remove('sheet-open'); setTimeout(() => start(true), 300); });
})();
