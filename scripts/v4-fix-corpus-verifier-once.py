from pathlib import Path

path=Path('scripts/verify-legacy-runtime-ownership.mjs')
text=path.read_text()
old="  expect(!new RegExp(`(?:async\\s+)?function\\s+${fn}\\s*\\(`).test(legacy),`${fn} declaration survived physical retirement`);"
new="  expect(!new RegExp(`(?:async\\\\s+)?function\\\\s+${fn}\\\\s*\\\\(`).test(legacy),`${fn} declaration survived physical retirement`);"
if text.count(old)!=1:
    raise SystemExit(f'Expected exactly one Corpus dynamic-regex line, found {text.count(old)}')
path.write_text(text.replace(old,new,1))
print('V4 CORPUS VERIFIER ESCAPE: FIXED')
