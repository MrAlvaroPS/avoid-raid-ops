import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildReliabilityEvidenceLedger,validateReliabilityLedger } from '../../server/analysis/reliability/evidence-ledger-v1.mjs';
import { scoreReliabilityProfiles } from '../../server/analysis/reliability/reliability-engine-v1.mjs';
import { selectPeerBaseline } from '../../server/analysis/reliability/peer-baseline-v1.mjs';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

function peerProfile({key,name='P',className='Mage',spec='Frost',role='DPS',value=90,encounterId=3182,difficulty=5,partition=4}={}){
  return{
    identity:{key,name,className,spec,role},
    context:{encounterId,difficulty,partition},
    components:{mechanics:{value},survival:{value},defensives:{value},duties:{value}}
  };
}

function scoredLedger({actorId=1,name='Alpha',mechanicFails=2}={}){
  const mechanics=Array.from({length:30},(_,i)=>({actorId,key:`m${i}`,fightId:i+1,mechanicKey:'m',severity:5,confidence:'confirmed',success:i>=mechanicFails,failure:i<mechanicFails?{confidence:'confirmed'}:null}));
  const survival=Array.from({length:40},(_,i)=>({actorId,key:`s${i}`,fightId:i+1,incidentPenalty:i===0?1:0,firstMeaningfulDeath:i===0,meaningfulDeath:i===0,success:i!==0}));
  const defensives=Array.from({length:10},(_,i)=>({actorId,key:`d${i}`,fightId:i+1,dangerWeight:1,confidence:'confirmed',success:i!==0}));
  const duties=Array.from({length:10},(_,i)=>({actorId,key:`u${i}`,fightId:i+1,importance:1,confidence:'confirmed',success:i!==0}));
  return{
    identity:{key:`wcl:${actorId}`,canonicalId:actorId,status:'canonical',actorId,name,className:'Mage',spec:'Frost',role:'DPS'},
    context:{encounterId:3182,difficulty:5,partition:4,nights:3},
    participation:{pullsAttended:40,fightIds:Array.from({length:40},(_,i)=>i+1)},
    mechanics:{opportunities:mechanics,unscoredFailures:[],unscoredOpportunities:[]},
    survival:{sourceComplete:true,opportunities:survival,unscored:[]},
    defensives:{opportunities:defensives,unscored:[]},duties:{opportunities:duties,unscored:[]},
    adaptation:{status:'pending'},validation:{ok:true,status:'valid',errors:[],warnings:[]}
  };
}

test('ledger validator catches impossible attendance/survival populations',()=>{
  const ledger={
    identity:{status:'canonical'},
    participation:{pullsAttended:2,fightIds:[1,1]},
    mechanics:{opportunities:[],unscoredFailures:[],unscoredOpportunities:[]},
    survival:{sourceComplete:true,opportunities:[{fightId:1},{fightId:1}],unscored:[]},
    defensives:{opportunities:[],unscored:[]},
    duties:{opportunities:[],unscored:[]}
  };
  const result=validateReliabilityLedger(ledger);
  assert.equal(result.ok,false);
  assert.ok(result.errors.some(x=>x.includes('duplicate attended fight IDs')));
  assert.ok(result.errors.some(x=>x.includes('pullsAttended')));
  assert.ok(result.errors.some(x=>x.includes('duplicate survival opportunity')));
});

test('incomplete Survival source creates no clean survival opportunities by default',()=>{
  const players=[{actorId:1,name:'Alpha',className:'Mage',spec:'Frost',role:'DPS'}];
  const fights=Array.from({length:20},(_,i)=>({id:i+1,friendlyPlayers:[1]}));
  const [ledger]=buildReliabilityEvidenceLedger({players,fights,meaningfulDeathsByFight:new Map()});
  assert.equal(ledger.survival.sourceComplete,false);
  assert.equal(ledger.survival.opportunities.length,0);
  assert.equal(ledger.survival.unscored.length,20);
  const [profile]=scoreReliabilityProfiles([ledger]);
  assert.equal(profile.components.survival.status,'pending');
});

test('mechanic opportunity must explicitly prove assignment, observability and source completeness',()=>{
  const players=[{actorId:1,name:'Alpha',className:'Mage',spec:'Frost',role:'DPS'}];
  const fights=[{id:1,friendlyPlayers:[1]}];
  const candidate={actorId:1,fightId:1,mechanicKey:'m',occurrenceKey:'m1',severity:5,confidence:'confirmed'};
  const [ledger]=buildReliabilityEvidenceLedger({players,fights,mechanicOpportunities:[candidate]});
  assert.equal(ledger.mechanics.opportunities.length,0);
  assert.equal(ledger.mechanics.unscoredOpportunities.length,1);
  assert.match(ledger.mechanics.unscoredOpportunities[0].reason,/source-not-proven-complete/);
});

test('confirmed defensive availability still cannot score when source completeness or outcome is missing',()=>{
  const players=[{actorId:1,name:'Alpha',className:'Mage',spec:'Frost',role:'DPS'}];
  const fights=[{id:1,friendlyPlayers:[1]}];
  const [ledger]=buildReliabilityEvidenceLedger({players,fights,defensiveOpportunities:[{actorId:1,fightId:1,opportunityKey:'d',availability:'confirmed'}]});
  assert.equal(ledger.defensives.opportunities.length,0);
  assert.equal(ledger.defensives.unscored.length,1);
  assert.match(ledger.defensives.unscored[0].reason,/source-not-proven-complete/);
});

test('data integrity failure blocks publication even if component samples look complete',()=>{
  const ledger=scoredLedger();
  ledger.validation={ok:false,status:'data-error',errors:['synthetic invariant failure'],warnings:[]};
  const [profile]=scoreReliabilityProfiles([ledger]);
  assert.equal(profile.status,'data-error');
  assert.equal(profile.value,null);
  assert.ok(profile.publication.reasons.some(x=>x.includes('data integrity')));
});

test('peer hierarchy prefers same-spec+role within the same encounter context',()=>{
  const target=peerProfile({key:'target'});
  const peers=[1,2,3].map(i=>peerProfile({key:`frost${i}`,name:`F${i}`,value:80+i*2}));
  const classPeers=[1,2,3,4].map(i=>peerProfile({key:`fire${i}`,name:`R${i}`,spec:'Fire',value:95}));
  const otherEncounter=[1,2,3].map(i=>peerProfile({key:`other${i}`,name:`O${i}`,value:10,encounterId:9999}));
  const baseline=selectPeerBaseline([target,...peers,...classPeers,...otherEncounter],target,'mechanics');
  assert.equal(baseline.source,'same-spec-role');
  assert.equal(baseline.peerCount,3);
  assert.equal(baseline.value,84);
});

test('changing the peer population cannot change a player absolute Reliability score',()=>{
  const target=scoredLedger({actorId:1,name:'Target'});
  const weakPeers=Array.from({length:3},(_,i)=>scoredLedger({actorId:i+2,name:`Weak${i}`,mechanicFails:15}));
  const strongPeers=Array.from({length:3},(_,i)=>scoredLedger({actorId:i+20,name:`Strong${i}`,mechanicFails:0}));
  const alone=scoreReliabilityProfiles([target])[0];
  const withWeak=scoreReliabilityProfiles([target,...weakPeers])[0];
  const withStrong=scoreReliabilityProfiles([target,...strongPeers])[0];
  assert.equal(alone.value,withWeak.value);
  assert.equal(alone.value,withStrong.value);
  assert.notEqual(withWeak.components.mechanics.peer.value,withStrong.components.mechanics.peer.value);
  assert.equal(withWeak.dataTruth.peerAffectsScore,false);
});

test('intelligence engine exposes Reliability shadow without claiming missing denominators',async()=>{
  const source=await read('server/engines/intelligence-engine.mjs');
  assert.match(source,/buildReliabilityEvidenceLedger/);
  assert.match(source,/scoreReliabilityProfiles/);
  assert.match(source,/status:'shadow'/);
  assert.match(source,/mechanicOpportunities:mechanicsRaw\?\.playerOpportunities\|\|\[\]/);
  assert.match(source,/defensiveOpportunities:telemetry\?\.reliabilityEvidence\?\.defensiveOpportunities\|\|\[\]/);
  assert.match(source,/DPS\/HPS\/parse are explicitly excluded from the Reliability formula/);
});

test('Reliability technical contracts separate parse, peers and unknown availability',async()=>{
  const [contract,integrity,status]=await Promise.all([
    read('docs/RELIABILITY-CONTRACT-V1.md'),read('docs/RELIABILITY-DATA-INTEGRITY-V1.md'),read('docs/RELIABILITY-SHADOW-STATUS.md')
  ]);
  assert.match(contract,/DPS, HPS, WCL parse percentile/);
  assert.match(contract,/Peer groups do not alter the score/);
  assert.match(contract,/Only `confirmed available` enters the denominator/);
  assert.match(integrity,/Parse separation invariant/);
  assert.match(status,/overall Reliability must remain `null \/ shadow-pending`/);
});
