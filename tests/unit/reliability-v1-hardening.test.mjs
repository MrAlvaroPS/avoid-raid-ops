import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreReliabilityProfiles } from '../../server/analysis/reliability/reliability-engine-v1.mjs';

function ledger({pulls=40,nights=3,mechanicConfidence='confirmed'}={}){
  const actorId=1;
  const mechanics=Array.from({length:30},(_,i)=>({actorId,key:`m${i}`,fightId:(i%pulls)+1,mechanicKey:'m',severity:5,confidence:mechanicConfidence,success:true}));
  const survival=Array.from({length:pulls},(_,i)=>({actorId,key:`s${i}`,fightId:i+1,incidentPenalty:0,success:true}));
  const defensives=Array.from({length:10},(_,i)=>({actorId,key:`d${i}`,fightId:(i%pulls)+1,dangerWeight:1,confidence:'confirmed',success:true}));
  return{
    identity:{key:'wcl:1',canonicalId:1,status:'canonical',actorId,name:'Alpha',className:'Mage',spec:'Frost',role:'DPS'},
    context:{encounterId:3182,difficulty:5,partition:4,nights},
    participation:{pullsAttended:pulls,fightIds:Array.from({length:pulls},(_,i)=>i+1)},
    mechanics:{opportunities:mechanics,unscoredFailures:[],unscoredOpportunities:[]},
    survival:{sourceComplete:true,opportunities:survival,unscored:[]},
    defensives:{opportunities:defensives,unscored:[]},duties:{opportunities:[],unscored:[]},
    adaptation:{status:'pending'},validation:{ok:true,status:'valid',errors:[],warnings:[]}
  };
}

test('overall Reliability remains shadow when confidence is LOW even if minimum dimensions technically score',()=>{
  const [profile]=scoreReliabilityProfiles([ledger({pulls:15,nights:2})]);
  assert.equal(profile.confidence.level,'low');
  assert.equal(profile.value,null);
  assert.equal(profile.status,'shadow-pending');
  assert.ok(profile.publication.reasons.some(x=>x.includes('confidence low/medium required')));
});

test('low-confidence clean mechanic evidence contributes less opportunity mass than confirmed evidence',()=>{
  const [confirmed]=scoreReliabilityProfiles([ledger({mechanicConfidence:'confirmed'})]);
  const [low]=scoreReliabilityProfiles([ledger({mechanicConfidence:'low'})]);
  assert.equal(confirmed.components.mechanics.sample.opportunityMass,30);
  assert.equal(low.components.mechanics.sample.opportunityMass,10.5);
  assert.equal(low.components.mechanics.status,'pending');
});

test('Survival explanation explicitly describes availability rather than proven blame',()=>{
  const [profile]=scoreReliabilityProfiles([ledger()]);
  assert.match(profile.components.survival.why,/availability, not proven blame/i);
});
