import { readHomeRosterV1,refreshHomeRosterV1 } from '../server/engines/home-roster-engine.mjs';

const refresh=process.argv.includes('--refresh');
const result=refresh?await refreshHomeRosterV1({}):await readHomeRosterV1({});
const roster=result.roster||null,members=roster?.members||[],observed=members.filter(row=>row?.observed),raidParticipants=members.filter(row=>row?.raidActivity?.confirmedFromHomeLogs),directoryOnly=members.filter(row=>row?.directory&&!row?.observed&&!row?.raidActivity),classes=new Map();
for(const row of raidParticipants.length?raidParticipants:members)classes.set(row.className||`class-${row.classId||'?'}`,(classes.get(row.className||`class-${row.classId||'?'}`)||0)+1);
console.log(`\nHOME ROSTER · ${refresh?'GUILD DIRECTORY REFRESH':'PERSISTED READ'}`);
console.log(JSON.stringify({guild:roster?.guild||null,temporaryDirectory:roster?.temporary??true,directoryTotal:members.length,raidParticipants:raidParticipants.length,directoryOnly:directoryOnly.length,observedFromLogs:observed.length,raidRoster:roster?.raidRoster||null,classes:Object.fromEntries([...classes.entries()].sort()),fetchedAt:roster?.fetchedAt||null,updatedAt:roster?.updatedAt||null,fingerprint:roster?.fingerprint||null,networkExecuted:result.networkExecuted,wclMetadataCalls:result.wclMetadataCalls,wclCombatCalls:result.wclCombatCalls||0},null,2));
if(!refresh&&result.networkExecuted)throw new Error('Persisted HOME roster read must be zero-WCL');
if(refresh&&Number(result.wclCombatCalls)!==0)throw new Error('Guild directory refresh must not execute combat calls');
if(refresh&&!members.length)throw new Error('WCL guild directory refresh returned zero members');
console.log(refresh?'\nOK: guild directory refreshed. Raid allocation membership is still derived from HOME raid history, not Guild.members.':'\nOK: HOME roster read is zero-WCL; raidParticipants are the only persisted allocation candidates.');
