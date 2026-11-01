# Sun Field: project retrospective

How Sun Field went from a question to a shared app, mid-October to November 1, 2026. The process is the standard software lifecycle (need, prototype, build, test, release, review), run in short loops. Each phase below says what happened and what it teaches.

**Roles**
- **Fernando Villalpando:** product owner and tester. Set direction, approved every change, tested on real phones.
- **Claude (AI coding assistant):** engineer. Planning, code, tests, reviews, documentation.
- **ChatGPT:** independent code reviewer.

The person with the need made the decisions, and every change was checked by someone or something other than its builder.

## The phases

### 1. Need
It started as curiosity (sun math, Eratosthenes, a stick-shadow project) and turned into a real question: *how much usable light is there to work outside today?*

**Lesson:** start from a problem you actually have. It keeps every decision grounded.

### 2. Prototype
A single HTML page ("Sun Almanac"): NOAA solar equations, dawn and dusk, shadow length.

**Lesson:** start with the smallest thing that answers the question. One file, no hosting, fast to change.

### 3. Check against a trusted source
Results were compared with a commercial sun-planning app and with PyEphem. The golden and blue hour definitions turned out to differ between sources, so both were kept as options (now *Extended* and *Classic*).

**Lesson:** decide early what "correct" means and measure against something you trust. "Looks right" isn't a test.

### 4. Make it real (October 31)
The prototype became Sun Field: a phone web app on GitHub Pages with Times, Dome, Camera and Map tabs.

**Lesson:** move from prototype to product once the prototype has proven its value, not before.

### 5. Feature loops
Dome layers, then a compass fix, then the live Dome, then Hide sun info, then swipeable info pages, then the moon and planets, then sky events.

Every loop ran the same way: **request, plan, approve, build on a separate beta page, test, merge.** Real-device testing found what simulators missed: a browser blocking motion sensors, the compass flipping when the phone tilts down, phones serving stale cached files.

**Lesson:** a separate test version plus an approval gate means the main app never breaks. Real devices find real bugs.

### 6. First deliberate code review (v7)
Four real bugs:
- the camera stayed on after leaving its tab;
- the Camera tab recalculated everything 60 times a second;
- the Milky Way window was wrong on summer nights;
- an eclipse note was wrong.

The same round added offline support.

**Lesson:** build fast, then go back and review on purpose. Some bugs only show up when you look for them.

### 7. New platforms and audiences
Android, desktop, a Big text mode, compass calibration, and About and help pages.

**Lesson:** every new device or audience surfaces hidden assumptions; an iPhone-only error message was one.

### 8. Outside review (three rounds)
The first ChatGPT review pushed toward automated tests and simpler calibration. The second found a map-tile caching gap, plus an iPhone compass issue: after a pause and a location change, the heading was **18.9° off** until the phone was held upright.

A third review, of the guided tour, found two accessibility gaps (focus not returned, the app behind the tour not blocked) and asked for a tour test. The new test failed on the old version and passed on the fix.

**Lesson:** a second reviewer sees what the builder doesn't. Each review caught things the others missed.

### 9. Make quality repeatable
- **Tests:** 980+ automated checks against PyEphem, NASA eclipse tables and NOAA's World Magnetic Model; an offline/update check; an iPhone compass check; a welcome-and-tour check; a release script.
- **Proof the tests work:** a deliberately planted bug made 90 checks fail.
- **A mistake fixed for good:** forgetting to bump the version once left a phone on a stale copy. The release script and a version-consistency test now prevent it.

**Lesson:** turn one-off checks into tests, and turn mistakes into automation.

### 10. Optimize with measurements
The speed pass was measured before and after: a screen update went from 7.1 to 3.2 ms, and dragging the timeline got 19× faster. One proposed optimization was dropped after measuring it at 21 µs. The cleanup was proven harmless with 27 pixel-identical before/after screenshots. Details: [code-review-2026-11-01.md](code-review-2026-11-01.md).

**Lesson:** measure before optimizing, and prove that a cleanup changes nothing.

### 11. Ready for strangers
- a welcome with location, a guided tour and accessibility;
- honest privacy wording;
- a feedback channel and tip options;
- no other products' names in the app.

**Lesson:** a tool for yourself and a tool for strangers are different products. The last 10% is about other people.

### 12. Ship and listen (November 1)
Shared on Facebook, Nostr, Twitter and LinkedIn. From here, user feedback decides what comes next, not new ideas.

## Playbook for the next project

1. Write the need in one sentence.
2. Build the smallest prototype that answers it.
3. Decide what "correct" means and check against it.
4. Ship somewhere real once it's proven useful.
5. Loop: request, plan, approve, beta, test on real devices, merge.
6. Every few loops, do a deliberate review, plus an outside review.
7. Turn checks and mistakes into automated tests and scripts.
8. Measure before optimizing; prove that cleanups change nothing.
9. Before sharing: onboarding, honest privacy, a feedback channel, no borrowed names.
10. Ship, then let real users decide what comes next.
