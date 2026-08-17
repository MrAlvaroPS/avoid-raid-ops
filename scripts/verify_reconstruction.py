from pathlib import Path
import re,sys
root=Path(__file__).resolve().parents[1]
pairs={
 'K0':'features/command-center/CommandCenter.js','k0':'features/progress/Progress.js','J0':'features/pull-lab/PullLab.js','W0':'features/damage-healing/DamageHealing.js','F0':'features/mechanics/Mechanics.js','$0':'features/defensive-audit/DefensiveAudit.js','I0':'features/players/Players.js','P0':'features/live/Live.js','l1':'features/composition/Composition.js','Xf':'app/AppShell.js'
}
# Golden protects visual/content reconstruction, but obsolete mock facts must not be
# reintroduced after Data Truth replaces them with explicit pending/evidence states.
# Keep this allowlist exact and tiny: every retirement needs deliberate review.
intentional_data_truth_retirements={
 'I0':{'"91%"','"Peer median 84%"'},
}
fail=[]
# Compare literal payloads (strings) after decoding JS escapes conservatively by raw literal token.
def strings(s): return set(re.findall(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'',s))

def extract_function(bundle,symbol):
 marker=f'function {symbol}('
 start=bundle.find(marker)
 if start < 0:
  raise ValueError(f'function {symbol} not found in golden bundle')
 brace=bundle.find('{',start)
 if brace < 0:
  raise ValueError(f'function {symbol} has no body in golden bundle')
 depth=0; quote=None; escape=False
 for i in range(brace,len(bundle)):
  ch=bundle[i]
  if quote:
   if escape: escape=False
   elif ch=='\\': escape=True
   elif ch==quote: quote=None
   continue
  if ch in ('"',"'",'`'):
   quote=ch; continue
  if ch=='{': depth+=1
  elif ch=='}':
   depth-=1
   if depth==0: return bundle[start:i+1]
 raise ValueError(f'function {symbol} body is unterminated in golden bundle')

golden_bundle=None
for symbol,rel in pairs.items():
 extracted=root/'tools/extracted-golden'/f'{symbol}.compiled.js'
 if extracted.exists():
  golden=extracted.read_text()
 else:
  # Historical extraction produced both K0 and k0. Case-insensitive filesystems can
  # collapse that pair, so fall back to the immutable Golden bundle instead of
  # weakening the reconstruction check or aliasing two different screens.
  if golden_bundle is None: golden_bundle=(root/'golden-master/main.js').read_text()
  try: golden=extract_function(golden_bundle,symbol)
  except ValueError as exc:
   fail.append(str(exc)); continue
 src=(root/'apps/web/src'/rel).read_text()
 gs=strings(golden); ss=strings(src)
 retired=intentional_data_truth_retirements.get(symbol,set())
 # Every Golden literal must survive unless it is an explicitly reviewed obsolete mock fact.
 lost=sorted((gs-ss)-retired)
 if lost: fail.append(f'{symbol}: {len(lost)} golden string literals missing, e.g. {lost[:3]}')
if fail:
 print('RECONSTRUCTION VERIFICATION: FAIL'); [print(' -',x) for x in fail]; sys.exit(1)
print('RECONSTRUCTION VERIFICATION: PASS')
print(' - every non-retired string literal from all 9 screens + AppShell survives the split')
print(' - obsolete mock facts may be retired only through the explicit Data Truth allowlist')
print(' - missing case-collided extracts fall back to immutable golden-master/main.js')
