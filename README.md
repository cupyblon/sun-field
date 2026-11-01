# Sun Field

A phone-first sun app: light times (including civil "work light"), a 3D sky dome, a camera AR view of the sun's path, and a map with sunrise, sunset and shadow bearings.

Everything is calculated on the device with the NOAA solar equations (solstices and equinoxes with Meeus). Nothing is sent anywhere; location stays in your browser.

**Use it:** open the GitHub Pages link in Safari on iPhone, then Share > Add to Home Screen.

**Camera view:** tap Start, allow Motion and Camera. Phone compasses drift 5-10 degrees, so on a sunny day put the crosshair on the sun (do not stare at it) and tap Align to sun.

## v2
- Dome **Layers** button: horizon grid, celestial grid with the celestial poles (Polaris), full sphere with the sun's night path, season paths, bearings, hour labels. Choices are remembered.
- Camera view: steadier compass on iPhone (no more flipping when you look down) and a Polaris marker.

## v3
- Dome tab **Live** button: the dome turns with your phone (facing direction = ahead; flat = top view, upright = side view). **Freeze** holds the view. Works in Safari; Brave Shields block phone sensors.

## v5
- Swipeable bottom strip: Sun, Twilight, Shadow (editable height), Moon, Moon phases, Milky Way.
- Moon path and phase on the Dome (Layers > Moon path) and in Camera.

## v6
- Moon path hour labels, moonrise/moonset bearings.
- Planets, bright stars and the Big Dipper on the Dome (Layers) and in Camera.
- Sky today page, Times banner and 30-day 'Coming up in the sky' list: moon phases, supermoons, seasons, meteor peaks (IMO), eclipses computed for your location, Moon-planet conjunctions.

## v7 (Oct 31, 2026): backend review fixes
- Works offline: a service worker keeps the app and recently viewed map tiles on the phone. Bump `VERSION` in `sw.js` and the `?v=N` tags in `index.html` together on each release.
- Camera turns off when you leave the Camera tab or lock the phone; Camera tab caches its sky math and shares `motion.js` with the live Dome.
- Milky Way window shows tonight's window; lunar eclipse notes say when it's actually watchable.
- Faster date changes and sky list (same results, checked against the previous version).
- Leaflet bundled in `vendor/`; time zone setting for spots outside the phone's zone; one shared `DELTA_T`.

## v8 (Nov 1, 2026): desktop and Android
- "Aa Big text" switch on wide screens: bottom sun info text 2.5x, spacing 1.5x, remembered.
- "Coming up in the sky" moved below the sun lists on the Times tab.
- Sensor help names the right steps for Brave (desktop and Android), iPhone Safari, Chrome and Samsung Internet.
- On a computer with no touch screen, Live and Camera show "needs a phone" instead of waiting for a compass.
- Every release: bump `VERSION` in `sw.js` and all `?v=N` tags in `index.html`, or phones keep the old offline copy.

## v9 (Nov 1, 2026): calibration and About
- Calibrate (Dome, Camera, Settings): GPS fix, compass offset from NOAA's World Magnetic Model 2025, compass reset with a figure-8 meter, sky lock status.
- Align locks the Camera onto the Sun or Moon (planets and bright stars at night); the same correction now steers the live Dome.
- Declination fills in automatically for each spot unless typed by hand.
- About sheet (ⓘ): How to use, Tips, Accuracy, About.
- Clearer privacy line, work-light caveat, camera aim tip.

## v10 (Nov 1, 2026): Quick calibrate, tests, accessibility
- Quick calibrate: one tap for GPS, NOAA north correction and the compass check, with a checklist; Sky lock as the last step.
- "Updated to version N" notice once per release.
- Keyboard and screen-reader support: timeline slider, dome keys, focus kept in panels, live messages, reduced motion.
- Regression tests (`tests/`) and a release script (`tools/release.py`).

## v11 (Nov 1, 2026): code review, speed and cleanup
- Date/time formatters reused: a full screen update is about 2x faster; time-zone math about 15x faster.
- Motion sensors run only while Live, the Camera or Calibrate use them.
- Map tiles: saved copy first, refreshed in the background. Map library loads on first use of the Map tab.
- Timeline bar and the dome's celestial grid are drawn once and reused.
- Dead code and CSS removed, comments brought up to date. Details: `docs/code-review-2026-11-01.md`.

## v12 (Nov 1, 2026): second-review fixes
- Map tile saving kept alive on slow first visits; the tile store always gets a final trim after a burst.
- iPhone: a changed compass offset (new spot or typed value) applies at once, even after pausing Live or the Camera.
- Clearer privacy wording (GitHub hosting and OpenStreetMap map images see your IP address).
- New tests: offline Map, and the iPhone pause/offset check.

## How accurate is it?

Everything is calculated on the device. Each engine was checked against an independent source:

| What | Checked against | Result |
|---|---|---|
| Sunrise, sunset, twilight, golden and blue hour | PyEphem | Within seconds (times are shown to the minute, seconds dropped) |
| Equinoxes and solstices | Meeus, *Astronomical Algorithms* ch. 27 | About a minute |
| Moonrise and moonset | PyEphem | Within 28 seconds |
| Moon phases | PyEphem | Within 1 minute |
| Planet positions | PyEphem | 1–5 arcminutes (a full Moon is 30 arcminutes wide) |
| Bright stars | PyEphem | Within 0.03° |
| Meteor shower peaks | IMO meteor shower calendar | Within about 25 minutes |
| Lunar eclipses | NASA eclipse tables | Times match; umbral magnitude within 0.008 |
| Solar eclipses from Chicago | NASA | 2017: 87.6% covered · 2024: 93.8% · Jan 26, 2028: 1.3% |

**Limits to know about**
- **Real-world rise and set** can differ by a minute or two from any calculator: hills, trees and unusual air (very cold or hot) bend the light differently. The math assumes a flat, open horizon.
- **Work light** (civil dawn to civil dusk) is light on open ground. Woods, clouds and buildings make it darker sooner.
- **Compass** in phones is often 5–10° off and is thrown off by metal, cars, rebar and magnetic phone cases. *Align to sun* in the Camera tab corrects it.
- **Meteor rates** are best-case estimates for a dark sky; city light cuts them a lot.
- **Planet math** uses JPL elements valid 1800–2050; the clock correction (ΔT) is set for the late 2020s.
- **Time zone** follows your phone unless you pick another one in Settings.

## Testing

Two checks, run from the repo folder:

- `node tests/run.js` checks the math against independent answers (about 980 checks, plain Node, nothing to install):
  sunrise, sunset and twilight in six places from the equator to above the Arctic Circle (including midnight sun and polar night),
  moonrise and moonset, sun, moon, planet and star positions, moon phases, equinoxes and solstices, meteor-peak timing,
  NASA lunar and solar eclipses, NOAA magnetic declination, daylight-saving and leap days, and that every release version number matches.
  The reference answers come from PyEphem and pygeomag (`tests/make_reference.py` rebuilds them).
- `node tests/offline-check.js` runs the offline and update sequence in a headless browser: open online, reopen offline,
  publish a new version, reopen online (must show it), reopen offline (must still work), open the Map offline. Needs Playwright.
- `node tests/motion-check.js` simulates iPhone compass readings: learn north, pause, change the compass offset, resume tilted;
  the heading must use the new offset at once. Needs Playwright.
- Not covered by automated tests: saved map tiles under heavy use, and real phone sensors (check those on the phones).

To release: `python3 tools/release.py` bumps every version number and runs the math checks.
