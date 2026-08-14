const positiveId=value=>{const n=Number(value);return Number.isFinite(n)&&n>0?n:null};
const searchUrl=query=>`https://www.wowhead.com/search?q=${encodeURIComponent(String(query||''))}`;

export function wowheadItemRef(id,{itemLevel=null,gems=[],enchants=[]}={}){
  const itemId=positiveId(id);if(!itemId)return null;
  const parts=[`item=${itemId}`];
  if(Number.isFinite(Number(itemLevel)))parts.push(`ilvl=${Number(itemLevel)}`);
  if(Array.isArray(gems)&&gems.length)parts.push(`gems=${gems.map(Number).filter(Number.isFinite).join(':')}`);
  if(Array.isArray(enchants)&&enchants.length&&Number.isFinite(Number(enchants[0])))parts.push(`ench=${Number(enchants[0])}`);
  return {type:'item',id:itemId,mode:'exact',url:`https://www.wowhead.com/item=${itemId}`,dataWowhead:parts.join('&')};
}

export function wowheadSpellRef(id){
  const spellId=positiveId(id);if(!spellId)return null;
  return {type:'spell',id:spellId,mode:'exact',url:`https://www.wowhead.com/spell=${spellId}`,dataWowhead:`spell=${spellId}`};
}

export function wowheadTalentRef({spellId=null,nodeId=null,entryId=null,name=null}={}){
  const exact=wowheadSpellRef(spellId);if(exact)return exact;
  const query=name || (nodeId!=null?`talent node ${nodeId}`:entryId!=null?`talent entry ${entryId}`:'World of Warcraft talent');
  return {type:'talent-search',id:positiveId(nodeId)??positiveId(entryId),mode:'search',url:searchUrl(query),dataWowhead:null};
}

export function wowheadEncounterSearchRef(name){
  if(!name)return null;
  return {type:'encounter-search',id:null,mode:'search',url:searchUrl(name),dataWowhead:null};
}
