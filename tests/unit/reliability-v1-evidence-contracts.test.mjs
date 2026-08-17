import test from 'node:test';
import assert from 'node:assert/strict';
import { RELIABILITY_EVIDENCE_CONTRACTS,validateEvidenceCandidate,reliabilityEvidenceKey } from '../../server/analysis/reliability/evidence-contracts-v1.mjs';

test('all Reliability producer contracts require explicit source completeness',()=>{
  for(const kind of ['mechanic','survival','defensive','duty']){
    assert.ok(RELIABILITY_EVIDENCE_CONTRACTS[kind].required.includes('sourceComplete'));
  }
});

test('mechanic evidence cannot score without explicit assignment/observability/completeness',()=>{
  const base={actorId:1,fightId:2,mechanicKey:'feather',occurrenceKey:'f:1',severity:5,confidence:'confirmed'};
  const bad=validateEvidenceCandidate('mechanic',base);
  assert.equal(bad.ok,false);
  assert.ok(bad.errors.some(x=>x.includes('assignment')));
  assert.ok(bad.errors.some(x=>x.includes('source completeness')));
  const good=validateEvidenceCandidate('mechanic',{...base,assigned:true,observable:true,sourceComplete:true});
  assert.equal(good.ok,true);
});

test('defensive evidence needs availability, complete source and explicit outcome',()=>{
  const base={actorId:1,fightId:2,opportunityKey:'window:1',availability:'confirmed',sourceComplete:true,confidence:'confirmed'};
  assert.equal(validateEvidenceCandidate('defensive',base).ok,false);
  assert.equal(validateEvidenceCandidate('defensive',{...base,usedOnTime:false}).ok,true);
});

test('evidence keys include pull, actor, dimension and responsibility identity',()=>{
  const key=reliabilityEvidenceKey('duty',{fightId:7,actorId:42,dutyKey:'interrupt-edict',opportunityKey:'cast-3'});
  assert.equal(key,'7:42:duty:interrupt-edict:cast-3');
});
