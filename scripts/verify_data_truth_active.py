from pathlib import Path

source_path = Path(__file__).with_name("verify_data_truth_ui.py")
source = source_path.read_text()
legacy_root = "root=project/'deploy-preview'/'public'"
active_root = "root=project/'public'"

if source.count(legacy_root) != 1:
    raise SystemExit("DATA TRUTH ADAPTER: expected exactly one legacy deploy-preview root")

adapted = source.replace(legacy_root, active_root)
namespace = {"__name__": "__main__", "__file__": str(source_path)}
exec(compile(adapted, str(source_path), "exec"), namespace, namespace)
