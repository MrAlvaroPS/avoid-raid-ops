import test from 'node:test';
import assert from 'node:assert/strict';
import { bossKnowledgeScope, homeGuildId } from '../../server/knowledge/scopes.mjs';
import { buildBossSamplingManifest, samplingPublicationChecks } from '../../server/corpus/sampling-v2.mjs';

const scope=bossKnowledgeScope({encounterId:3182,difficulty:5,partition:4});
const stats={reports:1,pulls:1,sources:1,maxSourceReportShare:1,maxSourcePullShare:1,sourceReports:{},sourcePulls:{},strata:{kill:{reports:1,pulls:1,sources:1},deepWipe:{reports:0,pulls:0,sources:0},midWipe:{reports:0,pulls:0,sources:0},earlyWipe:{reports:0,pulls:0,sources:0}}};
const sample=(selected)=>({selected,stats,available:stats,excluded:{homeGuild:0,wrongScope:0,missingSource:0}});

test('manifest detects selected home-guild contamination from evidence itself',()=>{
  const home={code:'home',encounterId:3182,difficulty:5,partition:4,guild:{id:homeGuildId()},fights:[{kill:true}]};
  const manifest=buildBossSamplingManifest({scope,wideSample:sample([home]),deepSample:sample([])});
  assert.equal(manifest.homeGuildSelectedReports,1);
  assert.equal(samplingPublicationChecks(manifest).homeGuildExcluded,false);
});

test('manifest detects selected wrong-scope and missing-source evidence from evidence itself',()=>{
  const wrong={code:'wrong',encounterId:3182,difficulty:5,partition:3,guild:{id:900001},fights:[{kill:true}]};
  const missing={code:'missing',encounterId:3182,difficulty:5,partition:4,guild:null,owner:null,fights:[{kill:true}]};
  const manifest=buildBossSamplingManifest({scope,wideSample:sample([wrong,missing]),deepSample:sample([])});
  const checks=samplingPublicationChecks(manifest);
  assert.equal(manifest.selectedWrongScopeReports,1);
  assert.equal(manifest.selectedMissingSourceReports,1);
  assert.equal(checks.scopeIsolation,false);
  assert.equal(checks.sourceIdentityComplete,false);
});
