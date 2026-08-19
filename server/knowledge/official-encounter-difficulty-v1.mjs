import { createHash } from 'node:crypto';

export const OFFICIAL_ENCOUNTER_DIFFICULTY_VERSION='official-encounter-difficulty-v3';
const positive=value=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};
const sha1=value=>createHash('sha1').update(JSON.stringify(value)).digest('hex');
const normalizedName=value=>String(value||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const canonicalName=value=>{const text=normalizedName(value);if(text==='lfr'||text==='raid finder'||/\braid finder\b/.test(text))return'lfr';if(text==='mythic')return'mythic';if(text==='heroic')return'heroic';if(text==='normal')return'normal';return text;};

function sectionDifficultyMap(snapshot){const map=new Map();for(const row of snapshot?.sectionRows||[]){const sectionId=positive(row.journalSectionId),difficultyId=positive(row.difficultyId);if(!sectionId||!difficultyId)continue;if(!map.has(sectionId))map.set(sectionId,new Set());map.get(sectionId).add(difficultyId);}return map;}
function encounterDifficultySet(snapshot,journalEncounterId){const id=positive(journalEncounterId),set=new Set();for(const row of snapshot?.encounterRows||[])if(positive(row.journalEncounterId)===id&&positive(row.difficultyId))set.add(positive(row.difficultyId));return set;}
function bossSectionDifficultyIds(snapshot,officialGraph){const ids=new Set(),sections=new Set((officialGraph?.sections||[]).map(row=>positive(row.sectionId)).filter(Boolean));for(const row of snapshot?.sectionRows||[])if(sections.has(positive(row.journalSectionId))&&positive(row.difficultyId))ids.add(positive(row.difficultyId));return ids;}
function difficultySizes(difficulty){return[...new Set((difficulty?.sizes||[]).map(Number).filter(n=>Number.isInteger(n)&&n>0))];}
function candidateScore(row,{exactName,encounterRestrictions,sectionRestrictionIds,sizes}){
  const id=positive(row.difficultyId);let score=exactName?100:50;
  if(encounterRestrictions.has(id))score+=80;
  if(sectionRestrictionIds.has(id))score+=50;
  const min=positive(row.minPlayers),max=positive(row.maxPlayers);
  if(sizes.length&&min&&max){const overlaps=sizes.some(size=>size>=min&&size<=max);score+=overlaps?60:-80;if(min===max&&sizes.includes(min))score+=20;}
  if(sizes.some(size=>size>5)&&max){score+=max>5?25:-100;}
  return score;
}
function resolveDb2Difficulty(snapshot,journalEncounterId,difficulty,officialGraph){
  if(!snapshot)return{status:'difficulty-metadata-unavailable',db2DifficultyId:null,db2DifficultyName:null,candidates:[]};
  const wantedExact=normalizedName(difficulty?.name),wantedCanonical=canonicalName(difficulty?.name),all=(snapshot.difficultyRows||[]).filter(row=>positive(row.difficultyId)&&row.name);
  const exact=all.filter(row=>normalizedName(row.name)===wantedExact),pool=exact.length?exact:all.filter(row=>canonicalName(row.name)===wantedCanonical);
  const encounterRestrictions=encounterDifficultySet(snapshot,journalEncounterId),sectionRestrictionIds=bossSectionDifficultyIds(snapshot,officialGraph),sizes=difficultySizes(difficulty);
  if(!pool.length)return{status:'difficulty-mapping-unresolved',db2DifficultyId:null,db2DifficultyName:null,candidates:[],encounterRestrictionIds:[...encounterRestrictions].sort((a,b)=>a-b),sectionRestrictionIds:[...sectionRestrictionIds].sort((a,b)=>a-b)};
  const scored=pool.map(row=>({...row,score:candidateScore(row,{exactName:exact.includes(row),encounterRestrictions,sectionRestrictionIds,sizes})})).sort((a,b)=>b.score-a.score||Number(a.difficultyId)-Number(b.difficultyId));
  const best=scored[0],tied=scored.filter(row=>row.score===best.score);
  if(tied.length===1){
    const reason=encounterRestrictions.has(positive(best.difficultyId))?'mapped-by-journal-encounter-restriction':sectionRestrictionIds.has(positive(best.difficultyId))?'mapped-by-boss-section-restriction':sizes.length?'mapped-by-name-and-raid-size':'mapped-by-unique-name';
    return{status:reason,db2DifficultyId:positive(best.difficultyId),db2DifficultyName:best.name,candidates:scored.map(row=>({difficultyId:row.difficultyId,name:row.name,minPlayers:row.minPlayers??null,maxPlayers:row.maxPlayers??null,score:row.score})),encounterRestrictionIds:[...encounterRestrictions].sort((a,b)=>a-b),sectionRestrictionIds:[...sectionRestrictionIds].sort((a,b)=>a-b)};
  }
  return{status:'difficulty-mapping-ambiguous',db2DifficultyId:null,db2DifficultyName:null,candidates:scored.map(row=>({difficultyId:row.difficultyId,name:row.name,minPlayers:row.minPlayers??null,maxPlayers:row.maxPlayers??null,score:row.score})),encounterRestrictionIds:[...encounterRestrictions].sort((a,b)=>a-b),sectionRestrictionIds:[...sectionRestrictionIds].sort((a,b)=>a-b)};
}
function intersection(sets){if(!sets.length)return null;const out=new Set(sets[0]);for(const set of sets.slice(1))for(const value of [...out])if(!set.has(value))out.delete(value);return out;}
function membershipApplicability(membership,map,db2DifficultyId,metadataUsable){
  if(!metadataUsable||!db2DifficultyId)return{status:'difficulty-applicability-unresolved',applies:true,explicitDb2DifficultyIds:[]};
  const restrictions=(membership?.sectionPath||[]).map(row=>map.get(positive(row.sectionId))).filter(Boolean);
  if(!restrictions.length)return{status:'shared-no-explicit-section-restriction',applies:true,explicitDb2DifficultyIds:[]};
  const allowed=intersection(restrictions)||new Set();return{status:allowed.has(db2DifficultyId)?'explicitly-applicable':'explicitly-not-applicable',applies:allowed.has(db2DifficultyId),explicitDb2DifficultyIds:[...allowed].sort((a,b)=>a-b)};
}

export function compileOfficialEncounterDifficultyViewV1({officialGraph,difficulty,journalDifficultySnapshot=null}={}){
  if(!officialGraph?.encounter?.journalEncounterId)throw new Error('official encounter graph is required');
  const wclDifficultyId=positive(difficulty?.id??difficulty);if(!wclDifficultyId)throw new Error('difficulty id is required');
  const difficultyName=String(difficulty?.name||`Difficulty ${wclDifficultyId}`),mapping=resolveDb2Difficulty(journalDifficultySnapshot,officialGraph.encounter.journalEncounterId,{...difficulty,id:wclDifficultyId,name:difficultyName},officialGraph),metadataAvailable=Boolean(journalDifficultySnapshot),metadataUsable=metadataAvailable&&Boolean(mapping.db2DifficultyId),map=sectionDifficultyMap(journalDifficultySnapshot),encounterRestrictions=encounterDifficultySet(journalDifficultySnapshot,officialGraph.encounter.journalEncounterId);
  const encounterStatus=!metadataAvailable?'difficulty-applicability-unresolved':!metadataUsable?'difficulty-mapping-unresolved':!encounterRestrictions.size?'shared-no-explicit-encounter-restriction':encounterRestrictions.has(mapping.db2DifficultyId)?'explicitly-applicable':'explicitly-not-applicable';
  const encounterApplies=encounterStatus!=='explicitly-not-applicable',abilities=[];let excludedMemberships=0,explicitMemberships=0,sharedMemberships=0,unresolvedMemberships=0;
  if(encounterApplies){
    for(const ability of officialGraph.abilities||[]){
      const resolved=(ability.memberships||[]).map(membership=>({...membership,difficultyApplicability:membershipApplicability(membership,map,mapping.db2DifficultyId,metadataUsable)}));
      for(const row of resolved){const status=row.difficultyApplicability.status;if(status==='explicitly-not-applicable')excludedMemberships++;else if(status==='explicitly-applicable')explicitMemberships++;else if(status==='shared-no-explicit-section-restriction')sharedMemberships++;else unresolvedMemberships++;}
      const memberships=resolved.filter(row=>row.difficultyApplicability.applies);
      if(memberships.length){const statuses=new Set(memberships.map(row=>row.difficultyApplicability.status));abilities.push({...ability,memberships,difficultyApplicability:{status:statuses.has('explicitly-applicable')?'explicitly-applicable':statuses.has('difficulty-applicability-unresolved')?'difficulty-applicability-unresolved':'shared-no-explicit-section-restriction',wclDifficultyId,db2DifficultyId:mapping.db2DifficultyId}});}
    }
  }
  const sectionIds=new Set(abilities.flatMap(ability=>ability.memberships.flatMap(membership=>(membership.sectionPath||[]).map(row=>positive(row.sectionId)).filter(Boolean)))),sections=(officialGraph.sections||[]).filter(row=>sectionIds.has(positive(row.sectionId)));
  const restrictedBossSections=[...new Set((journalDifficultySnapshot?.sectionRows||[]).filter(row=>(officialGraph.sections||[]).some(section=>positive(section.sectionId)===positive(row.journalSectionId))).map(row=>positive(row.journalSectionId)).filter(Boolean))];
  const payload={
    version:OFFICIAL_ENCOUNTER_DIFFICULTY_VERSION,baseFingerprint:officialGraph.fingerprint,journalDifficultyFingerprint:journalDifficultySnapshot?.fingerprint||null,
    encounter:{...officialGraph.encounter},
    difficulty:{id:wclDifficultyId,name:difficultyName,namespace:'wcl',sizes:difficultySizes(difficulty),db2DifficultyId:mapping.db2DifficultyId,db2DifficultyName:mapping.db2DifficultyName,mappingStatus:mapping.status},
    applicability:{encounterStatus,encounterRestrictionDb2DifficultyIds:[...encounterRestrictions].sort((a,b)=>a-b),sectionDifficultyMetadataAvailable:metadataAvailable,difficultyMapping:mapping,difficultyIdentityResolved:metadataUsable,difficultyVerified:metadataUsable,restrictedBossSections:restrictedBossSections.length,explicitMemberships,sharedMemberships,excludedMemberships,unresolvedMemberships},
    abilities,sections,
    graph:{sectionCount:sections.length,spellCount:abilities.length,officialMembershipEdges:abilities.reduce((sum,row)=>sum+row.memberships.length,0),maxDepth:sections.reduce((max,row)=>Math.max(max,Number(row.depth)||0),0)},
    source:{official:officialGraph.source,structuralDifficultyProvider:journalDifficultySnapshot?{provider:'wago-db2',build:journalDifficultySnapshot.build,fingerprint:journalDifficultySnapshot.fingerprint}:null},
    evidenceContract:{difficultyScoped:true,wclAndDb2DifficultyIdsDistinct:true,journalDifficultyRowsAreApplicabilityRestrictions:true,difficultyApplicabilityMayBeUnresolved:!metadataUsable,crossDifficultyComparisonForbidden:true,crossDifficultyEmpiricalReuse:false,observedOccurrence:false,causalCombatEvidence:false,automaticPromotion:false},
  };
  return{...payload,fingerprint:sha1(payload)};
}
