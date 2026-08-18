import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { findIrisSource,getIrisSourceRegistry } from '../../server/iris/external-source-registry-v390.mjs';
import { findIrisCapability,getIrisCapabilityContract } from '../../server/iris/capability-contract-v390.mjs';
import abilityKnowledgeService from '../../server/services/ability-knowledge-service.mjs';

const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');

test('CRITICAL v3.9.3 SOURCES: Lorrgs runtime and Parse Wowhead wrapper retain explicit trust boundaries under later releases',()=>{
  assert.equal(getIrisSourceRegistry().version,'iris-source-registry-v2');
  const lorrgs=findIrisSource('lorrgs'),parse=findIrisSource('parse-wowhead');
  assert.equal(lorrgs.runtimeIntegration,'available-readonly');
  assert.equal(lorrgs.trust,'secondary-derived-from-warcraftlogs');
  assert.ok(lorrgs.prohibited.includes('queueing-provider-jobs'));
  assert.equal(parse.runtimeIntegration,'available-optional');
  assert.equal(parse.trust,'reference-identity-enrichment');
  assert.ok(parse.prohibited.includes('treating-wrapper-as-official-wowhead-api'));
  assert.ok(parse.prohibited.includes('automatic-mechanic-promotion'));
});

test('CRITICAL v3.9.3 CAPABILITIES: provider preview remains network-free and resolution remains explicit under v3.9.4',()=>{
  assert.equal(getIrisCapabilityContract().release,'3.9.4');
  const preview=findIrisCapability('knowledge.ability.preview'),resolve=findIrisCapability('knowledge.ability.resolve'),parse=findIrisCapability('knowledge.provider-parse-wowhead');
  assert.equal(preview.autonomy,'automatic');assert.equal(preview.effect,'read-only-plan');
  assert.equal(resolve.autonomy,'explicitApproval');assert.equal(resolve.effect,'bounded-provider-read');
  assert.equal(parse.autonomy,'explicitApproval');
});

test('CRITICAL v3.9.3 API: GET preview performs no provider execution and stale/unconfirmed POST cannot execute',async()=>{
  const previewResponse=await abilityKnowledgeService(new Request('http://localhost/api/knowledge/ability?abilityIds=700001,700002&encounterId=9876&bossSlug=synthetic-boss'));
  assert.equal(previewResponse.status,200);const previewBody=await previewResponse.json();assert.equal(previewBody.networkExecuted,false);assert.equal(previewBody.preview.networkUpperBound.wclCalls,0);
  const unconfirmed=await abilityKnowledgeService(new Request('http://localhost/api/knowledge/ability',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'resolve',abilityIds:[700001],bossSlug:'synthetic-boss',previewFingerprint:'wrong'})}));
  assert.equal(unconfirmed.status,409);
});

test('CRITICAL v3.9.3 DOCS: provider metadata remains unable to become combat truth, Deep coverage or automatic promotion under later v3.9 releases',async()=>{
  const [contract,parse,lorrgs,readme,route,pkg]=await Promise.all([read('docs/IRIS-PROVIDER-AWARE-ABILITY-KNOWLEDGE-V1.md'),read('docs/iris-sources/PARSE-WOWHEAD.md'),read('docs/iris-sources/LORRGS.md'),read('docs/iris-sources/README.md'),read('routes/api/knowledge/ability.js'),read('package.json')]);
  assert.match(contract,/0 canonical Deep reports\/pulls/);assert.match(contract,/no automatic mechanic promotion/);
  assert.match(parse,/not an official Wowhead developer API/i);assert.match(parse,/confirmParseCredits:true/);
  assert.match(lorrgs,/secondary boss-membership evidence/i);assert.match(readme,/Parse Wowhead API/);
  assert.match(route,/ability-knowledge-service/);assert.match(pkg,/"version": "0\.3\.9-(?:[4-9]|\d{2,})-vercel\.0"/);
});
