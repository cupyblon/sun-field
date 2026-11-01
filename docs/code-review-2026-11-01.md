# Sun Field code review: November 1, 2026 (v16 → v18)

A line-by-line review of every file in the repo for efficiency, memory use, dead code and clarity. Changes were approved item by item, built on a beta page, verified, then merged as version 18.

## What was reviewed

All app files (`sun.js`, `moon.js`, `planets.js`, `events.js`, `dome.js`, `motion.js`, `ar.js`, `app.js`, `infopages.js`, `sheets.js`, `sw.js`, `index.html`, `style.css`), the bundled libraries (`vendor/`), tests and tools. Methods:

- reading each file
- a script that lists every top-level function and constant and counts its uses (to find dead code)
- a browser pass that opens every tab, panel and state and records which CSS rules ever match
- timing of the hot paths in a headless phone-sized browser

## Findings

**No bugs and no memory leaks found.** Every in-memory cache is bounded: the dome memo clears at 80 entries, the camera memo at 30, the info pages keep one result per kind, the day-events cache holds one day, and the motion buffer keeps 1.5 seconds of readings. The offline tile store is capped at 400 tiles. No user-typed text is ever inserted as HTML.

The real costs were in a few hot paths.

## Changes: speed (A)

| # | Change | Files | Before → after |
|---|---|---|---|
| A1 | Date/time formatters built once and reused (`dtf()` in `sun.js` caches `Intl.DateTimeFormat` by options). Building one costs ~80 µs, and the app formatted times ~30 times per screen update. | `sun.js`, `app.js`, `ar.js`, `dome.js`, `events.js`, `infopages.js` | Full screen update 7.1 → 3.2 ms; time-zone conversion 147 → 10 µs |
| A2 | Motion sensors run only while something uses them. `motion.use(who, on)` attaches the `deviceorientation` listener while Live, the Camera or Calibrate is active, and detaches it otherwise. `start()` now only asks for permission. | `motion.js`, `app.js`, `ar.js`, `sheets.js` | Sensor events stop when not needed (battery) |
| A3 | Map tiles: a saved tile is returned at once and refreshed in the background (stale-while-revalidate). The 400-tile cap is enforced by a single debounced background trim, instead of listing the whole store after every tile. | `sw.js` | No 5 s wait on weak signal for tiles already seen |
| A4 | Leaflet (~150 KB) loads the first time the Map tab opens. It is still precached by the service worker, so the Map works offline. Its version tag is read from the page's own script tag, so releases never need a second edit. | `index.html`, `app.js` | Startup no longer parses Leaflet |
| A5 | Timeline: the colour bar and hour ticks are drawn into an offscreen canvas once per day, place, mode and size; updates copy it and draw only the marker. | `app.js` | 0.94 → 0.05 ms per drag step |
| A6 | Dome: the celestial grid (~2,000 coordinate conversions) is computed once per latitude. | `dome.js` | Dome frame with that layer on 1.75 → 1.15 ms |

## Changes: cleanup (B), no visible change

- **B7, dead code removed:** `planetCrossings`; `motion.stat.lastH`; the unused `moonAltAtMax` and `sunAltAtMax`; about 15 `typeof moonPos/planetPos/skyEvents === 'function'` checks and the `V6` flag (left from when features shipped as separate beta files; every engine now always loads); a timeline marker drawn twice.
- **B8, dead CSS removed:** 5 rules from the pre-swipe info strip that were always overridden.
- **B9, header comments updated:** `dome.js`, `motion.js`, `infopages.js`.
- **B10, colour token:** `--moon` added instead of a hard-coded fallback.

## Deliberately not changed

- **Theme colour lookups** (`colors()`, 21 `getComputedStyle` reads): measured at 21 µs, not worth caching.
- **No framework or build step:** plain JavaScript files keep the app easy to read and change.
- **No math changes.** All astronomy results are unchanged; see Verification.
- **Structure (review item C11, optional):** `infopages.js` wraps `render()` and `sheets.js` wraps `setLocation()` from outside. This works and is tested, but it is harder to follow than having the code inside `app.js`. Left for a later, separate change.

## Verification

1. **Math:** `node tests/run.js`, all 980 checks pass. They compare against PyEphem, NASA eclipse tables and NOAA WMM2025, and cover:
   - six places from the equator to the Arctic Circle (including midnight sun and polar night), DST days and a leap day
   - sun, moon, planet and star positions; phases and seasons
   - meteor timing, eclipses and magnetic declination
   - that every release version number matches

   A planted bug in the sunrise threshold made 90 checks fail, so the tests do catch real mistakes.
2. **Offline and updates:** `node tests/offline-check.js` passes. In a headless browser it goes: open online → reopen offline → publish a new version → reopen online (the new version shows) → reopen offline (still works, old copy removed).
3. **No visible change from the cleanup:** 27 screenshots (phone and desktop) were taken of the speed-only beta and the cleaned-up beta at the same frozen date and time: every tab, a night dome with all layers on, all 7 info pages, Big text, About and Calibrate. All 27 are pixel-identical.
4. **Behaviour checks in the browser:**
   - Sensors: on with Live, off after Freeze; on in the Camera, off after leaving; on in Calibrate, off after closing.
   - Camera turns off when you leave the tab.
   - Map library loads on first open, and from the offline copy with no network.
   - Keyboard timeline works.
   - No page errors.

## Questions for a second reviewer

1. Is the stale-while-revalidate tile strategy in `sw.js` sound, including how the background trim is kept alive with `e.waitUntil`? Would least-recently-*used* eviction be worth the extra bookkeeping over oldest-*inserted*?
2. `dtf()` caches formatters by `JSON.stringify(options)`. The cache is unbounded, but in practice a few dozen distinct formats exist (more only if the user switches time zones many times). Is that acceptable, or should it be capped?
3. `motion.use()` detaches the listener and clears the smoothed orientation on pause, but keeps the iPhone north correction. Any concern with that on Android or iOS?
4. Is item C11 (folding `infopages.js` and `sheets.js` into `app.js`) worth doing, or is the current split clearer for a small app?
