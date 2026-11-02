# Sun Field final code review: November 1, 2026 (app version 24)

A last full pass over the whole repo at commit `b73746a` (app version 24), after three earlier review rounds ([code-review-2026-11-01.md](code-review-2026-11-01.md)). The goal was to find issues, not to make changes. Nothing in the app was changed by this review; the findings below are for approval.

## What was checked

| Area | How | Result |
|---|---|---|
| Astronomy math | `node tests/run.js`: 981 checks against PyEphem, NASA eclipse tables, NOAA WMM2025, time-zone rules, release version numbers | **All pass.** Worst cases: sunrise 6.3 s, planets 0.094°, stars 0.026°, moon phases 58 s |
| Offline and updates | `tests/offline-check.js`: install, offline reopen, new version, offline again, Map offline | **All pass** |
| iPhone compass | `tests/motion-check.js`: learn north, pause, change offset, resume tilted | **Pass** (214.9°, expected 214.9°) |
| Welcome and tour | `tests/tour-check.js`: first visit, 7 steps, inert background, focus return, replay, Escape, Skip, then all of it offline | **All pass** |
| Accessibility | axe-core 4.10 scan of every tab, all four About tabs, Calibrate (Details open) and the tour | **0 serious or critical.** 2 moderate (finding 1) |
| Memory and stability | 30 simulated minutes of use: timeline scrubbing across whole days, date changes, page swipes, live Dome, Camera, Map | **Flat:** JS heap 3.6 MB → 4.3 MB, no growth after round 20. Formatter cache: 9 entries. No errors |
| Extreme places and dates | Every screen at 5 times of day for 14 cases: midnight sun and polar night (Tromsø), McMurdo, both poles, the equator, UTC+14, the date line, longitude ±180, US and Australian DST changeovers, leap day | **No errors, no NaN/undefined text.** One wording gap (finding 2) |
| Dead code | Every top-level function and constant counted across the repo | **None unused** |
| Page structure | Duplicate IDs; IDs used in code but missing from the page | **None** |
| Where HTML is inserted | All 20 `innerHTML` writes reviewed | **Safe:** only app-generated text and numbers; no text from outside the app (place names go in as plain text) |
| Links | Links that open a new tab | **All** use `rel="noopener"` |
| Saved settings | localStorage keys | 19 keys, all small, all prefixed `sf-` |
| Speed | Browser timing | Full screen update 2.9 ms, timeline drag step 0.04 ms, dome frame 1.0 ms |
| Download size | Files fetched on first open | 17 files, 188 KB (about 67 KB compressed). Map library (159 KB) loads only when Map is opened |
| Code reread | `tour.js`, `sheets.js`, `sw.js`, `motion.js`, `ar.js` (everything changed since the earlier review) | No logic errors. One behavior note (finding 3) |

## Findings

**No bugs that break anything were found.** Four small items:

| # | Severity | Finding | Suggested fix |
|---|---|---|---|
| 1 | Low (accessibility, axe "moderate") | The page has no top-level heading (the "Sun Field" title is styled text), and the bottom sun-info panel isn't a named page region. Screen-reader users navigate by headings and regions. | Make the title an `<h1>` (same look); give the sun-info panel `role="region"` with a label. |
| 2 | Low (wording) | With midnight sun or polar day (e.g. Tromsø in June, the poles), the work-light card shows "— to —" with no explanation. | Say "All day: the sun doesn't set today" or "No sunrise today" when that is the case. |
| 3 | Low (behavior) | Replaying the tour switches to the Camera tab; if the camera was already used in that session, it turns back on during the tour. The first tour never does this. | Have the tour show the Camera screen without restarting the camera. |
| 4 | Info (hardening) | No Content-Security-Policy. Low risk for a static site with no user accounts or user-supplied HTML. | Optional: a CSP meta tag allowing only the app's own files plus OpenStreetMap tiles. |

## Not covered by automated tests (check by hand)

- **Real phone sensors:** Calibrate, Align and Live on an actual iPhone and Android phone.
- **The Camera overlay drawing:** only covered by a simulated camera in the browser runs.
- **Saved map tiles under real traffic:** the tile server can't be reached from the test machine.
- **Real Facebook/LinkedIn in-app browsers.**

## Verdict

App version 24 is in good shape:
- all four test suites pass;
- memory is flat over long use;
- extreme places and dates render cleanly;
- no dead code or unsafe HTML insertion;
- no serious accessibility issues.

The four findings are small polish items. None needs to hold up use or sharing.
