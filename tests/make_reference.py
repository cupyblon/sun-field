"""Builds tests/reference.json: answers from independent sources that Sun Field's engines are checked against.

Sources
  - PyEphem 4.x (XEphem engine, VSOP87 / ELP2000):  sun, twilight, moon, planets, stars, phases, seasons, sun longitude
  - pygeomag (NOAA World Magnetic Model 2025):       compass declination
  - NASA eclipse tables (hard-coded in run.js):        lunar and solar eclipses

Run:  pip install ephem pygeomag   then   python3 tests/make_reference.py
Only needs re-running if you add cases; the JSON is committed so tests run with plain Node.
"""
import json, math, datetime as dt
from zoneinfo import ZoneInfo
import ephem
from pygeomag import GeoMag

PLACES = {  # name: (lat, lon, IANA time zone)
  'Brookfield IL': (41.8228, -87.8517, 'America/Chicago'),
  'Fairbanks AK':  (64.8378, -147.7164, 'America/Anchorage'),
  'Tromso NO':     (69.6496, 18.9560, 'Europe/Oslo'),        # midnight sun / polar night
  'Quito EC':      (-0.1807, -78.4678, 'America/Guayaquil'), # equator
  'Sydney AU':     (-33.8688, 151.2093, 'Australia/Sydney'), # southern hemisphere, opposite DST
  'Cape Town ZA':  (-33.9249, 18.4241, 'Africa/Johannesburg'),
}
DATES = ['2026-03-20','2026-06-21','2026-11-01','2026-12-21','2027-03-14','2027-11-07','2028-02-29','2028-06-20']
#        equinox      solstice     today-ish    solstice     US DST start US DST end   leap day     solstice (leap yr)
ms = lambda d: round(ephem.Date(d).datetime().replace(tzinfo=dt.timezone.utc).timestamp()*1000)
def observer(lat, lon, horizon, pressure):
    o = ephem.Observer(); o.lat, o.lon = str(lat), str(lon); o.elevation = 0; o.pressure = pressure; o.horizon = horizon; return o

def day_events(lat, lon, tz, date, horizon, body, use_center, pressure):
    y, m, d = map(int, date.split('-'))
    t0 = dt.datetime(y, m, d, tzinfo=ZoneInfo(tz)).astimezone(dt.timezone.utc)
    t1 = (dt.datetime(y, m, d, tzinfo=ZoneInfo(tz)) + dt.timedelta(days=1)).astimezone(dt.timezone.utc)
    o = observer(lat, lon, horizon, pressure); o.date = ephem.Date(t0.replace(tzinfo=None))
    out = {}
    for kind, fn in (('rise', o.next_rising), ('set', o.next_setting)):
        o.date = ephem.Date(t0.replace(tzinfo=None))
        try:
            t = fn(body, use_center=use_center)
            out[kind] = ms(t) if t.datetime() < t1.replace(tzinfo=None) else None
        except (ephem.AlwaysUpError, ephem.NeverUpError):
            out[kind] = None
    return out

ref = {'sun_events': [], 'moon_events': [], 'sun_pos': [], 'moon_pos': [], 'planets': [], 'stars': [],
       'phases': [], 'seasons': [], 'sun_lon_j2000': [], 'declination': []}

# sunrise/sunset (upper limb with standard refraction = centre at -0.8333 deg, no extra refraction), civil/nautical/astronomical
for name, (lat, lon, tz) in PLACES.items():
    for date in DATES:
        row = {'place': name, 'lat': lat, 'lon': lon, 'tz': tz, 'date': date}
        for key, hz in (('sun','-0:50'), ('civ','-6'), ('naut','-12'), ('astro','-18')):
            row[key] = day_events(lat, lon, tz, date, hz, ephem.Sun(), True, 0)
        ref['sun_events'].append(row)
        # moonrise/moonset: upper limb, standard refraction (PyEphem default atmosphere)
        ref['moon_events'].append({'place': name, 'lat': lat, 'lon': lon, 'tz': tz, 'date': date,
                                   **day_events(lat, lon, tz, date, '0', ephem.Moon(), False, 1010)})

# positions at fixed instants (geometric altitude: pressure 0)
INSTANTS = ['2026/11/01 18:00', '2027/06/21 03:30', '2027/12/15 12:00', '2028/02/29 22:15']
for name in ('Brookfield IL', 'Sydney AU', 'Tromso NO'):
    lat, lon, _ = PLACES[name]
    for when in INSTANTS:
        o = observer(lat, lon, '0', 0); o.date = when
        s = ephem.Sun(o);  ref['sun_pos'].append({'place': name, 'lat': lat, 'lon': lon, 't': ms(o.date), 'az': math.degrees(s.az), 'alt': math.degrees(s.alt)})
        mo = ephem.Moon(o); mg = ephem.Moon(o.date)   # mg: from Earth's centre (Sun Field's distance is centre to centre)
        ref['moon_pos'].append({'place': name, 'lat': lat, 'lon': lon, 't': ms(o.date), 'az': math.degrees(mo.az), 'alt': math.degrees(mo.alt),
                                'dist_km': mg.earth_distance*149597870.7, 'lit': mg.moon_phase})
        for pn in ('Mercury','Venus','Mars','Jupiter','Saturn'):
            p = getattr(ephem, pn)(o); g = getattr(ephem, pn)(); g.compute(o.date)
            ref['planets'].append({'name': pn, 'place': name, 'lat': lat, 'lon': lon, 't': ms(o.date),
                                   'ra': math.degrees(g.g_ra), 'dec': math.degrees(g.g_dec), 'az': math.degrees(p.az), 'alt': math.degrees(p.alt)})
        for sn, ra, dec in (('Sirius',101.287,-16.716), ('Vega',279.234,38.784), ('Polaris',37.955,89.264), ('Antares',247.352,-26.432)):
            st = ephem.FixedBody(); st._ra, st._dec, st._epoch = math.radians(ra), math.radians(dec), ephem.J2000; st.compute(o)
            ref['stars'].append({'name': sn, 'ra2000': ra, 'dec2000': dec, 'place': name, 'lat': lat, 'lon': lon, 't': ms(o.date),
                                 'az': math.degrees(st.az), 'alt': math.degrees(st.alt)})

# moon phases and seasons, Nov 2026 - Dec 2028
t = ephem.Date('2026/11/01')
for fn, n in ((ephem.next_new_moon,'new'), (ephem.next_first_quarter_moon,'first'), (ephem.next_full_moon,'full'), (ephem.next_last_quarter_moon,'last')):
    d = t
    for _ in range(8): d = fn(d); ref['phases'].append({'kind': n, 't': ms(d)}); d = ephem.Date(d + 1)
for y in (2026, 2027, 2028, 2030):
    for fn, deg in ((ephem.next_vernal_equinox,0), (ephem.next_summer_solstice,90), (ephem.next_autumnal_equinox,180), (ephem.next_winter_solstice,270)):
        ref['seasons'].append({'year': y, 'deg': deg, 't': ms(fn(f'{y}/1/1'))})

# Sun's J2000 ecliptic longitude at instants (meteor shower peaks are defined by it)
for when in ('2026/08/12 20:00', '2026/12/14 08:00', '2027/01/04 03:00', '2027/10/21 12:00'):
    s = ephem.Sun(); s.compute(when, epoch=ephem.J2000)
    ref['sun_lon_j2000'].append({'t': ms(ephem.Date(when)), 'lon': math.degrees(ephem.Ecliptic(s, epoch=ephem.J2000).lon)})

# magnetic declination (NOAA WMM2025)
gm = GeoMag(coefficients_file='wmm/WMM_2025.COF')
for name, (lat, lon) in {'Brookfield IL': (41.8228,-87.8517), 'Seattle WA': (47.6062,-122.3321), 'Boston MA': (42.3601,-71.0589),
                         'Baumholder DE': (49.6167,7.3333), 'Sydney AU': (-33.8688,151.2093), 'Fairbanks AK': (64.8378,-147.7164)}.items():
    ref['declination'].append({'place': name, 'lat': lat, 'lon': lon, 'year': 2026.84, 'decl': gm.calculate(glat=lat, glon=lon, alt=0, time=2026.84).d})

json.dump(ref, open(__file__.replace('make_reference.py', 'reference.json'), 'w'), indent=0)
print({k: len(v) for k, v in ref.items()})
