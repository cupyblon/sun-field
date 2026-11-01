/* Guided tour: a one-time walk through the app after the first How to use is closed.
   Each step switches to the real screen, spotlights it (the rest of the screen dims) and shows a short card;
   Next moves on, Skip ends it. "Take the tour" in How to use starts it again. Load after sheets.js.
   Uses $, store, show, setInfo, NO_SENSORS, toast from the other files. */
(function(){
  const phone = !NO_SENSORS;
  const STEPS = [
    {view:'times', target:'#view-times', tab:'times', title:'Home: Times',
     text:"Today's work light, dawn and dusk, golden and blue hour, and the seasons. This is where the app opens."},
    {view:'times', target:'#tl', title:'Pick a time',
     text:'Drag the light bar to any time of day. Pick a date on the left, or tap Now to go back to live.'},
    {view:'times', target:'.strip', title:'Info pages',
     text:'Swipe here (or use the arrows) for Sun, Twilight, Shadow, Moon, Moon phases, Milky Way and Sky today.'},
    {view:'dome', target:'#view-dome', tab:'dome', title:'Dome',
     text: phone ? "The sky as a 3D bowl: today's sun path, the moon and planets. Drag to spin, Layers to choose what shows, Live to follow your phone."
                 : "The sky as a 3D bowl: today's sun path, the moon and planets. Drag to spin, scroll to zoom, Layers to choose what shows."},
    {view:'ar', target:'#view-ar', tab:'ar', title:'Camera',
     text: phone ? "Point your phone at the sky to see the sun's path over the camera. Tap Calibrate, then put the crosshair on the sun and tap Align."
                 : "On a phone, this draws the sun's path over the camera. It needs a phone's compass, so it's off on a computer."},
    {view:'map', target:'#view-map', tab:'map', title:'Map',
     text:"Sunrise and sunset lines and the sun's direction from your spot. Tap the map to move your spot."},
    {view:'times', target:'#aboutBtn', title:'Help, any time',
     text:'How to use, tips, feedback and ways to support Sun Field are all under ⓘ.'}
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
  let i = -1;

  function place(){
    const s = STEPS[i], el = document.querySelector(s.target); if (!el) return;
    const r = el.getBoundingClientRect(), pad = 6, vw = window.innerWidth, vh = window.innerHeight;
    Object.assign(spot.style, {left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + 2*pad) + 'px', height: (r.height + 2*pad) + 'px'});
    // card goes below the target if there's room, otherwise above, otherwise over the middle of a big target
    const cw = Math.min(340, vw - 24), ch = card.offsetHeight || 170, gap = 16;
    let top, side;
    if (r.bottom + gap + ch < vh - 8){ top = r.bottom + gap; side = 'up'; }
    else if (r.top - gap - ch > 8){ top = r.top - gap - ch; side = 'down'; }
    else { top = Math.max(8, Math.min(vh - ch - 8, r.top + r.height/2 - ch/2)); side = 'none'; }
    const left = Math.max(12, Math.min(vw - cw - 12, r.left + r.width/2 - cw/2));
    Object.assign(card.style, {width: cw + 'px', left: left + 'px', top: top + 'px'});
    arrow.className = 'tour-arrow ' + side;
    arrow.style.left = Math.max(16, Math.min(cw - 32, r.left + r.width/2 - left - 8)) + 'px';
  }
  function go(n){
    i = n; const s = STEPS[i];
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('tour-tab', b.dataset.view === s.tab));
    if (s.view && S.view !== s.view) show(s.view);
    $('tourCount').textContent = `${i + 1} of ${STEPS.length}`;
    $('tourTitle').textContent = s.title; $('tourText').textContent = s.text;
    $('tourNext').textContent = i === STEPS.length - 1 ? 'Done' : 'Next';
    setTimeout(() => { place(); $('tourNext').focus(); }, s.view === 'map' ? 450 : 120);   // let the screen (and the map) settle
  }
  function start(){
    if (!root.hidden) return;
    if ($('sunInfo').hidden) setInfo(true);              // the light bar and info pages are part of the tour
    root.hidden = false; document.body.classList.add('touring'); go(0);
  }
  function end(finished){
    root.hidden = true; document.body.classList.remove('touring'); store.set('toured', true);
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('tour-tab'));
    show('times');                                       // always finish at home
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
  if (again) again.addEventListener('click', () => { $('aboutSheet').hidden = true; document.body.classList.remove('sheet-open'); setTimeout(start, 300); });
})();
