import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir,readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOTS=['server','routes','workflows'];
const FORBIDDEN=[
  {label:"validation boss name",pattern:/Belo'ren|Child of Al'ar/i},
  {label:'validation WCL encounter id',pattern:/\b3182\b/},
  {label:'validation Blizzard journal id',pattern:/\b2739\b/},
  {label:'validation signal id',pattern:/\b1243866\b/},
  {label:'validation official state id',pattern:/\b1241163\b/},
  {label:'validation internal helper id',pattern:/\b1243560\b/},
];

async function runtimeFiles(dir){
  const out=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...await runtimeFiles(full));
    else if(/\.(?:mjs|js)$/.test(entry.name))out.push(full);
  }
  return out;
}

test('CRITICAL v3.9.10 PORTABILITY: production runtime contains no Belo\'ren validation constants',async()=>{
  const files=(await Promise.all(ROOTS.map(runtimeFiles))).flat();
  const violations=[];
  for(const file of files){
    const text=await readFile(file,'utf8');
    for(const rule of FORBIDDEN)if(rule.pattern.test(text))violations.push(`${file}: ${rule.label}`);
  }
  assert.deepEqual(violations,[],`Boss-specific validation constants leaked into production runtime:\n${violations.join('\n')}`);
});

test('CRITICAL v3.9.10 PORTABILITY: generic learning contract forbids boss-specific prerequisites and requires portability tests',async()=>{
  const [agents,pipeline,holdout]=await Promise.all([
    readFile('AGENTS.md','utf8'),
    readFile('docs/IRIS-BOSS-AGNOSTIC-LEARNING-PIPELINE-V1.md','utf8'),
    readFile('docs/IRIS-UNTOUCHED-HOLDOUT-V1.md','utf8'),
  ]);
  assert.match(agents,/Production learning logic is state\/evidence-driven and boss-agnostic/i);
  assert.match(agents,/Do not hard-code encounter IDs, ability IDs, spell names or current-boss meaning/i);
  assert.match(pipeline,/This contract defines how Iris refines encounter knowledge for \*\*any\*\* boss/i);
  assert.match(pipeline,/No learning stage may require a hard-coded boss name, encounter ID, ability ID, spell name, phase name, or encounter-specific rule/i);
  assert.match(pipeline,/Every new generic learning stage must have at least one synthetic test using arbitrary encounter\/ability IDs and names/i);
  assert.match(holdout,/not automatically an Untouched Holdout/i);
});
