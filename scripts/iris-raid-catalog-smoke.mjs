import { resolveRaidCatalogV1 } from '../server/knowledge/raid-catalog-v1.mjs';
import { persistRaidCatalogV1 } from '../server/knowledge/raid-catalog-store-v1.mjs';
import { ensureRaidOfficialKnowledgeV1 } from '../server/knowledge/raid-official-bootstrap-v1.mjs';

console.log('\n[1/3] Discover current raid from WCL WorldData metadata (no reports / no combat events)');
const resolved=await resolveRaidCatalogV1();
console.log(JSON.stringify({fingerprint:resolved.fingerprint,currentRaid:resolved.currentRaid?{zoneId:resolved.currentRaid.zoneId,name:resolved.currentRaid.name,frozen:resolved.currentRaid.frozen,expansion:resolved.currentRaid.expansion,defaultPartition:resolved.currentRaid.defaultPartition,bosses:resolved.currentRaid.encounters}:null,raidCandidates:resolved.zones.length,selection:resolved.selection,usage:resolved.usage},null,2));
if(!resolved.currentRaid?.encounters?.length)throw new Error('No current raid with journal-linked encounters was discovered');

console.log('\n[2/3] Persist raid catalog');
const catalog=await persistRaidCatalogV1(resolved);
console.log(JSON.stringify({latestKey:catalog.storage.latestKey,revisionKey:catalog.storage.revisionKey,changedFromPrevious:catalog.storage.changedFromPrevious,currentZoneId:catalog.currentZoneId},null,2));

console.log('\n[3/3] Bootstrap official Blizzard knowledge for every boss');
const official=await ensureRaidOfficialKnowledgeV1(catalog);
console.log(JSON.stringify({raid:official.raid,summary:official.summary,usage:official.usage,bosses:official.bosses.map(row=>({wclEncounterId:row.wclEncounterId,journalEncounterId:row.journalEncounterId,name:row.name,officialStatus:row.officialStatus,source:row.source,namespace:row.namespace,sectionCount:row.sectionCount,spellCount:row.spellCount,spellMembershipCount:row.spellMembershipCount,maxDepth:row.maxDepth,abilities:row.abilities.slice(0,12).map(ability=>({abilityId:ability.abilityId,name:ability.name,path:ability.memberships?.[0]?.path||[]}))}))},null,2));
if(official.summary.officialReady!==official.summary.bosses)throw new Error('Not every discovered raid boss has official Blizzard knowledge ready');
if(Number(official.usage.wclCombatEventCalls)!==0)throw new Error('Raid bootstrap must never request WCL combat events');
console.log('\nOK: current raid + boss Journal knowledge bootstrapped without any combat report.');
