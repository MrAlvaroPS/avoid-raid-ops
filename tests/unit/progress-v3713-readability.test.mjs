import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

test('v3.7.13 Progress runtime parses and adds no browser WCL requests',async()=>{
  const source=await read('public/progress-runtime-v3713.js');
  assert.doesNotThrow(()=>new vm.Script(source,{filename:'progress-runtime-v3713.js'}));
  assert.match(source,/extraWclRequests:0/);
  assert.match(source,/presentationPolicy:'signal-first-quality-second'/);
  assert.match(source,/chartPolicy:'measured-depth-best-so-far'/);
  assert.doesNotMatch(source,/\bfetch\s*\(/);
});

test('banner presents the strategic signal before the quality warning',async()=>{
  const source=await read('public/progress-runtime-v3713.js');
  assert.match(source,/PROGRESSION SIGNAL/);
  assert.match(source,/YES — S\$\{stage\} IS BECOMING MORE REPEATABLE/);
  assert.match(source,/DEPTH DATA LIMITED/);
  assert.match(source,/m\.candidateState\|\|m\.state/);
  assert.doesNotMatch(source,/b\.textContent=m\.state\?\.label/);
});

test('trend chart never connects exact-100 non-measured pulls as real depth',async()=>{
  const source=await read('public/progress-runtime-v3713.js');
  assert.match(source,/function isDepthMeasured/);
  assert.match(source,/v<99\.999/);
  assert.match(source,/progress-best-line/);
  assert.match(source,/progress-form-line/);
  assert.match(source,/progress-unmeasured-tick/);
  assert.match(source,/WCL DEPTH UNAVAILABLE/);
  assert.doesNotMatch(source,/polygon points=/);
});

test('chart range is raw presentation-only and only redraws the chart',async()=>{
  const source=await read('public/progress-runtime-v3713.js');
  assert.match(source,/RAW RANGE/);
  const handler=source.match(/qsa\('\[data-progress-range\]'[\s\S]*?renderChart\(raw,m,ds\);\}\)\);/);
  assert.ok(handler,'range handler exists');
  assert.match(handler[0],/state\.range=btn\.dataset\.progressRange/);
  assert.match(handler[0],/renderChart\(raw,m,ds\)/);
  assert.doesNotMatch(handler[0],/renderNights|renderMatrix|renderHealth|renderBannerAndStats/);
});

test('limited depth swaps first-glance depth formulas for stage conversion and coverage',async()=>{
  const source=await read('public/progress-runtime-v3713.js');
  assert.match(source,/BEST MEASURED PULL/);
  assert.match(source,/S\$\{block\.deepestStage\|\|1\} CONVERSION/);
  assert.match(source,/DEPTH COVERAGE/);
  assert.match(source,/DEEP PULL RATE/);
  assert.match(source,/CONSISTENCY GAP/);
  assert.match(source,/if\(ds\.limited\)/);
});

test('limited depth makes Night-over-night stage-led and retention explicit',async()=>{
  const source=await read('public/progress-runtime-v3713.js');
  assert.match(source,/S\$\{deepest\} REACH/);
  assert.match(source,/stage repeatability/);
  assert.match(source,/DEPTH LIMITED/);
  assert.match(source,/Retention needs comparable measured closing depth/);
});

test('presentation contract keeps metric semantics separate from confidence and chart semantics',async()=>{
  const doc=await read('docs/PROGRESS-PRESENTATION-CONTRACT.md');
  assert.match(doc,/does \*\*not\*\* redefine the v2 formulas/i);
  assert.match(doc,/signal first, data quality second/i);
  assert.match(doc,/Best-so-far measured depth/);
  assert.match(doc,/5-measured-pull form median/);
  assert.match(doc,/must never silently change a metric formula/i);
  assert.match(doc,/65%/);
});