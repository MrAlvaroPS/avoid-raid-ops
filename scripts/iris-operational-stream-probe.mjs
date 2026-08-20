import { previewOperationalRehearsalV1 } from '../server/corpus/operational-readiness-v1.mjs';
import { loadOperationalEncounterModelV2 } from '../server/corpus/service-v2.mjs';
import { filtersForPack } from '../server/rule-packs/encounters/filters.mjs';
import { idsFilter } from '../server/wcl/queries/intelligence.mjs';
import { ENCOUNTER_META_QUERY } from '../server/wcl/queries/telemetry.mjs';
import { wclGraphql } from '../server/wcl/client/graphql-client.mjs';
import { selectEncounter } from '../server/wcl/normalization/fights.mjs';
import { paginatorEvents,eventAbilityId } from '../server/wcl/normalization/events.mjs';

const argv=process.argv.slice(2),value=flag=>{const i=argv.indexOf(flag);return i>=0?argv[i+1]:null;};
const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const encounterId=Number(value('--encounter')||0),difficultyRaw=String(value('--difficulty')||'').trim();
const difficulty=Number.isInteger(Number(difficultyRaw))&&Number(difficultyRaw)>0?Number(difficultyRaw):({lfr:1,normal:3,heroic:4,hc:4,mythic:5})[norm(difficultyRaw)]||null;
if(!encounterId||!difficulty)throw new Error('Usage: npm run validate:operational-streams -- --encounter <id> --difficulty <Normal|Heroic|Mythic> [--report <code>]');

const PROBE_QUERY=`
query AvoidOperationalStreamProbe($code:String!,$fightIDs:[Int]!,$damageFilter:String!,$castFilter:String!,$enemyBuffFilter:String!,$auraFilter:String!){
 reportData{report(code:$code,allowUnlisted:true){
  allDamage:events(dataType:DamageTaken,fightIDs:$fightIDs,hostilityType:Friendlies,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
  filteredDamage:events(dataType:DamageTaken,fightIDs:$fightIDs,hostilityType:Friendlies,filterExpression:$damageFilter,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
  allCasts:events(dataType:Casts,fightIDs:$fightIDs,hostilityType:Enemies,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
  filteredCasts:events(dataType:Casts,fightIDs:$fightIDs,hostilityType:Enemies,filterExpression:$castFilter,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
  allEnemyBuffs:events(dataType:Buffs,fightIDs:$fightIDs,hostilityType:Enemies,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
  filteredEnemyBuffs:events(dataType:Buffs,fightIDs:$fightIDs,hostilityType:Enemies,filterExpression:$enemyBuffFilter,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
  allDebuffs:events(dataType:Debuffs,fightIDs:$fightIDs,hostilityType:Friendlies,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
  allBuffs:events(dataType:Buffs,fightIDs:$fightIDs,hostilityType:Friendlies,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
  filteredDebuffs:events(dataType:Debuffs,fightIDs:$fightIDs,hostilityType:Friendlies,filterExpression:$auraFilter,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
  filteredBuffs:events(dataType:Buffs,fightIDs:$fightIDs,hostilityType:Friendlies,filterExpression:$auraFilter,limit:10000,useAbilityIDs:true,useActorIDs:true,translate:false){data nextPageTimestamp}
 }}
}`;

const operational=await loadOperationalEncounterModelV2({encounterId,difficulty,partition:0});
if(!operational?.pack)throw new Error('Operational Reference is not DATA READY');
const rehearsal=await previewOperationalRehearsalV1({encounterId,difficulty,reports:3});
const reportCode=String(value('--report')||rehearsal.selectedReports?.[0]||'').trim();
if(!reportCode)throw new Error('No canonical external report is available for the probe');
const filters=filtersForPack(operational.pack);

console.log('\nIRIS OPERATIONAL STREAM PROBE · bounded diagnostic · no learning/promotion');
const meta=await wclGraphql(ENCOUNTER_META_QUERY,{code:reportCode}),report=meta?.reportData?.report;
if(!report)throw new Error(`Report ${reportCode} was not resolved`);
const fights=selectEncounter(report.fights,encounterId,difficulty).filter(f=>!f.inProgress);
if(!fights.length)throw new Error(`Report ${reportCode} has no completed encounter ${encounterId} difficulty ${difficulty}`);
const fight=fights.at(-1),fightIDs=[Number(fight.id)];
const raw=await wclGraphql(PROBE_QUERY,{code:reportCode,fightIDs,damageFilter:idsFilter(filters.damage),castFilter:idsFilter(filters.casts),enemyBuffFilter:idsFilter(filters.enemyBuffs),auraFilter:idsFilter(filters.friendlyAuras)}),r=raw?.reportData?.report||{};

const rows=value=>paginatorEvents(value),idSet=values=>new Set((values||[]).map(Number).filter(Number.isFinite));
const match=(events,ids)=>{const wanted=idSet(ids);return events.filter(e=>wanted.has(Number(eventAbilityId(e))));};
const top=events=>{
  const counts=new Map();for(const e of events){const id=eventAbilityId(e);if(id==null)continue;counts.set(Number(id),(counts.get(Number(id))||0)+1);}
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20).map(([abilityId,count])=>({abilityId,count}));
};
const stream=(allValue,filteredValue,ids)=>{
  const all=rows(allValue),filtered=rows(filteredValue),clientMatched=match(all,ids);
  return{requestedIds:ids,allEvents:all.length,filteredEvents:filtered.length,clientMatchedEvents:clientMatched.length,filteredMatchesClient:Boolean(filtered.length===clientMatched.length),allTruncated:allValue?.nextPageTimestamp!=null,filteredTruncated:filteredValue?.nextPageTimestamp!=null,matchedAbilityIds:[...new Set(clientMatched.map(eventAbilityId).filter(Number.isFinite))].sort((a,b)=>a-b),topAbilities:top(all)};
};
const auraAll=[...rows(r.allDebuffs),...rows(r.allBuffs)],auraFiltered=[...rows(r.filteredDebuffs),...rows(r.filteredBuffs)];
const auraSynthetic={data:auraAll,nextPageTimestamp:r.allDebuffs?.nextPageTimestamp??r.allBuffs?.nextPageTimestamp??null},auraFilteredSynthetic={data:auraFiltered,nextPageTimestamp:r.filteredDebuffs?.nextPageTimestamp??r.filteredBuffs?.nextPageTimestamp??null};
const result={
  scope:{encounterId,difficulty,partition:operational.operationalReference?.scope?.partition||null},
  report:{code:reportCode,title:report.title||null},fight:{id:Number(fight.id),name:fight.name||null,difficulty:Number(fight.difficulty),kill:Boolean(fight.kill)},
  pack:{source:operational.source||operational.status||null,mechanics:Number(operational.pack.mechanics?.length||0),filters},
  streams:{damage:stream(r.allDamage,r.filteredDamage,filters.damage),casts:stream(r.allCasts,r.filteredCasts,filters.casts),enemyBuffs:stream(r.allEnemyBuffs,r.filteredEnemyBuffs,filters.enemyBuffs),friendlyAuras:stream(auraSynthetic,auraFilteredSynthetic,filters.friendlyAuras)},
  contract:{translateFalse:true,sameFightSameDifficulty:true,unfilteredComparisonIsDiagnosticOnly:true,reportSelectionUsesPerformance:false,doesNotPersistHome:true,doesNotTrain:true,doesNotPromote:true,wclCalls:2}
};
console.log(JSON.stringify(result,null,2));
const requested=[...filters.damage,...filters.casts,...filters.enemyBuffs,...filters.friendlyAuras].length,matched=Object.values(result.streams).reduce((n,row)=>n+Number(row.clientMatchedEvents||0),0);
console.log(`\nRESULT · requested IDs ${requested} · client-side matched events ${matched}`);
if(!matched)console.log('DIAGNOSIS · The selected canonical fight contains none of the operational pack IDs in the probed raw WCL streams. Inspect pack/corpus identity or choose another canonical report before changing the rule engine.');
else if(Object.values(result.streams).some(row=>row.clientMatchedEvents>0&&row.filteredEvents===0))console.log('DIAGNOSIS · Raw WCL contains pack IDs but filterExpression returned zero. The query/filter contract is the remaining mismatch.');
else console.log('DIAGNOSIS · WCL streams contain the requested IDs and filtered queries return them. If rehearsal still reports zero observed mechanics, inspect event normalization/rule-engine matching next.');
