from pathlib import Path
import re,sys
root=Path(__file__).resolve().parents[1]
pairs={
 'K0':'features/command-center/CommandCenter.js','k0':'features/progress/Progress.js','J0':'features/pull-lab/PullLab.js','W0':'features/damage-healing/DamageHealing.js','F0':'features/mechanics/Mechanics.js','$0':'features/defensive-audit/DefensiveAudit.js','I0':'features/players/Players.js','P0':'features/live/Live.js','l1':'features/composition/Composition.js','Xf':'app/AppShell.js'
}
fail=[]
# Compare literal payloads (strings) after decoding JS escapes conservatively by raw literal token.
def strings(s): return set(re.findall(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'',s))
for symbol,rel in pairs.items():
 golden=(root/'tools/extracted-golden'/f'{symbol}.compiled.js').read_text()
 src=(root/'apps/web/src'/rel).read_text()
 gs=strings(golden); ss=strings(src)
 # Ignore import-path strings and React module strings; every golden literal must survive.
 lost=sorted(gs-ss)
 if lost: fail.append(f'{symbol}: {len(lost)} golden string literals missing, e.g. {lost[:3]}')
if fail:
 print('RECONSTRUCTION VERIFICATION: FAIL'); [print(' -',x) for x in fail]; sys.exit(1)
print('RECONSTRUCTION VERIFICATION: PASS')
print(' - every string literal from all 9 screens + AppShell survives the split')
