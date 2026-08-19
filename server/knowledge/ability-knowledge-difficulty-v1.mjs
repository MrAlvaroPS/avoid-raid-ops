import { createHash } from 'node:crypto';
import { buildAbilityKnowledgePreviewV1,resolveAbilityKnowledgeV1 } from './ability-knowledge-v1.mjs';
import { loadLatestOfficialEncounterGraphByWclIdV1 } from './official-encounter-store-v1.mjs';
import { loadLatestOfficialEncounterDifficultyViewV1 } from './official-encounter-difficulty-store-v1.mjs';
import { loadLatestSpellStructuralKnowledgeV1 } from './spell-structural-store-v1.mjs';
import { buildSpellStructuralDifficultyViewV1 } from './spell-structural-difficulty-v1.mjs';

export const ABILITY_KNOWLEDGE_DIFFICULTY_VERSION='ability-knowledge-difficulty-v1';
const positive=value=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};
const sha1=value=>createHash('sha1').update(JSON.stringify(value)).digest('hex');

export function normalizeDifficultyAwareAbilityKnowledgeRequestV1(input={}){
  const encounterId=positive(input.encounterId),difficulty=positive(input.difficulty);
  if(encounterId&&!difficulty)throw new Error('difficulty is required for encounter-scoped Ability Knowledge');
  return{...input,encounterId,difficulty,difficultyName:input.difficultyName?String(input.difficultyName):null};
}

export function buildDifficultyAwareAbilityKnowledgePreviewV1(input={}){
  const request=normalizeDifficultyAwareAbilityKnowledgeRequestV1(input),base=buildAbilityKnowledgePreviewV1(request);
  const fingerprint=sha1({version:ABILITY_KNOWLEDGE_DIFFICULTY_VERSION,baseFingerprint:base.fingerprint,encounterId:request.encounterId,difficulty:request.difficulty,difficultyName:request.difficultyName});
  return{
    ...base,version:'provider-aware-ability-knowledge-preview-difficulty-v1',fingerprint,
    request:{...base.request,difficulty:request.difficulty,difficultyName:request.difficultyName},
    storedKnowledge:{...base.storedKnowledge,officialDifficultyLookup:request.encounterId?'required-at-resolve-with-0-provider-calls':'not-applicable',structuralDifficultyInterpretation:request.encounterId?'required-at-resolve-with-0-provider-calls':'not-applicable'},
    safety:{...base.safety,crossDifficultyComparisonForbidden:true,crossDifficultyEmpiricalReuse:false},
  };
}

export async function resolveDifficultyAwareAbilityKnowledgeV1(input={},options={}){
  const request=normalizeDifficultyAwareAbilityKnowledgeRequestV1(input);
  if(!request.encounterId)return resolveAbilityKnowledgeV1(request,options);
  const storageGet=options.storageGet;
  const loadBaseOfficial=options.loadBaseOfficial||loadLatestOfficialEncounterGraphByWclIdV1;
  const loadDifficultyOfficial=options.loadDifficultyOfficial||loadLatestOfficialEncounterDifficultyViewV1;
  const loadStructural=options.loadStructural||loadLatestSpellStructuralKnowledgeV1;
  const baseOfficial=await loadBaseOfficial(request.encounterId,{...(storageGet?{storageGet}:{})}).catch(()=>null);
  if(!baseOfficial)throw new Error(`No persisted official encounter graph is available for WCL encounter ${request.encounterId}`);
  const journalEncounterId=positive(baseOfficial?.encounter?.journalEncounterId);
  const difficultyOfficial=journalEncounterId?await loadDifficultyOfficial(journalEncounterId,request.difficulty,{...(storageGet?{storageGet}:{})}).catch(()=>null):null;
  if(!difficultyOfficial)throw new Error(`No persisted official difficulty view is available for encounter ${request.encounterId} difficulty ${request.difficulty}`);
  if(Number(difficultyOfficial?.difficulty?.id)!==Number(request.difficulty))throw new Error('Cross-difficulty official Ability Knowledge view rejected');
  const structuralBase=await loadStructural(request.encounterId,{...(storageGet?{storageGet}:{})}).catch(()=>null);
  const structuralView=structuralBase?buildSpellStructuralDifficultyViewV1({structuralKnowledge:structuralBase,baseOfficialGraph:baseOfficial,difficultyOfficialView:difficultyOfficial}):null;
  const officialGraph={...difficultyOfficial,source:{...(baseOfficial.source||{}),difficultyView:{fingerprint:difficultyOfficial.fingerprint,wclDifficultyId:request.difficulty,db2DifficultyId:difficultyOfficial?.difficulty?.db2DifficultyId||null}}};
  const result=await resolveAbilityKnowledgeV1(request,{...options,officialGraph,structuralKnowledge:structuralView});
  return{
    ...result,
    difficulty:{id:request.difficulty,name:difficultyOfficial?.difficulty?.name||request.difficultyName||null,officialFingerprint:difficultyOfficial.fingerprint,structuralFingerprint:structuralView?.fingerprint||null},
    evidenceContract:{...(result.evidenceContract||{}),scopeIdentity:'encounter+difficulty',difficultyIsolation:true,crossDifficultyComparisonForbidden:true,crossDifficultyEmpiricalReuse:false},
  };
}
