from pathlib import Path
import hashlib, json, sys
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'golden-master-manifest.json').read_text())
fail=[]
for name,expected in manifest['sha256'].items():
    actual=hashlib.sha256((root/'golden-master'/name).read_bytes()).hexdigest()
    if actual!=expected: fail.append(f'{name}: hash mismatch')
# CSS and visual public assets must be exact golden bytes.
for name in ['main.css','favicon.svg','og.png']:
    a=(root/'golden-master'/name).read_bytes(); b=(root/'apps/web/public'/name).read_bytes()
    if a!=b: fail.append(f'apps/web/public/{name}: differs from golden')
# deploy preview critical visual assets exact too.
for name in ['main.js','main.css','favicon.svg','og.png']:
    a=(root/'golden-master'/name).read_bytes(); b=(root/'deploy-preview/public'/name).read_bytes()
    if a!=b: fail.append(f'deploy-preview/public/{name}: differs from golden')
if fail:
    print('GOLDEN VERIFICATION: FAIL'); [print(' -',x) for x in fail]; sys.exit(1)
print('GOLDEN VERIFICATION: PASS')
print(' - 6 immutable golden files match manifest hashes')
print(' - source web CSS/assets match golden byte-for-byte')
print(' - deploy-preview main.js/CSS/assets match golden byte-for-byte')
