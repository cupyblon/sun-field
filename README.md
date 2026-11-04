# Sun Field

A phone-first sun app: light times (including civil "work light"), a 3D sky dome, a camera AR view of the sun's path, and a map with sunrise, sunset and shadow bearings.

All the math runs on the device: NOAA solar equations, Meeus for the moon and seasons, NOAA's World Magnetic Model for compass offset. Your exact location stays in your browser (a rounded position, about 1 km, is used to look up your town's name when you use GPS). Like any website, GitHub (which hosts the app) and OpenStreetMap (map images) see your IP address, and OpenStreetMap sees which map area you view.

**Use it:** https://cupyblon.github.io/sun-field/ in Safari (iPhone) or Chrome (Android), then Add to Home Screen. Works offline after the first visit.

**Camera view:** tap Start, allow Motion and Camera. Phone compasses drift 5-10 degrees, so tap Calibrate, then put the crosshair on the sun (do not stare at it), or the moon or a bright planet at night, and tap Align.

**Docs:** [How this project was built (retrospective and playbook)](docs/project-retrospective.md) · [Code review, Nov 1 2026](docs/code-review-2026-11-01.md) · [Final review, app version 24](docs/code-review-final-2026-11-01.md)

## Release history

**About version numbers:** from app version 24 on, release notes use the **app version** shown in ⓘ › About (it is also the
`?v=N` number the offline copy uses). The older notes below are labelled v2–v14; those were release counts, not app versions.
v14 below is app version 23.

## App version 31 (Nov 4, 2026): planet brightness, town name for your GPS spot
- **Planets page:** each planet's brightness (magnitude) with plain words ("very bright", "easy to see"…); the Tonight list shows it too,
  brightest first. A planet within 15° of the Sun says it's lost in the glare instead of suggesting binoculars.
  Formulas: Mallama & Hilton (2018, as used by the Astronomical Almanac); Saturn per Meeus, including the rings' tilt.
- **Town name:** tapping the GPS arrow (or "Use my location" on the welcome screen) now shows your town, e.g. "Brookfield, IL · GPS ±12 m".
  Only a rounded position (2 decimals, about 1 km) goes to OpenStreetMap's place-name service; the name is saved, so the same spot isn't
  looked up again. Offline or if the lookup fails, it shows "Your location" as before. Privacy wording updated to say so.
- **How to use** now describes the Dashboard (the default layout) first.
- **Tests:** new "Planet brightness vs PyEphem" group, 277 checks (worst 0.48 magnitude, a crescent Venus, where PyEphem's older formula is dimmer).
  The math suite is now 1,260 checks.

## App version 30 (Nov 2, 2026): Dashboard is the default
- The Dashboard layout now opens by default. ▦ switches to Classic, and the choice is remembered.

## App version 29 (Nov 2, 2026): Dashboard layout (idea and mockup by Jimmy Villalpando)
- A second layout, switched with the ▦ button in the header (remembered). Classic stays the default and is unchanged.
- Big icon tabs at the top: Today, Sun, Moon, Planets, Events, Camera, Dome, Map (a swipe row on a phone, 8 across on wider screens).
- Today: work light over a drawn sky picture that follows the real sun and moon for the chosen time (dawn, day, sunset glow, night with stars);
  Sky at a Glance; key times; sun path; daylight timeline with daylight / usable light / night totals; a date bar with day arrows.
- Sun, Moon, Planets and Events pages: sun now, rise and set with direction, day-length change, golden and blue hour, twilight, seasons;
  moon phase, position, distance, rise and set, next phases, visible lunar eclipses; each planet's rise, set and best time after dark;
  tonight's events, the Milky Way window, eclipses for 3 years and the next 60 days.
- Dashboard header: round buttons; ? opens How to use; the arrow gets a GPS fix (spins while searching, gold while it's your own spot).
- The guided tour runs in Classic and returns to the Dashboard afterwards. App versions 27–28 were beta-only.

## App version 26 (Nov 1, 2026): final-review fixes
- The title is the page's main heading and the sun-info panel is a named region (accessibility scan: no violations).
- Work light near the poles: "All day" with a midnight-sun note, or "None" / "twilight only" when the sun doesn't rise.
- Replaying the tour no longer turns the camera back on at the Camera step.
- Tour test extended for the camera case. Details: `docs/code-review-final-2026-11-01.md`.

## App version 24 (Nov 1, 2026): tour accessibility, tour test
- Guided tour: keyboard focus returns to the Times tab when it ends (to ⓘ after a replay); the app behind it is inert while it runs.
- New `tests/tour-check.js`: first-visit welcome and the full tour, online and offline.

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

## v13 (Nov 1, 2026): ready to share
- First visit: welcome with "Use my location" on top of How to use.
- About: Support Sun Field (Lightning, Bitcoin with QR codes, Cash App, Venmo) and Send feedback by email.
- Golden/blue hour modes renamed Extended / Classic.

## v14 (Nov 1, 2026) = app version 23: guided tour
- Guided tour (7 steps) after the first How to use: spotlights each real screen; Skip or Escape any time; replay with "Take the tour" in How to use.

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
- `node tests/tour-check.js` runs the first-visit welcome and all 7 tour steps, replay, Skip and Escape, online and with no network;
  checks the app behind the tour is inert and focus returns afterwards. Needs Playwright.
- Not covered by automated tests: saved map tiles under heavy use, and real phone sensors (check those on the phones).

To release: `python3 tools/release.py` bumps every version number and runs the math checks.
