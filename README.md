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
