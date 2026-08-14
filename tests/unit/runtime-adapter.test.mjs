import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync(new URL('../../deploy-preview/public/wcl-runtime.js', import.meta.url),'utf8');
const sourceRoster=fs.readFileSync(new URL('../../apps/web/src/features/composition/RosterIntelligence.js', import.meta.url),'utf8');
const indexHtml=fs.readFileSync(new URL('../../deploy-preview/public/index.html', import.meta.url),'utf8');
const v33Css=fs.readFileSync(new URL('../../deploy-preview/public/raidops-v33.css', import.meta.url),'utf8');

test('deploy runtime treats null Reliability as pending rather than zero',()=>{
  assert.match(runtime,/raw === null \|\| raw === undefined \|\| raw === ""/);
  assert.match(runtime,/return value == null \? "—"/);
});

test('Composition class coverage normalizes spaced and compact class slugs',()=>{
  assert.match(runtime,/function classKey\(value\)/);
  assert.match(runtime,/DeathKnight:"Death Knight"/);
  assert.match(runtime,/counts\[classKey\(cls\)\]/);
  assert.match(runtime,/specGrid\.replaceChildren\(\)/);
});

test('runtime DOM selector helper tolerates optional panels',()=>{
  assert.match(runtime,/root \? Array\.from\(root\.querySelectorAll\(sel\)\) : \[\]/);
});

test('source-owned Composition uses the same pending Reliability semantics',()=>{
  assert.match(sourceRoster,/if\(raw===null\|\|raw===undefined\|\|raw===""\)\s*return null/);
  assert.match(sourceRoster,/reliabilityValue\(p\)\?\?"—"/);
});

test('v3.3 runtime enforces Data Truth and links character facts to Wowhead',()=>{
  assert.match(runtime,/function applyDataTruthScrub\(/);
  assert.match(runtime,/dataset\.dataTruth/);
  assert.match(runtime,/function makeWowheadLink\(/);
  assert.match(runtime,/wowhead-link/);
  assert.ok(!runtime.includes('gearAverageItemLevel.toFixed'));
});

test('Pull Lab and Command Center consume Pull Intelligence rather than static comparator mocks',()=>{
  assert.match(runtime,/telemetry\?\.pullIntelligence/);
  assert.match(runtime,/currentVsPrevious/);
  assert.match(runtime,/applyPullIntelligenceToCommand/);
});


test('Data Truth boot gate prevents the Golden mock shell flashing before telemetry is applied',()=>{
  assert.match(indexHtml,/raidops-booting/);
  assert.match(indexHtml,/raidops-boot-screen/);
  assert.match(v33Css,/html\.raidops-booting #root\{visibility:hidden!important\}/);
  assert.match(runtime,/finishDataTruthBoot/);
  assert.match(runtime,/Telemetry unavailable/);
});


test('v3.4 fetches intelligence as an optional operational layer',()=>{
  assert.match(runtime,/const intelligenceEndpoint = new URL\("\/api\/wcl\/intelligence"/);
  assert.match(runtime,/window\.__AVOID_WCL_INTELLIGENCE__/);
  assert.match(runtime,/function applyIntelligence\(\)/);
});

test('Composition never renders opaque talent node IDs as user-facing talent labels',()=>{
  assert.match(runtime,/Raw node IDs hidden/);
  assert.match(runtime,/opaque trait node IDs/i);
  assert.ok(!runtime.includes('`Node ${t.nodeId}`'));
  assert.ok(!runtime.includes('`Entry ${t.entryId}`'));
});

test('Roster Intelligence is explicitly Composition-only and removed from LIVE',()=>{
  assert.match(runtime,/function removeRosterIntelligenceOutsideComposition\(\)/);
  assert.match(runtime,/panel\.style\.display=isComposition\?"":"none"/);
  assert.match(runtime,/Latest pull only · players with classified mechanic\/death evidence/);
});

test('v3.4 operational intelligence surfaces Current Blocker and evidence-backed next-pull calls',()=>{
  assert.match(runtime,/applyIntelligenceCommandCenter/);
  assert.match(runtime,/applyIntelligenceMechanics/);
  assert.match(runtime,/applyIntelligenceLive/);
  assert.match(runtime,/evidence-backed calls/);
  assert.match(runtime,/meaningful deaths temporally linked/);
});

test('Composition never renders Spell null',()=>{
  assert.equal(runtime.includes('Spell null'),false);
  assert.match(runtime,/Number\.isFinite\(Number\(t\?\.spellId\)\)&&Number\(t\.spellId\)>0/);
  assert.match(runtime,/function cleanTalentName\(value\)/);
  assert.match(runtime,/spell\\s\+\(\?:null\|undefined\)/);
});


test('v3.4.2 LIVE and Mechanics use analytical-pull and occurrence-normalized wording',()=>{
  assert.match(runtime,/called-wipe\/reset skipped/);
  assert.match(runtime,/previous analytical pull/);
  assert.match(runtime,/failed executions/);
  assert.match(runtime,/Normalized executions/);
  assert.match(runtime,/pendingDenominators/);
});
