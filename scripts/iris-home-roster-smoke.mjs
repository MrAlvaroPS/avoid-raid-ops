import { readHomeRosterV1,refreshHomeRosterV1 } from '../server/engines/home-roster-engine.mjs';

const refresh=process.argv.includes('--refresh');
const result=refresh?await refreshHomeRosterV1({}):await readHomeRosterV1({});
const roster=result.roster||null,members=roster?.members||[],observed=members.filter(row=>row?.observed),directoryOnly=members.filter(row=>row?.directory&&!row?.observed),classes=new Map();
for(const row of members)classes.set(row.className||`class-${row.classId||'?'}`,(classes.get(row.className||`class-${row.classId||'?'}`)||0)+1);
console.log(`\nHOME ROSTER · ${refresh?'REFRESH':'PERSISTED READ'}`);
console.log(JSON.stringify({guild:roster?.guild||null,temporary:roster?.temporary??true,total:members.length,directoryOnly:directoryOnly.length,observedFromLogs:observed.length,classes:Object.fromEntries([...classes.entries()].sort()),fetchedAt:roster?.fetchedAt||null,updatedAt:roster?.updatedAt||null,fingerprint:roster?.fingerprint||null,networkExecuted:result.networkExecuted,wclMetadataCalls:result.wclMetadataCalls,wclCombatCalls:result.wclCombatCalls||0},null,2));
if(!refresh&&result.networkExecuted)throw new Error('Persisted HOME roster read must be zero-WCL');
if(refresh&&Number(result.wclCombatCalls)!==0)throw new Error('Guild roster refresh must not execute combat calls');
if(refresh&&!members.length)throw new Error('WCL guild roster refresh returned zero members');
console.log(refresh?'\nOK: temporary WCL guild roster persisted.':'\nOK: HOME roster read path is persisted/zero-WCL.');
