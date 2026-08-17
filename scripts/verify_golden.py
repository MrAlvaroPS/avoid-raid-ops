from pathlib import Path
import hashlib, json, sys
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'golden-master-manifest.json').read_text())
fail=[]
for name,expected in manifest['sha256'].items():
    actual=hashlib.sha256((root/'golden-master'/name).read_bytes()).hexdigest()
    if actual!=expected: fail.append(f'{name}: hash mismatch')
# Source-web visual assets must preserve the Golden bytes during migration.
for name in ['main.css','favicon.svg','og.png']:
    a=(root/'golden-master'/name).read_bytes(); b=(root/'apps/web/public'/name).read_bytes()
    if a!=b: fail.append(f'apps/web/public/{name}: differs from golden')
# Root public is the active production-compatible asset tree. Netlify deploy-preview is retired.
for name in ['main.js','main.css','favicon.svg','og.png']:
    a=(root/'golden-master'/name).read_bytes(); b=(root/'public'/name).read_bytes()
    if a!=b: fail.append(f'public/{name}: differs from golden')
if fail:
    print('GOLDEN VERIFICATION: FAIL'); [print(' -',x) for x in fail]; sys.exit(1)
print('GOLDEN VERIFICATION: PASS')
print(' - 6 immutable golden files match manifest hashes')
print(' - source web CSS/assets match golden byte-for-byte')
print(' - active root public main.js/CSS/assets match golden byte-for-byte')
