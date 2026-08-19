export const LOOT_ELIGIBILITY_VERSION='loot-eligibility-v1.1';

const norm=value=>String(value||'').trim().toLowerCase().replace(/[–—]/g,'-').replace(/\s+/g,' ');
const cls=value=>norm(value).replaceAll(' ','');
const ALL=new Set(['deathknight','demonhunter','druid','evoker','hunter','mage','monk','paladin','priest','rogue','shaman','warlock','warrior']);
const ARMOR={plate:new Set(['deathknight','paladin','warrior']),mail:new Set(['evoker','hunter','shaman']),leather:new Set(['demonhunter','druid','monk','rogue']),cloth:new Set(['mage','priest','warlock'])};
const SHIELD=new Set(['paladin','shaman','warrior']);
const OFFHAND=new Set(['druid','evoker','mage','priest','shaman','warlock']);

// Blizzard item subclass names are presentation strings and have varied between
// singular/plural forms. Resolve them exactly into a canonical proficiency key;
// never use substring matching because e.g. "two-handed swords" must not be
// classified as the broader one-handed "sword" proficiency.
const WEAPON_ALIAS=new Map(Object.entries({
  'axe':'axe','axes':'axe','one-handed axe':'axe','one-handed axes':'axe',
  'two-handed axe':'two-handed axe','two-handed axes':'two-handed axe',
  'mace':'mace','maces':'mace','one-handed mace':'mace','one-handed maces':'mace',
  'two-handed mace':'two-handed mace','two-handed maces':'two-handed mace',
  'sword':'sword','swords':'sword','one-handed sword':'sword','one-handed swords':'sword',
  'two-handed sword':'two-handed sword','two-handed swords':'two-handed sword',
  'dagger':'dagger','daggers':'dagger',
  'fist weapon':'fist weapon','fist weapons':'fist weapon',
  'polearm':'polearm','polearms':'polearm',
  'staff':'staff','staves':'staff',
  'bow':'bow','bows':'bow',
  'gun':'gun','guns':'gun',
  'crossbow':'crossbow','crossbows':'crossbow',
  'warglaive':'warglaive','warglaives':'warglaive',
  'wand':'wand','wands':'wand',
}));
const WEAPONS={
  'axe':new Set(['deathknight','hunter','paladin','rogue','shaman','warrior']),
  'two-handed axe':new Set(['deathknight','hunter','paladin','shaman','warrior']),
  'mace':new Set(['deathknight','druid','monk','paladin','priest','shaman','warrior']),
  'two-handed mace':new Set(['deathknight','druid','paladin','shaman','warrior']),
  'sword':new Set(['deathknight','demonhunter','hunter','mage','monk','paladin','rogue','warlock','warrior']),
  'two-handed sword':new Set(['deathknight','hunter','paladin','warrior']),
  'dagger':new Set(['demonhunter','druid','hunter','mage','priest','rogue','shaman','warlock','warrior']),
  'fist weapon':new Set(['demonhunter','druid','hunter','monk','rogue','shaman','warrior']),
  'polearm':new Set(['deathknight','druid','hunter','monk','paladin','warrior']),
  'staff':new Set(['druid','evoker','hunter','mage','monk','priest','shaman','warlock','warrior']),
  'bow':new Set(['hunter']),
  'gun':new Set(['hunter']),
  'crossbow':new Set(['hunter']),
  'warglaive':new Set(['demonhunter']),
  'wand':new Set(['mage','priest','warlock']),
};

const SLOT_MAP={HEAD:['head'],NECK:['neck'],SHOULDER:['shoulder'],CLOAK:['back'],CHEST:['chest'],ROBE:['chest'],WAIST:['waist'],LEGS:['legs'],FEET:['feet'],WRIST:['wrist'],HAND:['hands'],FINGER:['finger1','finger2'],TRINKET:['trinket1','trinket2'],SHIELD:['off_hand'],HOLDABLE:['off_hand'],WEAPON:['main_hand','off_hand'],WEAPONMAINHAND:['main_hand'],WEAPONOFFHAND:['off_hand'],TWOHWEAPON:['main_hand'],TWO_H_WEAPON:['main_hand'],RANGED:['main_hand'],RANGEDRIGHT:['main_hand']};

export function simcSlotsForItemV1(item={}){const type=String(item?.inventoryType?.type||'').replaceAll('-','_').replaceAll(' ','_').toUpperCase();return SLOT_MAP[type]||[];}
export function canonicalWeaponSubclassV1(value){return WEAPON_ALIAS.get(norm(value))||null;}

export function evaluateLootEligibilityV1(item,player={}){
  const classKey=cls(player.className||player.class||player.type),classKnown=ALL.has(classKey),itemClass=norm(item?.itemClass?.name),sub=norm(item?.itemSubclass?.name),inv=String(item?.inventoryType?.type||'').toUpperCase(),slots=simcSlotsForItemV1(item);
  if(!classKnown)return{version:LOOT_ELIGIBILITY_VERSION,eligible:false,status:'unknown-class',reason:`Player class is not resolved (${player.className||player.class||player.type||'unknown'})`,slots:[]};
  if(!slots.length)return{version:LOOT_ELIGIBILITY_VERSION,eligible:false,status:'non-equippable-or-unsupported-slot',reason:`Unsupported inventory type ${item?.inventoryType?.type||'unknown'}`,slots:[]};
  if(itemClass.includes('armor')){
    if(inv==='SHIELD'||sub==='shields'||sub==='shield'){const ok=SHIELD.has(classKey);return{version:LOOT_ELIGIBILITY_VERSION,eligible:ok,status:ok?'eligible':'class-cannot-use-shield',reason:ok?'Shield proficiency':'Class cannot equip shields',slots};}
    if(inv==='HOLDABLE'){const ok=OFFHAND.has(classKey);return{version:LOOT_ELIGIBILITY_VERSION,eligible:ok,status:ok?'eligible':'class-cannot-use-offhand',reason:ok?'Off-hand proficiency':'Class cannot equip caster off-hands',slots};}
    for(const [armor,set] of Object.entries(ARMOR))if(sub.includes(armor)){const ok=set.has(classKey);return{version:LOOT_ELIGIBILITY_VERSION,eligible:ok,status:ok?'eligible':'wrong-armor-specialization',reason:ok?`${armor} armor specialization`:`${player.className||'Class'} is not an intended ${armor} wearer`,slots};}
    return{version:LOOT_ELIGIBILITY_VERSION,eligible:true,status:'eligible-universal-armor-slot',reason:'Universal jewelry/back/trinket armor-class item',slots};
  }
  if(itemClass.includes('weapon')){
    const key=canonicalWeaponSubclassV1(sub),set=key?WEAPONS[key]:null;
    if(!set)return{version:LOOT_ELIGIBILITY_VERSION,eligible:false,status:'weapon-proficiency-unresolved',reason:`Weapon subclass ${item?.itemSubclass?.name||'unknown'} is not mapped yet`,slots};
    const ok=set.has(classKey);return{version:LOOT_ELIGIBILITY_VERSION,eligible:ok,status:ok?'eligible':'class-cannot-use-weapon',reason:ok?`${item.itemSubclass.name} proficiency`:`${player.className||'Class'} cannot equip ${item.itemSubclass.name}`,slots};
  }
  return{version:LOOT_ELIGIBILITY_VERSION,eligible:true,status:'eligible-generic',reason:'Equippable item; final validation delegated to SimulationCraft',slots};
}

export function filterEligibleRaidersV1(item,players=[]){return(players||[]).map(player=>({player,eligibility:evaluateLootEligibilityV1(item,player)})).filter(row=>row.eligibility.eligible);}
