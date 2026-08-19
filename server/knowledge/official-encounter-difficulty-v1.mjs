import { createHash } from 'node:crypto';

export const OFFICIAL_ENCOUNTER_DIFFICULTY_VERSION='official-encounter-difficulty-v1';
const positive=value=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};
const sha1=value=>createHash('sha1').update(JSON.stringify(value)).digest('hex');

function sectionDifficultyMap(snapshot){
  const map=new Map();
  for(const row of snapshot?.sectionRows||[]){const sectionId=positive(row.journalSectionId),difficultyId=positive(row.difficultyId);if(!sectionId||!difficultyId)continue;if(!map.has(sectionId))map.set(sectionId,new Set());map.get(sectionId).add(difficultyId);}
  return map;
}
function encounterDifficultySet(snapshot,journalEncounterId){
  const id=positive(journalEncounterId),set=new Set();
  for(const row of snapshot?.encounterRows||[])if(positive(row.journalEncounterId)===id&&positive(row.difficultyId))set.add(positive(row.difficultyId));
  return set;
}
function intersection(sets){if(!sets.length)return null;const out=new Set(sets[0]);for(const set of sets.slice(1))for(const value of [...out])if(!set.has(value))out.delete(value);return out;}
function membershipApplicability(membership,map,difficultyId){
  const restrictions=(membership?.sectionPath||[]).map(row=>map.get(positive(row.sectionId))).filter(Boolean);
  if(!restrictions.length)return{status:'shared-no-explicit-section-restriction',applies:true,explicitDifficultyIds:[]};
  const allowed=intersection(restrictions)||new Set();
  return{status:allowed.has(difficultyId)?'explicitly-applicable':'explicitly-not-applicable',applies:allowed.has(difficultyId),explicitDifficultyIds:[...allowed].sort((a,b)=>a-b)};
}

export function compileOfficialEncounterDifficultyViewV1({officialGraph,difficulty,journalDifficultySnapshot=null}={}){
  if(!officialGraph?.encounter?.journalEncounterId)throw new Error('official encounter graph is required');
  const difficultyId=positive(difficulty?.id??difficulty);if(!difficultyId)throw new Error('difficulty id is required');
  const difficultyName=String(difficulty?.name||`Difficulty ${difficultyId}`);
  const map=sectionDifficultyMap(journalDifficultySnapshot),encounterSet=encounterDifficultySet(journalDifficultySnapshot,officialGraph.encounter.journalEncounterId);
  const encounterExplicit=encounterSet.size>0;
  const encounterApplies=!encounterExplicit||encounterSet.has(difficultyId);
  const abilities=[];
  if(encounterApplies){
    for(const ability of officialGraph.abilities||[]){
      const memberships=(ability.memberships||[]).map(membership=>({...membership,difficultyApplicability:membershipApplicability(membership,map,difficultyId)})).filter(row=>row.difficultyApplicability.applies);
      if(memberships.length)abilities.push({...ability,memberships,difficultyApplicability:{status:memberships.some(row=>row.difficultyApplicability.status==='explicitly-applicable')?'explicitly-applicable':'shared-no-explicit-section-restriction',difficultyId}});
    }
  }
  const sectionIds=new Set(abilities.flatMap(ability=>ability.memberships.flatMap(membership=>(membership.sectionPath||[]).map(row=>positive(row.sectionId)).filter(Boolean))));
  const sections=(officialGraph.sections||[]).filter(row=>sectionIds.has(positive(row.sectionId)));
  const payload={
    version:OFFICIAL_ENCOUNTER_DIFFICULTY_VERSION,
    baseFingerprint:officialGraph.fingerprint,
    journalDifficultyFingerprint:journalDifficultySnapshot?.fingerprint||null,
    encounter:{...officialGraph.encounter},difficulty:{id:difficultyId,name:difficultyName},
    applicability:{
      encounterStatus:encounterExplicit?(encounterApplies?'explicitly-applicable':'explicitly-not-applicable'):'no-explicit-encounter-restriction',
      encounterExplicitDifficultyIds:[...encounterSet].sort((a,b)=>a-b),
      sectionDifficultyMetadataAvailable:Boolean(journalDifficultySnapshot),
    },
    abilities,sections,
    graph:{sectionCount:sections.length,spellCount:abilities.length,officialMembershipEdges:abilities.reduce((sum,row)=>sum+row.memberships.length,0),maxDepth:sections.reduce((max,row)=>Math.max(max,Number(row.depth)||0),0)},
    source:{official:officialGraph.source,structuralDifficultyProvider:journalDifficultySnapshot?{provider:'wago-db2',build:journalDifficultySnapshot.build,fingerprint:journalDifficultySnapshot.fingerprint}:null},
    evidenceContract:{difficultyScoped:true,crossDifficultyComparisonForbidden:true,crossDifficultyEmpiricalReuse:false,observedOccurrence:false,causalCombatEvidence:false,automaticPromotion:false},
  };
  return{...payload,fingerprint:sha1(payload)};
}
