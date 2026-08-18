from pathlib import Path

script_path=Path('scripts/v4-retire-mechanics-source-once.py')
source=script_path.read_text()
start_marker='# 9. Restore canonical validator inside the functional commit so no temporary CI state survives.\n'
end_marker='# Final migration assertions before the shell commits anything.\n'
start=source.find(start_marker)
end=source.find(end_marker,start+len(start_marker))
if start<0 or end<0:
    raise SystemExit('Mechanics migration wrapper: canonical-validator mutation block not found exactly')
patched=source[:start]+source[end:]
if ".github/workflows/validate.yml" in patched:
    raise SystemExit('Mechanics migration wrapper: workflow mutation survived patching')
namespace={'__name__':'__main__','__file__':str(script_path)}
exec(compile(patched,str(script_path),'exec'),namespace,namespace)
