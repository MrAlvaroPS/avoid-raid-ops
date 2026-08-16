import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateReliabilityLedger } from '../../server/analysis/reliability/evidence-ledger-v1.mjs';
import { scoreReliabilityProfiles } from '../../server/analysis/reliability/reliability-engine-v1.mjs';
import { selectPeerBaseline } from '../../server/analysis/reliability/peer-baseline-v1.mjs';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

function minimalRaw({key,name='P',className='Mage',spec='Frost',role='DPS',rate=.9}={}){
  return{identity:{key,name,className,spec,role},raw:{mechanics:{successRate:rate},survival:{successRate:rate},defensives:{successRate:rate},duties:{successRate:rate}}};
}

test('ledger validator catches impossible attendance/survival populations',()=>{
  const ledger={
    identity:{status:'canonical'},
    participation:{pullsAttended:2,fightIds:[1,1]},
    mechanics:{opportunities:[],unscoredFailures:[]},
    survival:{opportunities:[{fightId:1},{fightId:1}]},
    defensives:{opportunities:[],unscored:[]},
    duties:{opportunities:[],unscored:[]}
  };
  const result=validateReliabilityLedger(ledger);
  assert.equal(result.ok,false);
  assert.ok(result.errors.some(x=>x.includes('duplicate attended fight IDs')));
  assert.ok(result.errors.some(x=>x.includes('pullsAttended')));
  assert.ok(result.errors.some(x=>x.includes('duplicate survival opportunity')));
});

test('data integrity failure blocks publication even if component samples look complete',()=>{
  const rows=n=>Array.from({length:n},(_,i)=>({key:`x${i}`,fightId:i+1,actorId:1,success:true,severity:5,confidence:'confirmed',availability:'confirmed',assigned:true,observable:true,dangerWeight:1,importance:1,incidentPenalty:0}));
  const ledger={
    identity:{key:'wcl:1',status:'canonical',actorId:1,name:'P',className:'Mage',spec:'Frost',role:'DPS'},
    context:{nights:3},participation:{pullsAttended:40,fightIds:Array.from({length:40},(_,i)=>i+1)},
    mechanics:{opportunities:rows(30),unscoredFailures:[]},
    survival:{opportunities:rows(40)},defensives:{opportunities:rows(10),unscored:[]},duties:{opportunities:rows(10),unscored:[]},
    adaptation:{status:'pending'},validation:{ok:false,status:'data-error',errors:['synthetic invariant failure'],warnings:[]}
  };
  const [profile]=scoreReliabilityProfiles([ledger]);
  assert.equal(profile.status,'data-error');
  assert.equal(profile.value,null);
  assert.ok(profile.publication.reasons.some(x=>x.includes('data integrity')));
});

test('peer hierarchy prefers same-spec+role when the minimum peer sample exists',()=>{
  const target=minimalRaw({key:'target'});
  const peers=[1,2,3].map(i=>minimalRaw({key:`frost${i}`,name:`F${i}`,rate:.8+i*.02}));
  const classPeers=[1,2,3,4].map(i=>minimalRaw({key:`fire${i}`,name:`R${i}`,spec:'Fire',rate:.95}));
  const baseline=selectPeerBaseline([target,...peers,...classPeers],target,'mechanics');
  assert.equal(baseline.source,'same-spec-role');
  assert.equal(baseline.peerCount,3);
  assert.ok(baseline.successRate<.9);
});

test('intelligence engine exposes Reliability v1 shadow without claiming defensive or mechanic denominators',async()=>{
  const source=await read('server/engines/intelligence-engine.mjs');
  assert.match(source,/buildReliabilityEvidenceLedger/);
  assert.match(source,/scoreReliabilityProfiles/);
  assert.match(source,/status:'shadow'/);
  assert.match(source,/mechanicOpportunities:mechanicsRaw\?\.playerOpportunities\|\|\[\]/);
  assert.match(source,/defensiveOpportunities:telemetry\?\.reliabilityEvidence\?\.defensiveOpportunities\|\|\[\]/);
  assert.match(source,/DPS\/HPS\/parse are explicitly excluded from the Reliability formula/);
});

test('Reliability technical contracts explicitly separate parse and unknown availability',async()=>{
  const [contract,integrity,status]=await Promise.all([
    read('docs/RELIABILITY-CONTRACT-V1.md'),read('docs/RELIABILITY-DATA-INTEGRITY-V1.md'),read('docs/RELIABILITY-SHADOW-STATUS.md')
  ]);
  assert.match(contract,/DPS, HPS, WCL parse percentile.*do \*\*not\*\* enter the Reliability formula/s);
  assert.match(contract,/Unknown availability is never a missed defensive/);
  assert.match(integrity,/Parse separation invariant/);
  assert.match(status,/overall Reliability must remain null\/pending/);
});
