import { createHash } from 'node:crypto';

export const SPELL_STRUCTURAL_DIFFICULTY_VERSION='spell-structural-difficulty-v1';
const positive=value=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const digest=value=>createHash('sha1').update(JSON.stringify(stable(value))).digest('hex');
const relationKey=row=>[row?.sourceAbilityId||'',row?.relationKind||'',row?.targetAbilityId||'',row?.providerRowId??''].join('|');

function reachableRelations(relations,seedIds){
  const adjacency=new Map();
  for(const row of relations){const a=positive(row.sourceAbilityId),b=positive(row.targetAbilityId);if(!a||!b)continue;if(!adjacency.has(a))adjacency.set(a,new Set());if(!adjacency.has(b))adjacency.set(b,new Set());adjacency.get(a).add(b);adjacency.get(b).add(a);}
  const reached=new Set(seedIds),queue=[...seedIds];
  while(queue.length){const id=queue.shift();for(const next of adjacency.get(id)||[])if(!reached.has(next)){reached.add(next);queue.push(next);}}
  return{reached,relations:relations.filter(row=>reached.has(positive(row.sourceAbilityId))&&reached.has(positive(row.targetAbilityId)))};
}

export function buildSpellStructuralDifficultyViewV1({structuralKnowledge,baseOfficialGraph,difficultyOfficialView}={}){
  if(!structuralKnowledge)return null;
  if(!difficultyOfficialView?.difficulty?.id)throw new Error('difficulty-scoped official view is required for structural difficulty interpretation');
  const allOfficial=new Set((baseOfficialGraph?.abilities||[]).map(row=>positive(row.abilityId)).filter(Boolean));
  const allowedOfficial=new Set((difficultyOfficialView?.abilities||[]).map(row=>positive(row.abilityId)).filter(Boolean));
  const excludedOfficial=new Set([...allOfficial].filter(id=>!allowedOfficial.has(id)));
  const safeRelations=(structuralKnowledge.relations||[]).filter(row=>{
    const source=positive(row.sourceAbilityId),target=positive(row.targetAbilityId);
    return source&&target&&!excludedOfficial.has(source)&&!excludedOfficial.has(target);
  });
  const connected=allowedOfficial.size?reachableRelations(safeRelations,allowedOfficial):{reached:new Set(),relations:[]};
  const relations=connected.relations.slice().sort((a,b)=>Number(a.sourceAbilityId)-Number(b.sourceAbilityId)||Number(a.targetAbilityId)-Number(b.targetAbilityId)||String(a.relationKind||'').localeCompare(String(b.relationKind||'')));
  const seedAbilityIds=[...new Set((structuralKnowledge.seedAbilityIds||[]).map(positive).filter(id=>id&&connected.reached.has(id)))].sort((a,b)=>a-b);
  const payload={
    version:SPELL_STRUCTURAL_DIFFICULTY_VERSION,
    scope:{wclEncounterId:positive(structuralKnowledge?.scope?.wclEncounterId??structuralKnowledge?.scope?.encounterId),difficulty:Number(difficultyOfficialView.difficulty.id),difficultyName:difficultyOfficialView.difficulty.name||null},
    provider:structuralKnowledge.provider||null,
    baseStructuralFingerprint:structuralKnowledge.fingerprint||null,
    officialDifficultyFingerprint:difficultyOfficialView.fingerprint||null,
    difficultyApplicabilityVerified:difficultyOfficialView?.applicability?.sectionDifficultyMetadataAvailable===true&&Boolean(difficultyOfficialView?.difficulty?.db2DifficultyId),
    seedAbilityIds,
    relations,
    summary:{relations:relations.length,baseRelations:Number(structuralKnowledge?.relations?.length||0),allowedOfficialAbilities:allowedOfficial.size,excludedOtherDifficultyOfficialAbilities:excludedOfficial.size,reachableAbilities:connected.reached.size},
    coverage:structuralKnowledge.coverage||null,
    evidenceContract:{difficultyScopedInterpretation:true,baseStructuralMetadataSharedAcrossDifficulties:true,otherDifficultyOfficialAbilitiesExcluded:true,internalHelpersMayRemainWhenConnectedToSelectedDifficulty:true,observedCombat:false,causalCombatEvidence:false,crossDifficultyEmpiricalReuse:false,automaticPromotion:false},
  };
  return{...payload,fingerprint:digest({...payload,relations:relations.map(relationKey)})};
}
