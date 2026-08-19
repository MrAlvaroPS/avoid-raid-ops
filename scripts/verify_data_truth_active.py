from pathlib import Path

source_path = Path(__file__).with_name("verify_data_truth_ui.py")
source = source_path.read_text()
legacy_root = "root=project/'deploy-preview'/'public'"
active_root = "root=project/'public'"

if source.count(legacy_root) != 1:
    raise SystemExit("DATA TRUTH ADAPTER: expected exactly one legacy deploy-preview root")

adapted = source.replace(legacy_root, active_root)

runtime_anchor = '''runtime=(root/'wcl-runtime.js').read_text().replace('location.origin','"https://test.local"')'''
runtime_replacement = runtime_anchor + "\ndefensive_runtime=(root/'defensive-audit-runtime.js').read_text()\nmechanics_runtime=(root/'mechanics-runtime.js').read_text()\ncommand_center_runtime=(root/'command-center-runtime.js').read_text()"
if adapted.count(runtime_anchor) != 1:
    raise SystemExit("DATA TRUTH ADAPTER: expected exactly one active WCL runtime anchor")
adapted = adapted.replace(runtime_anchor, runtime_replacement, 1)

html_anchor = "<script type=\"module\">{runtime}</script></body></html>'''"
html_replacement = "<script type=\"module\">{runtime}</script><script type=\"module\">{defensive_runtime}</script><script type=\"module\">{mechanics_runtime}</script><script type=\"module\">{command_center_runtime}</script></body></html>'''"
if adapted.count(html_anchor) != 1:
    raise SystemExit("DATA TRUTH ADAPTER: expected exactly one active runtime HTML anchor")
adapted = adapted.replace(html_anchor, html_replacement, 1)

owner_anchor = "    print('Mechanics intelligence: PASS')\n    browser.close()"
owner_replacement = """    print('Mechanics intelligence: PASS')
    command_center_owner=page.evaluate('window.__AVOID_COMMAND_CENTER_SOURCE_RUNTIME__ || null')
    command_center_owner_ok=(
        bool(command_center_owner)
        and command_center_owner.get('mode')=='single-source-owner'
        and command_center_owner.get('sourceOwner')=='apps/web/src/features/command-center/runtime.js'
        and command_center_owner.get('transport')=='public/command-center-runtime.js'
        and command_center_owner.get('directRequests')==0
        and command_center_owner.get('timers')==0
        and command_center_owner.get('observers')==0
    )
    print('Command Center source owner:', 'PASS' if command_center_owner_ok else 'FAIL')
    if not command_center_owner_ok:
        print('Command Center owner state:', command_center_owner);sys.exit(6)
    page.get_by_text('Defensive Audit',exact=True).first.click();page.wait_for_timeout(250)
    defensive_owner=page.evaluate('window.__AVOID_DEFENSIVE_AUDIT_SOURCE_RUNTIME_STATE__ || null')
    defensive_owner_ok=(
        bool(defensive_owner)
        and defensive_owner.get('mode')=='single-source-owner'
        and defensive_owner.get('directRequests')==0
        and defensive_owner.get('timers')==0
        and defensive_owner.get('observers')==0
    )
    print('Defensive Audit source owner:', 'PASS' if defensive_owner_ok else 'FAIL')
    if not defensive_owner_ok:
        print('Defensive Audit owner state:', defensive_owner);sys.exit(7)
    browser.close()"""
if adapted.count(owner_anchor) != 1:
    raise SystemExit("DATA TRUTH ADAPTER: expected exactly one Mechanics owner insertion anchor")
adapted = adapted.replace(owner_anchor, owner_replacement, 1)

namespace = {"__name__": "__main__", "__file__": str(source_path)}
exec(compile(adapted, str(source_path), "exec"), namespace, namespace)
