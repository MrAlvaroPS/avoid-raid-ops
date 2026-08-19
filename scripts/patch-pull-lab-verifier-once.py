from pathlib import Path

path=Path('scripts/verify-legacy-runtime-ownership.mjs')
text=path.read_text()
old="expect(declared.length===62,`wcl-runtime.js must contain exactly 62 active function declarations after Progress, Players, Corpus, Mechanics and Defensive Audit presentation retirement; found ${declared.length}`);"
new="expect(declared.length===61,`wcl-runtime.js must contain exactly 61 active function declarations after Progress, Players, Corpus, Mechanics, Defensive Audit and Pull Lab presentation retirement; found ${declared.length}`);"
count=text.count(old)
if count!=1:
    raise SystemExit(f'legacy ownership cardinality anchor: expected exactly 1 match, found {count}')
path.write_text(text.replace(old,new,1))
print('Legacy runtime cardinality updated exactly: 62 -> 61 after Pull Lab physical retirement')
