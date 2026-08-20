import { resolveRaidCatalogV1 } from '../server/knowledge/raid-catalog-v1.mjs';
import { persistRaidCatalogV1 } from '../server/knowledge/raid-catalog-store-v1.mjs';
import { ensureRaidOfficialKnowledgeV1 } from '../server/knowledge/raid-official-bootstrap-v1.mjs';

const abilitySignature=d=>(d.abilities||[]).map(row=>Number(row.abilityId)).sort((a,b)=>a-b).join(',');

console.log('\n[1/4] Discover current official raid + WCL operational IDs (metadata only)');
const resolved=await resolveRaidCatalogV1();
console.log(JSON.stringify({fingerprint:resolved.fingerprint,currentRaid:resolved.currentRaid?{zoneId:resolved.currentRaid.zoneId,journalInstanceId:resolved.currentRaid.journalInstanceId,name:resolved.currentRaid.name,frozen:resolved.currentRaid.frozen,expansion:resolved.currentRaid.expansion,difficulties:resolved.currentRaid.difficulties,bosses:resolved.currentRaid.encounters.map(row=>({order:row.order,name:row.name,wclEncounterId:row.wclEncounterId,journalEncounterId:row.journalEncounterId,difficulties:row.difficulties.map(d=>({id:d.id,name:d.name,sizes:d.sizes,source:d.source}))}))}:null,raidCandidates:resolved.zones.length,selection:resolved.selection,officialRaidClassification:resolved.officialRaidClassification,diagnostics:resolved.diagnostics,usage:resolved.usage},null,2));
if(!resolved.currentRaid?.encounters?.length)throw new Error('No current official Blizzard raid could be cross-walked to WCL WorldData. Inspect diagnostics; no zone ID fallback is permitted.');
if(Number(resolved.usage.wclCombatEventCalls)!==0)throw new Error('Raid catalog must not request combat events');

console.log('\n[2/4] Verify every boss exposes independent WCL difficulty scopes');
const invalidScopes=resolved.currentRaid.encounters.filter(row=>!row.journalEncounterId||!(row.difficulties||[]).length);
console.log(JSON.stringify({bosses:resolved.currentRaid.encounters.length,bossesWithDifficultyScopes:resolved.currentRaid.encounters.length-invalidScopes.length,invalidScopes:invalidScopes.map(row=>({name:row.name,journalEncounterId:row.journalEncounterId,wclEncounterId:row.wclEncounterId}))},null,2));
if(invalidScopes.length)throw new Error('Every boss must expose at least one difficulty scope before Mechanics can render it');

console.log('\n[3/4] Persist raid catalog');
const catalog=await persistRaidCatalogV1(resolved);
console.log(JSON.stringify({latestKey:catalog.storage.latestKey,revisionKey:catalog.storage.revisionKey,changedFromPrevious:catalog.storage.changedFromPrevious,currentZoneId:catalog.currentZoneId},null,2));

console.log('\n[4/4] Bootstrap official Blizzard + DB2 difficulty knowledge for every boss');
const official=await ensureRaidOfficialKnowledgeV1(catalog);
const bossDiagnostics=official.bosses.map(row=>{
  const difficulties=row.difficulties.map(d=>({
    wclDifficultyId:d.id,name:d.name,db2DifficultyId:d.db2DifficultyId??d.applicability?.difficultyMapping?.db2DifficultyId??null,db2DifficultyName:d.applicability?.difficultyMapping?.db2DifficultyName??null,
    difficultyMappingStatus:d.mappingStatus??d.applicability?.difficultyMapping?.status,verified:d.applicability?.difficultyVerified===true,encounterStatus:d.applicability?.encounterStatus,
    restrictedBossSections:Number(d.applicability?.restrictedBossSections||0),explicitMemberships:Number(d.applicability?.explicitMemberships||0),sharedMemberships:Number(d.applicability?.sharedMemberships||0),excludedMemberships:Number(d.applicability?.excludedMemberships||0),unresolvedMemberships:Number(d.applicability?.unresolvedMemberships||0),
    sectionCount:d.sectionCount,spellCount:d.spellCount,spellMembershipCount:d.spellMembershipCount,abilitySignature:abilitySignature(d),
    sampleAbilities:d.abilities.slice(0,8).map(a=>({abilityId:a.abilityId,name:a.name,applicability:a.difficultyApplicability?.status,path:a.memberships?.[0]?.path||[]})),
  }));
  return{wclEncounterId:row.wclEncounterId,journalEncounterId:row.journalEncounterId,name:row.name,officialStatus:row.officialStatus,namespace:row.namespace,sameAbilitySetAcrossDifficulties:new Set(difficulties.map(d=>d.abilitySignature)).size<=1,difficulties};
});
console.log(JSON.stringify({raid:official.raid,difficultyApplicability:official.difficultyApplicability,summary:official.summary,usage:official.usage,bosses:bossDiagnostics},null,2));
if(official.summary.officialReady!==official.summary.bosses)throw new Error('Not every discovered raid boss has base official Blizzard knowledge ready');
if(official.bosses.some(row=>row.difficulties.length===0))throw new Error('Official bootstrap produced a boss without difficulty views');
const falselyVerified=bossDiagnostics.flatMap(b=>b.difficulties.map(d=>({boss:b.name,...d}))).filter(d=>d.verified&&(!d.db2DifficultyId||d.unresolvedMemberships>0));
if(falselyVerified.length)throw new Error(`Difficulty verification invariant failed: ${JSON.stringify(falselyVerified)}`);
if(Number(official.usage.wclCombatEventCalls)!==0)throw new Error('Raid bootstrap must never request WCL combat events');
console.log('\nOK: raid + bosses + independent difficulty knowledge bootstrapped without any combat report.');
