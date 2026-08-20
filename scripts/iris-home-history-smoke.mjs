import process from 'node:process';
import { getPersistedAvoidHistoryIndexV1,getPersistedAvoidHistoryScopeV1 } from '../server/engines/home-history-read-v1.mjs';
import { refreshPersistedAvoidHistoryV1 } from '../server/engines/home-history-refresh-v1.mjs';

const args=process.argv.slice(2),refresh=args.includes('--refresh');
const value=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:null;};
const encounterId=Number(value('--encounter')||0),difficulty=Number(value('--difficulty')||0);

console.log('AvoiD HOME HISTORY · v1');
console.log('');
console.log('PHASE 1 · persisted read only');
let index=await getPersistedAvoidHistoryIndexV1();
console.log(`Status               : ${index.status}`);
console.log(`Raid                 : ${index.zone?.name||'—'}${index.zone?.id?` · zone ${index.zone.id}`:''}`);
console.log(`Reports              : ${index.reportCount||0}`);
console.log(`Historical pulls     : ${index.pullCount||0}`);
console.log(`WCL calls            : ${index.wclCallsExecuted}`);
console.log(`Network executed     : ${index.networkExecuted}`);
if(index.wclCallsExecuted!==0||index.networkExecuted!==false)throw new Error('Persisted HOME history read unexpectedly executed WCL network');

if(refresh){
  console.log('');console.log('PHASE 2 · explicit incremental WCL refresh');
  const result=await refreshPersistedAvoidHistoryV1();
  console.log(`Status               : ${result.status}`);
  console.log(`Listed reports       : ${result.refresh?.listedReports||0}`);
  console.log(`Changed reports      : ${result.refresh?.changedReports||0}`);
  console.log(`Updated reports      : ${result.refresh?.updatedReports||0}`);
  console.log(`Remaining changed    : ${result.refresh?.remainingChangedReports||0}`);
  console.log(`WCL metadata calls   : ${result.wclCallsExecuted||0}`);
  console.log(`WCL combat calls     : ${result.wclCombatEventCalls||0}`);
  if(Number(result.wclCombatEventCalls)!==0)throw new Error('HOME history refresh must remain metadata/fight-index only');
  index=await getPersistedAvoidHistoryIndexV1();
  if(index.wclCallsExecuted!==0)throw new Error('Post-refresh reload must execute zero WCL calls');
}

if(encounterId>0||difficulty>0){
  if(!(encounterId>0&&difficulty>0))throw new Error('--encounter and --difficulty must be supplied together');
  console.log('');console.log(`PHASE ${refresh?3:2} · persisted scope ${encounterId}:d${difficulty}`);
  const scope=await getPersistedAvoidHistoryScopeV1({encounterId,difficulty});
  console.log(`Boss                 : ${scope.encounter?.name||'—'}`);
  console.log(`Difficulty           : ${scope.encounter?.difficultyName||'—'}`);
  console.log(`Progression pulls    : ${scope.progressionPulls?.length||0}`);
  console.log(`Raid nights          : ${scope.nights?.length||0}`);
  console.log(`WCL calls            : ${scope.wclCallsExecuted}`);
  if(scope.wclCallsExecuted!==0||scope.networkExecuted!==false)throw new Error('Persisted HOME scope read unexpectedly executed WCL network');
}

console.log('');console.log('OK: HOME history smoke completed. Reads are zero-WCL; refresh is explicit.');
