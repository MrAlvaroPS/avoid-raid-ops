import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  classifyOriginEvidenceV379,
  triageSignalsV379,
  relationProvenanceSummaryV379,
  localSignalReviewV379,
  applySignalTriageOverlayV379,
} from '../../server/corpus/model-policy-v379.mjs';

function signalAbility(id,name){
  return{
    id,name,
    wide:{
      kill:{Casts:{reportsWith:10},Damage:{reportsWith:0}},
      wipe:{Casts:{reportsWith:10},Damage:{reportsWith:10}},
    },
    deep:{kill:{},wipe:{}},
  };
}

function aggregate(){
  return{
    splits:{train:{
      killReports:10,wipeReports:10,deepKillPulls:10,deepWipePulls:10,
      abilities:{
        '1':signalAbility(1,'Friendly Critical'),
        '2':signalAbility(2,'Encounter Critical'),
        '3':signalAbility(3,'Mixed Critical'),
        '4':signalAbility(4,'Unknown Critical'),
      },
      originEvidence:{
        '1':{friendlySourceEvents:90,encounterOrUnknownSourceEvents:10,unknownSourceEvents:0,reportsWithEvidence:5},
        '2':{friendlySourceEvents:2,encounterOrUnknownSourceEvents:28,unknownSourceEvents:1,reportsWithEvidence:5},
        '3':{friendlySourceEvents:12,encounterOrUnknownSourceEvents:12,unknownSourceEvents:0,reportsWithEvidence:5},
        '4':{friendlySourceEvents:1,encounterOrUnknownSourceEvents:2,unknownSourceEvents:8,reportsWithEvidence:1},
      },
    }},
  };
}

function baseModel(){
  const friendlyRejected=Array.from({length:2},(_,i)=>({targetId:100+i,originRejectReason:'friendly-target-aura'}));
  return{
    pack:{mechanics:[]},
    rejected:[{key:'candidate-2',name:'Encounter candidate',primaryAbilityId:2,reason:'holdout-thin',inference:'stateful-impact-observed',validationScore:.61}],
    discovery:{
      relationCandidates:Array.from({length:4},(_,i)=>({targetId:200+i,confidence:.8})),
      filteredRelationCandidates:[...friendlyRejected,{targetId:300,triggerCastIds:[301],originRejectReason:'origin-not-yet-verified'}],
      variantFamilies:[{key:'light-void:test',memberIds:[2,22],tokenGroup:'light-void',confidence:.9,encounterSupported:true}],
    },
    corpus:{wideReports:183,deepReports:60},
    learning:{
      scorePct:78.8,
      components:{signalDiscoveryPct:65.2,signalCoveragePct:65.2,relationUnderstandingPct:84.6,validationConfidencePct:75.8,dataDepthPct:80.9,sourceDiversityPct:100,semanticResolutionPct:84.6},
      caps:['critical-unresolved-signals'],
      semantic:{score:.1829,resolvedNeeds:0,totalNeeds:0,stateDimensions:1,variantFamilies:11,relationCandidates:4},
      enrichmentFocusAbilityIds:[1,999],
      enrichmentRecommendation:{priority:'medium',mode:'reports-first',reason:'Distinct report breadth is the next publication gate.',suggestedAdditionalWidePulls:1000,suggestedAdditionalWideReports:67,suggestedAdditionalDeepPulls:0,suggestedAdditionalDeepReports:0,suggestedAdditionalValidationReports:13,deficits:{widePulls:920,wideReports:67,validationReports:13,deepPulls:0,deepReports:0}},
      needsEvidence:[{kind:'relations',title:'stale relation count'},{kind:'relations-origin',title:'stale provenance'},{kind:'mechanic',title:'Wither',detail:'holdout weak'}],
    },
    validation:{thresholds:{minSignalCoverage:.75,maxCriticalUnresolved:0,minSemanticCoverage:.70,minLearnedPct:82},publishChecks:{semanticCoverage:true,signalCoverage:false,criticalUnresolved:false,learningScore:false}},
  };
}

test('origin triage distinguishes friendly, encounter, mixed and unknown without guessing from names',()=>{
  assert.equal(classifyOriginEvidenceV379({friendlySourceEvents:90,encounterOrUnknownSourceEvents:10,reportsWithEvidence:5}).classification,'friendly-player');
  assert.equal(classifyOriginEvidenceV379({friendlySourceEvents:2,encounterOrUnknownSourceEvents:28,unknownSourceEvents:1,reportsWithEvidence:5}).classification,'encounter');
  assert.equal(classifyOriginEvidenceV379({friendlySourceEvents:12,encounterOrUnknownSourceEvents:12,reportsWithEvidence:5}).classification,'mixed');
  assert.equal(classifyOriginEvidenceV379({friendlySourceEvents:1,encounterOrUnknownSourceEvents:2,unknownSourceEvents:8,reportsWithEvidence:1}).classification,'unknown');
});

test('friendly critical-looking abilities leave the GLOBAL BOSS denominator while mixed/unknown stay actionable',()=>{
  const triage=triageSignalsV379(baseModel(),aggregate());
  assert.ok(triage.excludedFriendly.some(row=>row.id===1));
  assert.ok(!triage.criticalUnresolved.some(row=>row.id===1));
  assert.ok(triage.criticalLocalQueue.some(row=>row.id===2));
  assert.deepEqual(triage.criticalProbeQueue.map(row=>row.id),[3,4]);
  assert.equal(triage.denominatorRule.includes('friendly-player'),true);
});

test('encounter-classified unresolved signals get a zero-WCL local context bundle before new queries',()=>{
  const triage=triageSignalsV379(baseModel(),aggregate());
  const review=localSignalReviewV379(baseModel(),triage);
  assert.equal(review.length,1);
  assert.equal(review[0].id,2);
  assert.equal(review[0].wclCallsExecuted,0);
  assert.equal(review[0].rejectedCandidates[0].key,'candidate-2');
  assert.equal(review[0].variantFamilies[0].key,'light-void:test');
});

test('relation provenance counts friendly/noisy as closed and only mixed/unknown as awaiting evidence',()=>{
  const summary=relationProvenanceSummaryV379(baseModel());
  assert.equal(summary.verified,4);
  assert.equal(summary.friendlyOrNoisy,2);
  assert.equal(summary.awaitingOriginEvidence,1);
});

test('v3.7.9 separates learning from publication and removes the misleading semantic alias',()=>{
  const model=applySignalTriageOverlayV379(baseModel(),aggregate());
  assert.equal(model.engineVersion,'3.7.9');
  assert.equal(model.learning.components.semanticResolutionPct,undefined);
  assert.equal(model.learning.components.semanticCoverageTechnicalPct,18.3);
  assert.equal(model.validation.publishChecks.semanticCoverage,false);
  assert.equal(model.validation.publishChecks.semanticCoverageTechnical,false);
  assert.equal(model.learning.recommendations.learningNext.mode,'surgical-probe-plan');
  assert.equal(model.learning.recommendations.learningNext.execution,'dry-run-only');
  assert.deepEqual(model.learning.recommendations.learningNext.targetAbilityIds,[3,4]);
  assert.equal(model.learning.recommendations.publicationNext.mode,'reports-first');
  assert.equal(model.learning.actionBottleneck,'signalDiscoveryPct');
  assert.equal(model.learning.publicationActionBottleneck,'dataDepthPct');
  assert.deepEqual(model.learning.enrichmentFocusAbilityIds.slice(0,3),[3,4,2]);
  assert.ok(!model.learning.enrichmentFocusAbilityIds.includes(1));
  const relationNeed=model.learning.needsEvidence.find(row=>row.kind==='relations-origin');
  assert.match(relationNeed.detail,/4 origin-verified · 2 friendly\/noisy closed · 1 awaiting origin evidence/);
});

test('corpus route exposes probe-plan as zero-WCL, separates publication Improve, and preserves explicit zero Deep work',async()=>{
  const route=await readFile(new URL('../../routes/api/wcl/corpus.js',import.meta.url),'utf8');
  assert.match(route,/actionFromQuery === 'probe-plan'/);
  assert.match(route,/wclCallsExecuted:0/);
  assert.match(route,/learning\?\.publicationRecommendation/);
  assert.match(route,/applyBossSamplingPolicyV379/);
  assert.match(route,/explicitNonNegative\(rec\.suggestedAdditionalDeepPulls,100\)/);
  assert.doesNotMatch(route,/Number\(rec\.suggestedAdditionalDeepPulls\) \|\| 100/);
});
