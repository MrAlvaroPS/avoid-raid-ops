import { unwrap } from './primitives.mjs';
import { eventSourceId } from './events.mjs';
import { wowheadItemRef,wowheadTalentRef } from '../../enrichment/wowhead.mjs';

const firstFinite=(...vals)=>{for(const v of vals){if(v===null||v===undefined||v==='')continue;const n=Number(v);if(Number.isFinite(n))return n}return null};
const firstString=(...vals)=>vals.find(v=>typeof v==='string'&&v.trim())||null;
const cleanTalentName=(...vals)=>{for(const v of vals){if(typeof v!=='string')continue;const s=v.trim();if(!s)continue;if(/^(?:spell\s+(?:null|undefined)|null|undefined|node\s+\d+|entry\s+\d+)$/i.test(s))continue;return s;}return null;};

// WCL CombatantInfo gear is normally in Blizzard inventory order. Keep the
// positional fallback explicit so the UI never has to show opaque "Slot 7".
export const INVENTORY_SLOT_NAMES={
  1:'Head',2:'Neck',3:'Shoulders',4:'Shirt',5:'Chest',6:'Waist',7:'Legs',8:'Feet',9:'Wrists',10:'Hands',
  11:'Ring 1',12:'Ring 2',13:'Trinket 1',14:'Trinket 2',15:'Back',16:'Main Hand',17:'Off Hand',18:'Ranged / Legacy'
};
const NON_POWER_SLOTS=new Set(['Shirt','Tabard','Ranged / Legacy']);

function normalizeGearItem(item,index){
  if(!item||typeof item!=='object') return null;
  const id=firstFinite(item.id,item.itemID,item.itemId,item.gameID,item.guid);
  // Empty Blizzard inventory entries are represented by id 0. They are not gear
  // and must not lower any derived average or claim that the profile has 18 items.
  if(id!=null&&id<=0&&!firstString(item.name,item.itemName,item.displayName))return null;
  const itemLevel=firstFinite(item.itemLevel,item.item_level,item.ilvl,item.level);
  const explicitSlot=firstString(item.slot,item.slotName,item.inventoryType);
  const slotId=firstFinite(item.slotID,item.slotId,item.inventorySlot,index+1);
  const slot=explicitSlot || INVENTORY_SLOT_NAMES[slotId] || `Inventory ${slotId??index+1}`;
  const name=firstString(item.name,item.itemName,item.displayName);
  const icon=firstString(item.icon,item.itemIcon);
  const quality=firstFinite(item.quality,item.qualityID);
  const gems=Array.isArray(item.gems)?item.gems.map(g=>typeof g==='object'?firstFinite(g.id,g.itemID,g.gameID):firstFinite(g)).filter(x=>x!=null&&x>0):[];
  const enchants=[item.permanentEnchant,item.temporaryEnchant,item.enchant,item.enchantID,item.enchantId]
    .flat().filter(x=>x!=null).map(x=>typeof x==='object'?firstFinite(x.id,x.gameID):firstFinite(x)).filter(x=>x!=null&&x>0);
  if((id==null||id<=0)&&itemLevel==null&&!name)return null;
  const wowhead=wowheadItemRef(id,{itemLevel,gems,enchants});
  return {id:id!=null&&id>0?id:null,name,icon,slot,slotId,itemLevel,quality,gems,enchants,wowhead,countsTowardGearLevel:!NON_POWER_SLOTS.has(slot)};
}

function normalizeTalent(t,index){
  if(Array.isArray(t)){
    const entryId=firstFinite(t[0]),nodeId=firstFinite(t[1]),rank=firstFinite(t[2]);
    const base={entryId,nodeId,spellId:null,rank,name:null,icon:null,index};
    return {...base,wowhead:wowheadTalentRef(base)};
  }
  if(!t||typeof t!=='object')return null;
  const entryId=firstFinite(t.entry,t.entryID,t.entryId,t.traitDefinitionID,t.traitDefinitionId,t.id);
  const nodeId=firstFinite(t.node_id,t.nodeID,t.nodeId,t.node);
  const spellId=firstFinite(t.spellID,t.spellId,t.spell?.id,t.spell?.gameID,t.abilityID,t.abilityId);
  const rank=firstFinite(t.rank,t.points,t.value,t.ranks);
  const name=cleanTalentName(t.name,t.spellName,t.label,t.spell?.name);
  const icon=firstString(t.icon,t.spell?.icon);
  const base={entryId,nodeId,spellId,rank,name,icon,index};
  return {...base,wowhead:wowheadTalentRef(base)};
}

function candidateTalentArrays(node,out=[]){
  if(!node||typeof node!=='object')return out;
  if(Array.isArray(node)){for(const x of node)candidateTalentArrays(x,out);return out;}
  for(const [key,val] of Object.entries(node)){
    const k=key.toLowerCase();
    if(Array.isArray(val)&&(k==='talenttree'||k==='talent_tree'||k==='talents'||k==='traits'||k==='traittree'))out.push(val);
    else candidateTalentArrays(val,out);
  }
  return out;
}
function candidateGearArrays(node,out=[]){
  if(!node||typeof node!=='object')return out;
  if(Array.isArray(node)){for(const x of node)candidateGearArrays(x,out);return out;}
  for(const [key,val] of Object.entries(node)){
    const k=key.toLowerCase();
    if(Array.isArray(val)&&(k==='gear'||k==='equipment'||k==='items'))out.push(val);
    else candidateGearArrays(val,out);
  }
  return out;
}

const talentKey=t=>t.nodeId!=null?`node:${t.nodeId}`:t.entryId!=null?`entry:${t.entryId}`:t.spellId!=null?`spell:${t.spellId}`:`idx:${t.index}`;
const gearKey=g=>g.slotId!=null?`slot:${g.slotId}`:g.slot?`slot:${g.slot}`:g.id!=null?`item:${g.id}`:Math.random().toString(36);

function mergeTalent(a,b){
  const base=a||{}; const incoming=b||{};
  const merged={...base,...Object.fromEntries(Object.entries(incoming).filter(([,v])=>v!==null&&v!==undefined&&v!==''))};
  merged.wowhead=wowheadTalentRef(merged);
  return merged;
}
function mergeGear(a,b){
  const base=a||{}; const incoming=b||{};
  const merged={...base,...Object.fromEntries(Object.entries(incoming).filter(([,v])=>v!==null&&v!==undefined&&v!==''))};
  if(Array.isArray(base.gems)||Array.isArray(incoming.gems))merged.gems=[...new Set([...(base.gems||[]),...(incoming.gems||[])])];
  if(Array.isArray(base.enchants)||Array.isArray(incoming.enchants))merged.enchants=[...new Set([...(base.enchants||[]),...(incoming.enchants||[])])];
  merged.wowhead=wowheadItemRef(merged.id,{itemLevel:merged.itemLevel,gems:merged.gems||[],enchants:merged.enchants||[]});
  return merged;
}
function fnv1a(value){let h=0x811c9dc5;for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,0x01000193)>>>0;}return h.toString(16).padStart(8,'0');}
function buildFingerprint(talents=[]){
  const canonical=talents.filter(t=>(Number(t.rank)||0)>0).map(t=>`${t.nodeId??'n'}:${t.entryId??t.spellId??'e'}:${t.rank??1}`).sort().join('|');
  return canonical?`build-${fnv1a(canonical)}`:null;
}

function profileFromNode(node,actorIdHint=null){
  if(!node||typeof node!=='object')return null;
  const actorId=firstFinite(actorIdHint,node.sourceID,node.actorID,node.actorId,node.playerID,node.playerId);
  const gearArrays=candidateGearArrays(node,[]).sort((a,b)=>b.length-a.length);
  const talentArrays=candidateTalentArrays(node,[]).sort((a,b)=>b.length-a.length);
  const gear=(gearArrays[0]||[]).map(normalizeGearItem).filter(Boolean);
  const talents=(talentArrays[0]||[]).map(normalizeTalent).filter(Boolean).filter(t=>(t.rank==null||Number(t.rank)>0)&&(t.entryId!=null||t.nodeId!=null||t.spellId!=null||t.name));
  if(actorId==null&&!gear.length&&!talents.length)return null;
  const powerIlvls=gear.filter(g=>g.countsTowardGearLevel&&Number.isFinite(Number(g.itemLevel))).map(g=>Number(g.itemLevel));
  return {
    actorId,gear,gearCount:gear.length,powerGearCount:gear.filter(g=>g.countsTowardGearLevel).length,
    recordedItemLevelMean:powerIlvls.length?powerIlvls.reduce((a,b)=>a+b,0)/powerIlvls.length:null,
    // Kept only for compatibility with old adapters. Do not present it as character ilvl.
    gearAverageItemLevel:null,
    talents,talentCount:talents.length,talentPoints:talents.reduce((s,t)=>s+(Number(t.rank)||0),0),
    buildFingerprint:buildFingerprint(talents),source:'WCL CombatantInfo/playerDetails'
  };
}

function walkIdentityProfiles(node,out=[]){
  if(!node||typeof node!=='object')return out;
  if(Array.isArray(node)){for(const x of node)walkIdentityProfiles(x,out);return out;}
  const p=profileFromNode(node,null);
  if(p&&p.actorId!=null&&(p.gearCount||p.talentCount))out.push(p);
  for(const v of Object.values(node))walkIdentityProfiles(v,out);
  return out;
}

function mergeProfile(map,p){
  if(!p||p.actorId==null)return;
  const key=Number(p.actorId),prev=map.get(key);
  if(!prev){map.set(key,p);return;}
  const gearMap=new Map((prev.gear||[]).map(g=>[gearKey(g),g]));
  for(const g of p.gear||[]){const k=gearKey(g);gearMap.set(k,mergeGear(gearMap.get(k),g));}
  const talentMap=new Map((prev.talents||[]).map(t=>[talentKey(t),t]));
  for(const t of p.talents||[]){const k=talentKey(t);talentMap.set(k,mergeTalent(talentMap.get(k),t));}
  const gear=[...gearMap.values()].sort((a,b)=>(Number(a.slotId)||999)-(Number(b.slotId)||999));
  const talents=[...talentMap.values()].filter(t=>t.rank==null||Number(t.rank)>0).sort((a,b)=>(Number(a.nodeId)||999999)-(Number(b.nodeId)||999999));
  const powerIlvls=gear.filter(g=>g.countsTowardGearLevel&&Number.isFinite(Number(g.itemLevel))).map(g=>Number(g.itemLevel));
  map.set(key,{...prev,...p,gear,gearCount:gear.length,powerGearCount:gear.filter(g=>g.countsTowardGearLevel).length,recordedItemLevelMean:powerIlvls.length?powerIlvls.reduce((a,b)=>a+b,0)/powerIlvls.length:null,gearAverageItemLevel:null,talents,talentCount:talents.length,talentPoints:talents.reduce((s,t)=>s+(Number(t.rank)||0),0),buildFingerprint:buildFingerprint(talents),source:'WCL CombatantInfo + playerDetails merged'});
}

export function combatantProfiles({combatantEvents=[],playerDetails=null}={}){
  const map=new Map();
  for(const e of combatantEvents||[])mergeProfile(map,profileFromNode(e,eventSourceId(e)));
  const root=unwrap(playerDetails);
  for(const p of walkIdentityProfiles(root,[]))mergeProfile(map,p);
  return map;
}
export function profileCoverage(profiles,rosterIds=[]){
  const ids=(rosterIds||[]).map(Number).filter(Number.isFinite);
  const withGear=ids.filter(id=>(profiles.get(id)?.gearCount||0)>0).length;
  const withTalents=ids.filter(id=>(profiles.get(id)?.talentCount||0)>0||Boolean(profiles.get(id)?.talentImportCode)).length;
  return {roster:ids.length,withGear,withTalents,gearPct:ids.length?Math.round(100*withGear/ids.length):0,talentPct:ids.length?Math.round(100*withTalents/ids.length):0};
}
