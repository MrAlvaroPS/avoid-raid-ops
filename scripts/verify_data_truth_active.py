from pathlib import Path

source_path = Path(__file__).with_name("verify_data_truth_ui.py")
source = source_path.read_text()
legacy_root = "root=project/'deploy-preview'/'public'"
active_root = "root=project/'public'"

if source.count(legacy_root) != 1:
    raise SystemExit("DATA TRUTH ADAPTER: expected exactly one legacy deploy-preview root")

adapted = source.replace(legacy_root, active_root)

runtime_anchor = '''runtime=(root/'wcl-runtime.js').read_text().replace('location.origin','"https://test.local"')'''
runtime_replacement = runtime_anchor + "\nbridge=(root/'mechanics-defensives-fallback-bridge-v4.js').read_text()\ndefensive_runtime=(root/'defensive-audit-runtime.js').read_text()\nmechanics_runtime=(root/'mechanics-runtime.js').read_text()"
if adapted.count(runtime_anchor) != 1:
    raise SystemExit("DATA TRUTH ADAPTER: expected exactly one active WCL runtime anchor")
adapted = adapted.replace(runtime_anchor, runtime_replacement, 1)

html_anchor = "<script type=\"module\">{runtime}</script></body></html>'''"
html_replacement = "<script type=\"module\">{runtime}</script><script type=\"module\">{bridge}</script><script type=\"module\">{defensive_runtime}</script><script type=\"module\">{mechanics_runtime}</script></body></html>'''"
if adapted.count(html_anchor) != 1:
    raise SystemExit("DATA TRUTH ADAPTER: expected exactly one active runtime HTML anchor")
adapted = adapted.replace(html_anchor, html_replacement, 1)

parity_anchor = "    print('Mechanics intelligence: PASS')\n    browser.close()"
parity_replacement = """    print('Mechanics intelligence: PASS')
    page.get_by_text('Defensive Audit',exact=True).first.click();page.wait_for_timeout(250)
    defensive_parity=page.evaluate('window.__AVOID_DEFENSIVE_AUDIT_SOURCE_RUNTIME_STATE__ || null')
    defensive_parity_ok=bool(defensive_parity) and defensive_parity.get('mode')=='parity-shadow' and defensive_parity.get('checks',0)>0 and defensive_parity.get('mismatches')==0
    print('Defensive Audit source parity:', 'PASS' if defensive_parity_ok else 'FAIL')
    if not defensive_parity_ok:
        print('Defensive Audit parity state:', defensive_parity);sys.exit(6)
    browser.close()"""
if adapted.count(parity_anchor) != 1:
    raise SystemExit("DATA TRUTH ADAPTER: expected exactly one Mechanics parity insertion anchor")
adapted = adapted.replace(parity_anchor, parity_replacement, 1)

namespace = {"__name__": "__main__", "__file__": str(source_path)}
exec(compile(adapted, str(source_path), "exec"), namespace, namespace)
