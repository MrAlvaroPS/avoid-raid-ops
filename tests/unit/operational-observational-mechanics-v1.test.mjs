import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeEncounterMechanics } from '../../server/analysis/mechanics/encounter-rule-engine.mjs';

const fight={id:1,startTime:0,endTime:10000};

test('observational damage mechanics count as observed without becoming failures',()=>{
  const pack={version:'test',mechanics:[{key:'pressure',name:'Pressure',category:'raid-damage',severity:2,scoreable:false,inference:'pressure-window',damageIds:[111]}]};
  const result=analyzeEncounterMechanics({pack,fights:[fight],damageEvents:[{fight:1,timestamp:1000,type:'damage',ability:111,targetID:7},{fight:1,timestamp:1010,type:'damage',ability:111,targetID:8}]});
  const mechanic=result.mechanics[0];
  assert.equal(mechanic.observedIncidents,1);
  assert.equal(mechanic.failures,0);
  assert.equal(mechanic.failedOccurrences,0);
  assert.equal(mechanic.denominatorStatus,'observed-only');
  assert.equal(mechanic.executionSuccessPct,null);
  assert.equal(result.failures.length,0);
  assert.equal(result.summary.mechanicalAccuracy,null);
});

test('observational cast mechanics count opportunities but never fabricate failure records',()=>{
  const pack={version:'test',mechanics:[{key:'phase',name:'Phase Signal',category:'phase-boundary',severity:1,scoreable:false,inference:'phase-boundary-observed',castIds:[222]}]};
  const result=analyzeEncounterMechanics({pack,fights:[fight],castEvents:[{fight:1,timestamp:2000,type:'begincast',ability:222,sourceID:99},{fight:1,timestamp:2500,type:'cast',ability:222,sourceID:99}]});
  const mechanic=result.mechanics[0];
  assert.equal(mechanic.opportunities,1);
  assert.equal(mechanic.observedIncidents,1);
  assert.equal(mechanic.failures,0);
  assert.equal(mechanic.denominatorStatus,'observed-only');
  assert.equal(result.failures.length,0);
});
