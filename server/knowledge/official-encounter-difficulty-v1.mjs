import { createHash } from 'node:crypto';

export const OFFICIAL_ENCOUNTER_DIFFICULTY_VERSION='official-encounter-difficulty-v2';
const positive=value=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};
const sha1=value=>createHash('sha1').update(JSON.stringify(value)).digest('hex');
const canonicalName=value=>{const text=String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();if(/\b(?:raid finder|lfr)\b/.test(text))return'lfr';if(/\bmythic\b/.test(text))return'mythic';if(/\bheroic\b/.test(text))return'heroic';if(/\bnormal\b/.test(text))return'normal';return text;};

function sectionDifficultyMap(snapshot){const map=new Map();for(const row of snapshot?.sectionRows||[]){const sectionId=positive(row.journalSectionId),difficultyId=positive(row.difficultyId);if(!sectionId||!difficultyId)continue;if(!map.has(sectionId))map.set(sectionId,new Set());map.get(sectionId).add(difficultyId);}return map;}
function encounterDifficultySet(snapshot,journalEncounterId){const id=positive(journalEncounterId),set=new Set();for(const row of snapshot?.encounterRows||[])if(positive(row.journalEncounterId)===id&&positive(row.difficultyId))set.add(positive(row.difficultyId));return set;}
function resolveDb2Difficulty(snapshot,journalEncounterId,difficulty){
  if(!snapshot)return{status:'difficulty-metadata-unavailable',db2DifficultyId:null,db2DifficultyName:null,candidates:[]};
  const allowed=encounterDifficultySet(snapshot,journalEncounterId),wanted=canonicalName(difficulty?.name),rows=(snapshot.difficultyRows||[]).filter(row=>!allowed.size||allowed.has(positive(row.difficultyId))),matches=rows.filter(row=>canonicalName(row.name)===wanted);
  if(matches.length===1)return{status:'mapped-by-encounter-scoped-name',db2DifficultyId:positive(matches[0].difficultyId),db2DifficultyName:matches[0].name,candidates:matches.map(row=>({difficultyId:row.difficultyId,name:row.name}))};
  return{status:matches.length>1?'difficulty-mapping-ambiguous':'difficulty-mapping-unresolved',db2DifficultyId:null,db2DifficultyName:null,candidates:matches.map(row=>({difficultyId:row.difficultyId,name:row.name})),encounterDifficultyIds:[...allowed].sort((a,b)=>a-b)};
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
  const difficultyName=String(difficulty?.name||`Difficulty ${wclDifficultyId}`),mapping=resolveDb2Difficulty(journalDifficultySnapshot,officialGraph.encounter.journalEncounterId,{id:wclDifficultyId,name:difficultyName}),metadataAvailable=Boolean(journalDifficultySnapshot),metadataUsable=metadataAvailable&&Boolean(mapping.db2DifficultyId),map=sectionDifficultyMap(journalDifficultySnapshot),encounterSet=encounterDifficultySet(journalDifficultySnapshot,officialGraph.encounter.journalEncounterId),abilities=[];
  for(const ability of officialGraph.abilities||[]){
    const memberships=(ability.memberships||[]).map(membership=>({...membership,difficultyApplicability:membershipApplicability(membership,map,mapping.db2DifficultyId,metadataUsable)})).filter(row=>row.difficultyApplicability.applies);
    if(memberships.length){const statuses=new Set(memberships.map(row=>row.difficultyApplicability.status));abilities.push({...ability,memberships,difficultyApplicability:{status:statuses.has('explicitly-applicable')?'explicitly-applicable':statuses.has('difficulty-applicability-unresolved')?'difficulty-applicability-unresolved':'shared-no-explicit-section-restriction',wclDifficultyId,db2DifficultyId:mapping.db2DifficultyId}});}
  }
  const sectionIds=new Set(abilities.flatMap(ability=>ability.memberships.flatMap(membership=>(membership.sectionPath||[]).map(row=>positive(row.sectionId)).filter(Boolean)))),sections=(officialGraph.sections||[]).filter(row=>sectionIds.has(positive(row.sectionId)));
  const payload={
    version:OFFICIAL_ENCOUNTER_DIFFICULTY_VERSION,baseFingerprint:officialGraph.fingerprint,journalDifficultyFingerprint:journalDifficultySnapshot?.fingerprint||null,
    encounter:{...officialGraph.encounter},
    difficulty:{id:wclDifficultyId,name:difficultyName,namespace:'wcl',db2DifficultyId:mapping.db2DifficultyId,db2DifficultyName:mapping.db2DifficultyName,mappingStatus:mapping.status},
    applicability:{encounterStatus:!metadataAvailable?'difficulty-applicability-unresolved':metadataUsable?'difficulty-mapped':'difficulty-mapping-unresolved',encounterExplicitDb2DifficultyIds:[...encounterSet].sort((a,b)=>a-b),sectionDifficultyMetadataAvailable:metadataAvailable,difficultyMapping:mapping},
    abilities,sections,
    graph:{sectionCount:sections.length,spellCount:abilities.length,officialMembershipEdges:abilities.reduce((sum,row)=>sum+row.memberships.length,0),maxDepth:sections.reduce((max,row)=>Math.max(max,Number(row.depth)||0),0)},
    source:{official:officialGraph.source,structuralDifficultyProvider:journalDifficultySnapshot?{provider:'wago-db2',build:journalDifficultySnapshot.build,fingerprint:journalDifficultySnapshot.fingerprint}:null},
    evidenceContract:{difficultyScoped:true,wclAndDb2DifficultyIdsDistinct:true,difficultyApplicabilityMayBeUnresolved:!metadataUsable,crossDifficultyComparisonForbidden:true,crossDifficultyEmpiricalReuse:false,observedOccurrence:false,causalCombatEvidence:false,automaticPromotion:false},
  };
  return{...payload,fingerprint:sha1(payload)};
}
