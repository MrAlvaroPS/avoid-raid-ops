import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReliabilityEvidenceLedger } from '../../server/analysis/reliability/evidence-ledger-v1.mjs';
import { scoreReliabilityProfiles,compareReliabilityProfiles } from '../../server/analysis/reliability/reliability-engine-v1.mjs';
import { RELIABILITY_POLICY } from '../../server/analysis/reliability/reliability-policy-v1.mjs';

function completeLedger({name='Alpha',actorId=1,role='DPS',className='Mage',spec='Frost',mechanicFails=2,survivalIncidents=2,defensiveFails=1,dutyFails=1}={}){
  const mechanics=Array.from({length:30},(_,i)=>({key:`mechanic:${actorId}:${i}`,actorId,kind:'mechanic',fightId:i+1,mechanicKey:'m1',occurrenceKey:`m:${i}`,severity:5,confidence:'confirmed',observable:true,assigned:true,sourceComplete:true,success:i>=mechanicFails,failure:i<mechanicFails?{confidence:'confirmed'}:null}));
  const survival=Array.from({length:40},(_,i)=>({key:`s:${actorId}:${i}`,actorId,fightId:i+1,kind:'survival',observable:true,sourceComplete:true,confidence:'confirmed',success:i>=survivalIncidents,incidentPenalty:i<survivalIncidents?(i===0?1:.5):0,firstMeaningfulDeath:i===0,meaningfulDeath:i<survivalIncidents}));
  const defensives=Array.from({length:10},(_,i)=>({key:`d:${actorId}:${i}`,actorId,fightId:i+1,kind:'defensive',observable:true,sourceComplete:true,availability:'confirmed',success:i>=defensiveFails,dangerWeight:1,confidence:'confirmed'}));
  const duties=Array.from({length:10},(_,i)=>({key:`u:${actorId}:${i}`,actorId,fightId:i+1,kind:'duty',sourceComplete:true,assigned:true,observable:true,success:i>=dutyFails,importance:1,confidence:'confirmed'}));
  return{
    schemaVersion:1,
    identity:{key:`wcl:${actorId}`,canonicalId:actorId,status:'canonical',actorId,name,className,spec,role},
    context:{reportCode:'R',encounterId:3182,difficulty:5,partition:4,nights:3},
    participation:{pullsAttended:40,fightIds:Array.from({length:40},(_,i)=>i+1)},
    mechanics:{opportunities:mechanics,unscoredFailures:[],unscoredOpportunities:[]},
    survival:{sourceComplete:true,opportunities:survival,unscored:[]},
    defensives:{opportunities:defensives,unscored:[]},
    duties:{opportunities:duties,unscored:[]},
    adaptation:{status:'observed',repeatOpportunities:10,repeatedFailures:1,repeatedFailureRate:.1,details:[]},
    integrity:{reportScopedIdentity:false,survivalSourceComplete:true,mechanicDenominatorComplete:true,defensiveAvailabilityComplete:true,dutyDenominatorComplete:true},
    validation:{ok:true,status:'valid',errors:[],warnings:[]}
  };
}

test('Reliability is parse-independent even when performance fields change radically',()=>{
  const a=completeLedger();
  const b=structuredClone(a);
  a.performance={dps:1,parse:1,hps:999999};
  b.performance={dps:99999999,parse:100,hps:0};
  const [sa]=scoreReliabilityProfiles([a]);
  const [sb]=scoreReliabilityProfiles([b]);
  assert.equal(sa.value,sb.value);
  assert.deepEqual(sa.scoreTrace,sb.scoreTrace);
  assert.deepEqual(sa.dataTruth.performanceInputsUsed,[]);
  assert.equal(sa.dataTruth.parseExcluded,true);
});

test('unknown defensive availability never creates a scored failure',()=>{
  const players=[{actorId:1,name:'Alpha',className:'Mage',spec:'Frost',role:'DPS'}];
  const fights=Array.from({length:20},(_,i)=>({id:i+1,friendlyPlayers:[1]}));
  const [ledger]=buildReliabilityEvidenceLedger({players,fights,survivalSourceComplete:true,defensiveOpportunities:[{actorId:1,fightId:1,opportunityKey:'d1',availability:'unknown',sourceComplete:true,used:false,late:false}]});
  assert.equal(ledger.defensives.opportunities.length,0);
  assert.equal(ledger.defensives.unscored.length,1);
  const [profile]=scoreReliabilityProfiles([ledger]);
  assert.equal(profile.components.defensives.status,'pending');
});

test('classified mechanic failures without a player denominator remain visible but unscored',()=>{
  const players=[{actorId:1,name:'Alpha',className:'Mage',spec:'Frost',role:'DPS'}];
  const fights=Array.from({length:20},(_,i)=>({id:i+1,friendlyPlayers:[1]}));
  const failure={actorId:1,fightId:3,mechanicKey:'wrong-color',occurrenceKey:'x',severity:5,confidence:'confirmed',reason:'observed'};
  const [ledger]=buildReliabilityEvidenceLedger({players,fights,survivalSourceComplete:true,mechanicFailures:[failure],mechanicOpportunities:[]});
  assert.equal(ledger.mechanics.opportunities.length,0);
  assert.equal(ledger.mechanics.unscoredFailures.length,1);
  const [profile]=scoreReliabilityProfiles([ledger]);
  assert.equal(profile.components.mechanics.status,'pending');
  assert.equal(profile.evidenceSummary.mechanicUnscoredFailures,1);
  assert.equal(profile.value,null);
});

test('Survival denominator is pulls attended, not guild pull count',()=>{
  const players=[{actorId:1,name:'Alpha',className:'Mage',spec:'Frost',role:'DPS'}];
  const fights=Array.from({length:20},(_,i)=>({id:i+1,friendlyPlayers:i<7?[1]:[]}));
  const deaths=new Map([[2,[{actorId:1,timestampReportMs:2000}]]]);
  const [ledger]=buildReliabilityEvidenceLedger({players,fights,meaningfulDeathsByFight:deaths,survivalSourceComplete:true});
  assert.equal(ledger.participation.pullsAttended,7);
  assert.equal(ledger.survival.opportunities.length,7);
  assert.equal(ledger.survival.opportunities.filter(x=>x.firstMeaningfulDeath).length,1);
});

test('a complete canonical profile publishes and exact score trace reconstructs the value',()=>{
  const [profile]=scoreReliabilityProfiles([completeLedger()]);
  assert.equal(profile.status,'published');
  assert.ok(Number.isFinite(profile.value));
  const sum=Number(profile.scoreTrace.rows.reduce((s,r)=>s+r.contribution,0).toFixed(1));
  assert.equal(profile.value,sum);
  assert.equal(profile.confidence.level,'high');
  assert.equal(profile.scoreTrace.scoredWeightCoverage,1);
});

test('mandatory Defensives blocks overall publication even when other dimensions score',()=>{
  const ledger=completeLedger();
  ledger.defensives={opportunities:[],unscored:[]};
  const [profile]=scoreReliabilityProfiles([ledger]);
  assert.equal(profile.value,null);
  assert.equal(profile.status,'shadow-pending');
  assert.ok(profile.publication.reasons.some(r=>r.includes('defensives dimension not scored')));
});

test('one-night/report-scoped data cannot publish an overall Reliability number',()=>{
  const ledger=completeLedger();
  ledger.identity={...ledger.identity,key:'report:R:actor:1',canonicalId:null,status:'report-scoped'};
  ledger.context.nights=1;
  const [profile]=scoreReliabilityProfiles([ledger]);
  assert.equal(profile.value,null);
  assert.equal(profile.status,'shadow-pending');
  assert.ok(profile.publication.reasons.some(r=>r.includes('nights')));
  assert.ok(profile.publication.reasons.some(r=>r.includes('identity')));
});

test('adaptation is reported but does not change the base score for identical opportunities',()=>{
  const a=completeLedger();
  const b=structuredClone(a);
  a.adaptation={status:'observed',repeatOpportunities:20,repeatedFailures:10,repeatedFailureRate:.5,details:[]};
  b.adaptation={status:'observed',repeatOpportunities:20,repeatedFailures:0,repeatedFailureRate:0,details:[]};
  const [sa]=scoreReliabilityProfiles([a]);
  const [sb]=scoreReliabilityProfiles([b]);
  assert.equal(sa.value,sb.value);
  assert.notDeepEqual(sa.adaptation,sb.adaptation);
});

test('overall comparison refuses mismatched scored dimensions',()=>{
  const [a,b]=scoreReliabilityProfiles([completeLedger({name:'A',actorId:1}),completeLedger({name:'B',actorId:2})]);
  const safe=compareReliabilityProfiles(a,b);
  assert.equal(safe.comparable,true);
  const broken=structuredClone(b);
  broken.components.duties={...broken.components.duties,status:'pending',value:null};
  const unsafe=compareReliabilityProfiles(a,broken);
  assert.equal(unsafe.comparable,false);
  assert.match(unsafe.reason,/same scored Reliability dimensions/);
});

test('policy keeps parse outside Reliability and exposes mandatory execution gates',()=>{
  assert.match(RELIABILITY_POLICY.parsePolicy,/never-enter-reliability-score/);
  assert.equal(RELIABILITY_POLICY.dataTruth.performanceDoesNotScore,true);
  assert.equal(RELIABILITY_POLICY.dataTruth.peerGroupDoesNotChangeAbsoluteScore,true);
  assert.deepEqual([...RELIABILITY_POLICY.publication.requiredDimensions],['mechanics','survival','defensives']);
  assert.equal(RELIABILITY_POLICY.publication.minScoredWeightCoverage,.75);
});
