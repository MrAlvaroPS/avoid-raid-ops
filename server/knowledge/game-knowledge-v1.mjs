import { createHash } from 'node:crypto';
import { listEncounterRulePacks } from '../rule-packs/encounters/registry.mjs';

export const KNOWLEDGE_MODEL_VERSION='game-knowledge-v1';
export const ENTITY_TYPES=Object.freeze(['encounter','phase','boss-ability','player-ability','aura','talent','state','npc']);

export const wowheadSpellRef=id=>Number.isFinite(Number(id))&&Number(id)>0?{
  provider:'wowhead-reference',
  kind:'spell',
  id:Number(id),
  url:`https://www.wowhead.com/spell=${Number(id)}`,
}:null;

const uniq=values=>[...new Set((values||[]).map(Number).filter(Number.isFinite))];
const entityKey=(type,id)=>`${type}:${String(id)}`;

function packEntities(pack){
  const out=[];
  out.push({
    key:entityKey('encounter',pack.id),type:'encounter',id:Number(pack.id),name:pack.name,
    difficulty:Number(pack.difficulty)||null,source:{kind:'raidops-rule-pack',version:pack.version||null},
    phaseModel:pack.phaseModel||null,
  });
  for(const [semanticId,label] of Object.entries(pack.phaseModel?.labels||{})){
    out.push({key:entityKey('phase',`${pack.id}:${semanticId}`),type:'phase',id:`${pack.id}:${semanticId}`,encounterId:Number(pack.id),semanticId:Number(semanticId),name:label,source:{kind:'raidops-rule-pack',version:pack.version||null}});
  }
  for(const mechanic of pack.mechanics||[]){
    const ids=uniq([
      ...(mechanic.castIds||[]),...(mechanic.opportunityCastIds||[]),...(mechanic.damageIds||[]),
      ...(mechanic.failureDamageIds||[]),...(mechanic.auraIds||[]),...(mechanic.failureAuraIds||[]),...(mechanic.relatedIds||[]),
    ]);
    for(const id of ids){
      out.push({
        key:entityKey('boss-ability',id),type:'boss-ability',id,name:mechanic.name,encounterId:Number(pack.id),
        mechanicKey:mechanic.key,category:mechanic.category||null,stage:mechanic.stage||null,
        source:{kind:'raidops-rule-pack',version:pack.version||null},references:[wowheadSpellRef(id)].filter(Boolean),
      });
    }
  }
  for(const aura of Object.values(pack.auras||{}))for(const id of uniq(aura.ids)){
    out.push({key:entityKey('aura',id),type:'aura',id,name:aura.name,encounterId:Number(pack.id),state:aura.color||null,source:{kind:'raidops-rule-pack',version:pack.version||null},references:[wowheadSpellRef(id)].filter(Boolean)});
  }
  return out;
}

export function buildBundledKnowledge({patch='unknown',season='unknown',build='unknown'}={}){
  const entities=[];
  for(const pack of listEncounterRulePacks())entities.push(...packEntities(pack));
  const byKey=new Map();
  for(const entity of entities)if(entity?.key)byKey.set(entity.key,entity);
  const normalized=[...byKey.values()].sort((a,b)=>a.key.localeCompare(b.key));
  const fingerprint=createHash('sha256').update(JSON.stringify(normalized)).digest('hex').slice(0,16);
  const revision=`retail:${season}:${patch}:${build}:${fingerprint}`;
  return {
    modelVersion:KNOWLEDGE_MODEL_VERSION,
    revision,
    generatedAt:Date.now(),
    game:'wow-retail',patch:String(patch),season:String(season),build:String(build),
    entities:normalized,
    counts:Object.fromEntries(ENTITY_TYPES.map(type=>[type,normalized.filter(entity=>entity.type===type).length])),
    providers:[
      {id:'raidops-rule-pack',role:'semantic-seed',status:'ready'},
      {id:'wcl-observed',role:'canonical-combat-identifiers',status:'planned-ingestion'},
      {id:'wowhead-reference',role:'reference-links-and-tooltips',status:'ready-no-general-api-assumed'},
      {id:'blizzard-game-data',role:'versioned-game-metadata',status:'provider-contract-ready'},
    ],
    evidenceContract:{
      rawCombat:'WCL remains source of truth',
      wowhead:'reference/enrichment only; never silently treated as canonical combat evidence',
      activation:'changes derived interpretations, never immutable raw WCL facts',
    },
  };
}

export function summarizeKnowledge(snapshot){
  if(!snapshot)return null;
  return {modelVersion:snapshot.modelVersion,revision:snapshot.revision,generatedAt:snapshot.generatedAt,game:snapshot.game,patch:snapshot.patch,season:snapshot.season,build:snapshot.build,counts:snapshot.counts,providers:snapshot.providers,evidenceContract:snapshot.evidenceContract};
}
