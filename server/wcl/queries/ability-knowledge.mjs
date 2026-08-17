export const WCL_ABILITY_KNOWLEDGE_QUERY_VERSION='wcl-ability-knowledge-query-v1';

const ids=value=>[...new Set((value||[]).map(Number).filter(id=>Number.isInteger(id)&&id>0))].slice(0,20);

export function buildWclAbilityKnowledgeQuery(abilityIds,{encounterId=null}={}){
  const normalized=ids(abilityIds);
  if(!normalized.length)throw new Error('At least one valid ability id is required');
  const fields=normalized.map(id=>`a${id}:ability(id:${id}){id name icon}`).join('\n      ');
  const encounter=Number.isInteger(Number(encounterId))&&Number(encounterId)>0;
  return `query AbilityKnowledgeV1{\n  gameData{\n      ${fields}\n  }${encounter?`\n  worldData{encounter(id:${Number(encounterId)}){id name journalID}}`:''}\n  rateLimitData{limitPerHour pointsSpentThisHour pointsResetIn}\n}`;
}

export function normalizeWclAbilityKnowledge(data,abilityIds,{encounterId=null}={}){
  const normalized=ids(abilityIds);
  const abilities=new Map();
  for(const id of normalized){
    const row=data?.gameData?.[`a${id}`];
    if(row)abilities.set(id,{id:Number(row.id??id),name:row.name||null,icon:row.icon||null});
  }
  const encounter=data?.worldData?.encounter||null;
  return {
    provider:'warcraftlogs',abilities,encounter:encounter?{id:Number(encounter.id??encounterId),name:encounter.name||null,journalID:Number(encounter.journalID)||null}:null,
    rateLimit:data?.rateLimitData||null,
  };
}
