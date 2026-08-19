export const LOOT_ELIGIBILITY_VERSION='loot-eligibility-v1';

const norm=value=>String(value||'').trim().toLowerCase();
const cls=value=>norm(value).replaceAll(' ','');
const ALL=new Set(['deathknight','demonhunter','druid','evoker','hunter','mage','monk','paladin','priest','rogue','shaman','warlock','warrior']);
const ARMOR={plate:new Set(['deathknight','paladin','warrior']),mail:new Set(['evoker','hunter','shaman']),leather:new Set(['demonhunter','druid','monk','rogue']),cloth:new Set(['mage','priest','warlock'])};
const SHIELD=new Set(['paladin','shaman','warrior']);
const OFFHAND=new Set(['druid','evoker','mage','priest','shaman','warlock']);
const WEAPONS={
  'axe':new Set(['deathknight','hunter','paladin','rogue','shaman','warrior']),
  'axes':new Set(['deathknight','hunter','paladin','rogue','shaman','warrior']),
  'two-handed axes':new Set(['deathknight','hunter','paladin','shaman','warrior']),
  'mace':new Set(['deathknight','druid','monk','paladin','priest','shaman','warrior']),
  'maces':new Set(['deathknight','druid','monk','paladin','priest','shaman','warrior']),
  'two-handed maces':new Set(['deathknight','druid','paladin','shaman','warrior']),
  'sword':new Set(['deathknight','demonhunter','hunter','mage','monk','paladin','rogue','warlock','warrior']),
  'swords':new Set(['deathknight','demonhunter','hunter','mage','monk','paladin','rogue','warlock','warrior']),
  'two-handed swords':new Set(['deathknight','hunter','paladin','warrior']),
  'dagger':new Set(['demonhunter','druid','hunter','mage','priest','rogue','shaman','warlock','warrior']),
  'daggers':new Set(['demonhunter','druid','hunter','mage','priest','rogue','shaman','warlock','warrior']),
  'fist weapons':new Set(['demonhunter','druid','hunter','monk','rogue','shaman','warrior']),
  'polearms':new Set(['deathknight','druid','hunter','monk','paladin','warrior']),
  'staves':new Set(['druid','evoker','hunter','mage','monk','priest','shaman','warlock','warrior']),
  'bows':new Set(['hunter']),
  'guns':new Set(['hunter']),
  'crossbows':new Set(['hunter']),
  'warglaives':new Set(['demonhunter']),
  'wands':new Set(['mage','priest','warlock']),
};

const SLOT_MAP={HEAD:['head'],NECK:['neck'],SHOULDER:['shoulder'],CLOAK:['back'],CHEST:['chest'],ROBE:['chest'],WAIST:['waist'],LEGS:['legs'],FEET:['feet'],WRIST:['wrist'],HAND:['hands'],FINGER:['finger1','finger2'],TRINKET:['trinket1','trinket2'],SHIELD:['off_hand'],HOLDABLE:['off_hand'],WEAPON:['main_hand','off_hand'],WEAPONMAINHAND:['main_hand'],WEAPONOFFHAND:['off_hand'],TWOHWEAPON:['main_hand'],TWO_H_WEAPON:['main_hand'],RANGED:['main_hand'],RANGEDRIGHT:['main_hand']};

export function simcSlotsForItemV1(item={}){const type=String(item?.inventoryType?.type||'').replaceAll('-','_').replaceAll(' ','_').toUpperCase();return SLOT_MAP[type]||[];}

export function evaluateLootEligibilityV1(item,player={}){
  const classKey=cls(player.className||player.class||player.type),classKnown=ALL.has(classKey),itemClass=norm(item?.itemClass?.name),sub=norm(item?.itemSubclass?.name),inv=String(item?.inventoryType?.type||'').toUpperCase(),slots=simcSlotsForItemV1(item);
  if(!classKnown)return{version:LOOT_ELIGIBILITY_VERSION,eligible:false,status:'unknown-class',reason:'Player class is not resolved',slots:[]};
  if(!slots.length)return{version:LOOT_ELIGIBILITY_VERSION,eligible:false,status:'non-equippable-or-unsupported-slot',reason:`Unsupported inventory type ${item?.inventoryType?.type||'unknown'}`,slots:[]};
  if(itemClass.includes('armor')){
    if(inv==='SHIELD'||sub==='shields'){const ok=SHIELD.has(classKey);return{version:LOOT_ELIGIBILITY_VERSION,eligible:ok,status:ok?'eligible':'class-cannot-use-shield',reason:ok?'Shield proficiency':'Class cannot equip shields',slots};}
    if(inv==='HOLDABLE'){const ok=OFFHAND.has(classKey);return{version:LOOT_ELIGIBILITY_VERSION,eligible:ok,status:ok?'eligible':'class-cannot-use-offhand',reason:ok?'Off-hand proficiency':'Class cannot equip caster off-hands',slots};}
    for(const [armor,set] of Object.entries(ARMOR))if(sub.includes(armor)){const ok=set.has(classKey);return{version:LOOT_ELIGIBILITY_VERSION,eligible:ok,status:ok?'eligible':'wrong-armor-specialization',reason:ok?`${armor} armor specialization`:`${player.className||'Class'} is not an intended ${armor} wearer`,slots};}
    return{version:LOOT_ELIGIBILITY_VERSION,eligible:true,status:'eligible-universal-armor-slot',reason:'Universal jewelry/back/trinket armor-class item',slots};
  }
  if(itemClass.includes('weapon')){
    const key=Object.keys(WEAPONS).find(name=>sub===name||sub.includes(name));const set=key?WEAPONS[key]:null;if(!set)return{version:LOOT_ELIGIBILITY_VERSION,eligible:false,status:'weapon-proficiency-unresolved',reason:`Weapon subclass ${item?.itemSubclass?.name||'unknown'} is not mapped yet`,slots};const ok=set.has(classKey);return{version:LOOT_ELIGIBILITY_VERSION,eligible:ok,status:ok?'eligible':'class-cannot-use-weapon',reason:ok?`${item.itemSubclass.name} proficiency`:`${player.className||'Class'} cannot equip ${item.itemSubclass.name}`,slots};
  }
  return{version:LOOT_ELIGIBILITY_VERSION,eligible:true,status:'eligible-generic',reason:'Equippable item; final validation delegated to SimulationCraft',slots};
}

export function filterEligibleRaidersV1(item,players=[]){return(players||[]).map(player=>({player,eligibility:evaluateLootEligibilityV1(item,player)})).filter(row=>row.eligibility.eligible);}
