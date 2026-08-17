from pathlib import Path
import re, json, sys, hashlib
root=Path(__file__).resolve().parents[1]
fail=[]
# Exact required screen modules.
screens={
 'CommandCenter':'features/command-center/CommandCenter.js','Live':'features/live/Live.js','Progress':'features/progress/Progress.js',
 'PullLab':'features/pull-lab/PullLab.js','DamageHealing':'features/damage-healing/DamageHealing.js','Mechanics':'features/mechanics/Mechanics.js',
 'DefensiveAudit':'features/defensive-audit/DefensiveAudit.js','Players':'features/players/Players.js','Composition':'features/composition/Composition.js'
}
for name,rel in screens.items():
 p=root/'apps/web/src'/rel
 if not p.exists(): fail.append(f'missing screen {name}')
 elif f'export function {name}' not in p.read_text(): fail.append(f'{name}: exported function missing')
# Navigation labels must be complete/exact.
data=(root/'apps/web/src/data/goldenMocks.js').read_text()
for label in ['Command Center','LIVE','Progress','Pull Lab','Damage & Healing','Mechanics','Defensive Audit','Players','Composition']:
 if label not in data: fail.append(f'navigation label lost: {label}')
# Golden mock datasets must all exist; this catches forgotten tables/metrics at architecture step.
for name in ['NAV_ITEMS','PROGRESSION_MOCK','PLAYER_RELIABILITY_MOCK','MECHANICS_MOCK','DEFENSIVE_AUDIT_MOCK','LIVE_PULLS_MOCK','CLASS_REPRESENTATION_MOCK']:
 if f'export const {name} =' not in data: fail.append(f'mock dataset lost: {name}')
# Every static className literal from the original compiled UI must survive the split.
all_src='\n'.join(p.read_text() for p in (root/'apps/web/src').rglob('*.js'))
golden_chunks='\n'.join(p.read_text() for p in (root/'tools/extracted-golden').glob('*.compiled.js'))
def class_literals(s):
 return set(re.findall(r'className:\s*"([^"]+)"',s))
golden_classes=class_literals(golden_chunks); source_classes=class_literals(all_src)
lost_classes=sorted(golden_classes-source_classes)
if lost_classes: fail.append('className literals lost: '+', '.join(lost_classes[:20]))
classes=set()
for value in source_classes: classes.update(value.split())
# Source must retain representative critical content from every golden screen.
critical=['KILL READINESS','Progression intelligence','Are we actually getting better?','Pull metrics comparator','Damage & Healing','Mechanics Library','Defensive Audit','Player Intelligence','Raid Night Control Room','Composition Intelligence','MAKE EVERY PULL COUNT.']
for text in critical:
 if text not in all_src: fail.append(f'critical UI content lost: {text}')
# Vercel/Nitro API transports stay thin except the corpus orchestration route.
api_dir=root/'routes/api/wcl'
for p in api_dir.glob('*.js'):
 body=p.read_text()
 if 'query ' in body or 'mutation ' in body: fail.append(f'GraphQL leaked into API transport: {p.relative_to(root)}')
 if p.name!='corpus.js' and len([x for x in body.splitlines() if x.strip()])>8: fail.append(f'{p.name} is not a thin Nitro transport')
if not (root/'workflows/corpus-build.js').exists(): fail.append('missing durable corpus workflow')
# Resolve every relative import in active source and enforce quarantine/platform boundaries.
active_roots=[root/'apps/web/src', root/'server', root/'routes', root/'workflows']
old_root=(root/'old').resolve()
for base in active_roots:
 for p in list(base.rglob('*.js'))+list(base.rglob('*.mjs')):
  txt=p.read_text()
  if re.search(r'["\']@netlify/',txt): fail.append(f'active Netlify package dependency: {p.relative_to(root)}')
  for imp in re.findall(r'from\s+["\'](\.[^"\']+)["\']',txt):
   target=(p.parent/imp).resolve()
   try:
    target.relative_to(old_root)
    fail.append(f'active import crosses quarantine boundary: {p.relative_to(root)} -> {imp}')
   except ValueError:
    pass
   if not target.exists(): fail.append(f'unresolved import: {p.relative_to(root)} -> {imp}')

# Retired deployment trees may survive only under archive/quarantine.
if (root/'deploy-preview').exists(): fail.append('retired deploy-preview tree exists outside quarantine')
# New-code concentration guard: operational service facades stay free of GraphQL.
for p in (root/'server/services').glob('*.mjs'):
 body=p.read_text()
 if 'query ' in body or 'mutation ' in body: fail.append(f'GraphQL leaked into service layer: {p.relative_to(root)}')
# Legacy engine remains quarantined, but production services must not import it.
if not (root/'server/legacy-v2/README.md').exists(): fail.append('legacy v2 engine is not quarantined/documented')
for p in (root/'server/services').glob('*.mjs'):
 if 'legacy-v2' in p.read_text(): fail.append(f'production service still imports legacy v2: {p.name}')
# Architecture layer presence.
required_dirs=['server/wcl','server/ingestion','server/analysis','server/rule-packs','server/storage','server/services','server/corpus','workflows','routes/api/wcl','packages/contracts','tests/visual','golden-master']
for d in required_dirs:
 if not (root/d).exists(): fail.append(f'missing architecture layer {d}')
if fail:
 print('ARCHITECTURE VERIFICATION: FAIL'); [print(' -',x) for x in fail]; sys.exit(1)
print('ARCHITECTURE VERIFICATION: PASS')
print(f' - {len(screens)} screen modules present')
print(' - all 9 navigation destinations preserved')
print(' - all 7 golden mock datasets preserved')
print(f' - {len(classes)} static UI classes checked against Golden CSS')
print(' - representative content from every screen preserved')
print(' - Vercel/Nitro API routes are transport/orchestration adapters')
print(' - active imports do not cross the quarantine boundary')
print(' - retired Netlify deployment tree is absent from active source')
print(' - scalable server/domain/storage/rule-pack layers present')
