import test from 'node:test';
import assert from 'node:assert/strict';
import { liveCorpusSnapshotV374, filterOriginVerifiedRelationsV374, dataDepthPctV374 } from '../../server/corpus/model-policy-v374.mjs';

function aggregate(){
  return {
    validationFraction:.2,
    wideReports:136,deepReports:50,killPulls:139,wipePulls:870,deepKillPulls:50,deepWipePulls:343,discoveredSourcePool:147,
    sourceReports:{a:1,b:1,c:1},deepSourceReports:{a:1,b:1},
    splits:{
      train:{wideReports:102,deepReports:38,sourceReports:{a:1,b:1},deepSourceReports:{a:1},originEvidence:{
        '100':{friendlySourceEvents:0,encounterOrUnknownSourceEvents:40,unknownSourceEvents:0,reportsWithEvidence:4},
        '200':{friendlySourceEvents:30,encounterOrUnknownSourceEvents:0,unknownSourceEvents:0,reportsWithEvidence:4},
        '300':{friendlySourceEvents:0,encounterOrUnknownSourceEvents:25,unknownSourceEvents:0,reportsWithEvidence:4},
        '400':{friendlySourceEvents:3,encounterOrUnknownSourceEvents:3,unknownSourceEvents:0,reportsWithEvidence:2},
      }},
      validation:{wideReports:34,deepReports:12,sourceReports:{c:1},deepSourceReports:{b:1}},
    },
  };
}

test('v3.7.4 live corpus snapshot uses aggregate counters instead of stale compiled model counters',()=>{
  const live=liveCorpusSnapshotV374(aggregate(),{wideReports:136,deepReports:26,deepKillPulls:28,deepWipePulls:175,validationReports:34});
  assert.equal(live.deepReports,50);
  assert.equal(live.deepKillPulls+live.deepWipePulls,393);
  assert.equal(live.validationReports,34);
  assert.equal(live.independentSources,3);
});

test('v3.7.4 relation provenance rejects friendly player auras and only scores encounter-origin targets',()=>{
  const relations=[
    {targetId:200,triggerCastIds:[100],confidence:.95},
    {targetId:300,triggerCastIds:[100],confidence:.88},
    {targetId:400,triggerCastIds:[100],confidence:.9},
  ];
  const out=filterOriginVerifiedRelationsV374(relations,aggregate());
  assert.deepEqual(out.accepted.map(x=>x.targetId),[300]);
  assert.deepEqual(out.rejected.map(x=>x.targetId),[200]);
  assert.deepEqual(out.unverified.map(x=>x.targetId),[400]);
});

test('v3.7.4 data depth reacts to newly persisted Deep evidence',()=>{
  const thresholds={minWidePulls:2500,minDeepPulls:300,minWideReports:250,minDeepReports:50,minValidationReports:50};
  const before=dataDepthPctV374({killPulls:139,wipePulls:870,deepKillPulls:28,deepWipePulls:175,wideReports:136,deepReports:26,validationReports:34},thresholds);
  const after=dataDepthPctV374({killPulls:139,wipePulls:870,deepKillPulls:50,deepWipePulls:343,wideReports:136,deepReports:50,validationReports:34},thresholds);
  assert.ok(after>before);
  assert.ok(after>=70);
});
