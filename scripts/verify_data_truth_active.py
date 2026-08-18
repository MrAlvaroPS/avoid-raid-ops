from pathlib import Path

source_path = Path(__file__).with_name("verify_data_truth_ui.py")
source = source_path.read_text()
legacy_root = "root=project/'deploy-preview'/'public'"
active_root = "root=project/'public'"

if source.count(legacy_root) != 1:
    raise SystemExit("DATA TRUTH ADAPTER: expected exactly one legacy deploy-preview root")

adapted = source.replace(legacy_root, active_root)

runtime_anchor = '''runtime=(root/'wcl-runtime.js').read_text().replace('location.origin','"https://test.local"')'''
runtime_replacement = runtime_anchor + "\nbridge=(root/'mechanics-defensives-fallback-bridge-v4.js').read_text()\nmechanics_runtime=(root/'mechanics-runtime.js').read_text()"
if adapted.count(runtime_anchor) != 1:
    raise SystemExit("DATA TRUTH ADAPTER: expected exactly one active WCL runtime anchor")
adapted = adapted.replace(runtime_anchor, runtime_replacement, 1)

html_anchor = "<script type=\"module\">{runtime}</script></body></html>'''"
html_replacement = "<script type=\"module\">{runtime}</script><script type=\"module\">{bridge}</script><script type=\"module\">{mechanics_runtime}</script></body></html>'''"
if adapted.count(html_anchor) != 1:
    raise SystemExit("DATA TRUTH ADAPTER: expected exactly one active runtime HTML anchor")
adapted = adapted.replace(html_anchor, html_replacement, 1)

namespace = {"__name__": "__main__", "__file__": str(source_path)}
exec(compile(adapted, str(source_path), "exec"), namespace, namespace)
