# Bump every version number for a new release, then run the regression tests.
# Usage (from the repo folder):  python3 tools/release.py
# Changes: index.html ?v=N tags, sw.js VERSION and V, sheets.js APP_VERSION. Phones only pick up new files
# when these change, so always release with this script instead of editing numbers by hand.
import re, subprocess, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
html = (root/'index.html').read_text()
v = int(re.search(r'\?v=(\d+)', html).group(1)); n = v + 1
edits = {'index.html': [(f'?v={v}', f'?v={n}')],
         'sw.js': [(f"const VERSION = 'v{v}';", f"const VERSION = 'v{n}';"), (f"const V = '?v={v}';", f"const V = '?v={n}';")],
         'sheets.js': [(f"APP_VERSION = '{v}'", f"APP_VERSION = '{n}'")]}
for f, pairs in edits.items():
    p = root/f; s = p.read_text()
    for a, b in pairs:
        if a not in s: sys.exit(f'{f}: could not find {a!r}; versions are out of sync, fix by hand first')
        s = s.replace(a, b)
    p.write_text(s)
print(f'Version {v} -> {n}')
sys.exit(subprocess.call(['node', str(root/'tests'/'run.js')]))
