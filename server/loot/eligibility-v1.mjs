export const LOOT_ELIGIBILITY_VERSION='loot-eligibility-v1.2';

const norm=value=>String(value||'').trim().toLowerCase().replace(/[–—]/g,'-').replace(/\s+/g,' ');
const cls=value=>norm(value).replaceAll(' ','');
const specToken=value=>norm(value).replace(/[^a-z0-9]+/g,'');
const ALL=new Set(['deathknight','demonhunter','druid','evoker','hunter','mage','monk','paladin','priest','rogue','shaman','warlock','warrior']);
const ARMOR={plate:new Set(['deathknight','paladin','warrior']),mail:new Set(['evoker','hunter','shaman']),leather:new Set(['demonhunter','druid','monk','rogue']),cloth:new Set(['mage','priest','warlock'])};
const SHIELD=new Set(['paladin','shaman','warrior']);
const OFFHAND=new Set(['druid','evoker','mage','priest','shaman','warlock']);

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
const RANGED_HUNTER_WEAPONS=new Set(['bow','gun','crossbow']);

const SPEC_PRIMARY=new Map(Object.entries({
  'deathknight:blood':'STRENGTH','deathknight:frost':'STRENGTH','deathknight:unholy':'STRENGTH',
  'demonhunter:havoc':'AGILITY','demonhunter:vengeance':'AGILITY',
  'druid:balance':'INTELLECT','druid:feral':'AGILITY','druid:guardian':'AGILITY','druid:restoration':'INTELLECT',
  'evoker:devastation':'INTELLECT','evoker:preservation':'INTELLECT','evoker:augmentation':'INTELLECT',
  'hunter:beastmastery':'AGILITY','hunter:marksmanship':'AGILITY','hunter:survival':'AGILITY',
  'mage:arcane':'INTELLECT','mage:fire':'INTELLECT','mage:frost':'INTELLECT',
  'monk:brewmaster':'AGILITY','monk:mistweaver':'INTELLECT','monk:windwalker':'AGILITY',
  'paladin:holy':'INTELLECT','paladin:protection':'STRENGTH','paladin:retribution':'STRENGTH',
  'priest:discipline':'INTELLECT','priest:holy':'INTELLECT','priest:shadow':'INTELLECT',
  'rogue:assassination':'AGILITY','rogue:outlaw':'AGILITY','rogue:subtlety':'AGILITY',
  'shaman:elemental':'INTELLECT','shaman:enhancement':'AGILITY','shaman:restoration':'INTELLECT',
  'warlock:affliction':'INTELLECT','warlock:demonology':'INTELLECT','warlock:destruction':'INTELLECT',
  'warrior:arms':'STRENGTH','warrior:fury':'STRENGTH','warrior:protection':'STRENGTH',
}));

const SLOT_MAP={HEAD:['head'],NECK:['neck'],SHOULDER:['shoulder'],CLOAK:['back'],CHEST:['chest'],ROBE:['chest'],WAIST:['waist'],LEGS:['legs'],FEET:['feet'],WRIST:['wrist'],HAND:['hands'],FINGER:['finger1','finger2'],TRINKET:['trinket1','trinket2'],SHIELD:['off_hand'],HOLDABLE:['off_hand'],WEAPON:['main_hand','off_hand'],WEAPONMAINHAND:['main_hand'],WEAPONOFFHAND:['off_hand'],TWOHWEAPON:['main_hand'],TWO_H_WEAPON:['main_hand'],RANGED:['main_hand'],RANGEDRIGHT:['main_hand']};

export function simcSlotsForItemV1(item={}){const type=String(item?.inventoryType?.type||'').replaceAll('-','_').replaceAll(' ','_').toUpperCase();return SLOT_MAP[type]||[];}
export function canonicalWeaponSubclassV1(value){return WEAPON_ALIAS.get(norm(value))||null;}
function itemPrimaryStats(item={}){const direct=Array.isArray(item?.primaryStats)?item.primaryStats:[];const fromStats=(item?.stats||[]).map(row=>row?.type);return[...new Set([...direct,...fromStats].map(x=>String(x||'').toUpperCase()).filter(x=>['STRENGTH','AGILITY','INTELLECT'].includes(x)))];}

function specCompatibility(item,player,physical){
  if(!physical.eligible)return{specCompatible:false,specCompatibility:'not-applicable',specReason:'Physical equipment eligibility failed',specPrimaryStat:null};
  const classKey=cls(player.className||player.class||player.type),spec=specToken(player.spec),key=spec?`${classKey}:${spec}`:null,expected=key?SPEC_PRIMARY.get(key)||null:null;
  if(!spec)return{specCompatible:null,specCompatibility:'unresolved',specReason:'Active specialization is not resolved yet',specPrimaryStat:null};
  const itemClass=norm(item?.itemClass?.name),weaponKey=itemClass.includes('weapon')?canonicalWeaponSubclassV1(item?.itemSubclass?.name):null;
  if(classKey==='hunter'&&(spec==='beastmastery'||spec==='marksmanship')&&itemClass.includes('weapon')&&!RANGED_HUNTER_WEAPONS.has(weaponKey))return{specCompatible:false,specCompatibility:'incompatible',specReason:`${player.spec} requires a ranged Hunter weapon for raid DPS`,specPrimaryStat:expected};
  if(classKey==='hunter'&&spec==='survival'&&itemClass.includes('weapon')&&RANGED_HUNTER_WEAPONS.has(weaponKey))return{specCompatible:false,specCompatibility:'incompatible',specReason:'Survival is a melee specialization; ranged Hunter weapons are not a raid-loot fit',specPrimaryStat:expected};
  const primaries=itemPrimaryStats(item);
  if(expected&&primaries.length&&!primaries.includes(expected))return{specCompatible:false,specCompatibility:'incompatible',specReason:`Item primary stat (${primaries.join('/')}) does not match ${player.spec} (${expected})`,specPrimaryStat:expected};
  if(!expected)return{specCompatible:null,specCompatibility:'unresolved',specReason:`No high-confidence primary-stat rule is registered for ${player.className||'class'} ${player.spec}`,specPrimaryStat:null};
  return{specCompatible:true,specCompatibility:'compatible',specReason:primaries.length?`${player.spec} primary stat ${expected} matches the item`:`${player.spec} is resolved and no high-confidence item/spec contradiction is present; SimulationCraft remains final validation`,specPrimaryStat:expected};
}
function finalize(item,player,physical){
  const spec=specCompatibility(item,player,physical),allocationEligible=physical.eligible&&spec.specCompatible!==false,simEligible=allocationEligible;
  return{...physical,physicalEligible:physical.eligible,...spec,allocationEligible,simEligible,candidateStatus:!physical.eligible?'physical-ineligible':spec.specCompatible===false?'spec-incompatible':spec.specCompatible===true?'spec-compatible':'spec-unresolved'};
}

export function evaluateLootEligibilityV1(item,player={}){
  const classKey=cls(player.className||player.class||player.type),classKnown=ALL.has(classKey),itemClass=norm(item?.itemClass?.name),sub=norm(item?.itemSubclass?.name),inv=String(item?.inventoryType?.type||'').toUpperCase(),slots=simcSlotsForItemV1(item);let result;
  if(!classKnown)result={version:LOOT_ELIGIBILITY_VERSION,eligible:false,status:'unknown-class',reason:`Player class is not resolved (${player.className||player.class||player.type||'unknown'})`,slots:[]};
  else if(!slots.length)result={version:LOOT_ELIGIBILITY_VERSION,eligible:false,status:'non-equippable-or-unsupported-slot',reason:`Unsupported inventory type ${item?.inventoryType?.type||'unknown'}`,slots:[]};
  else if(itemClass.includes('armor')){
    if(inv==='SHIELD'||sub==='shields'||sub==='shield'){const ok=SHIELD.has(classKey);result={version:LOOT_ELIGIBILITY_VERSION,eligible:ok,status:ok?'eligible':'class-cannot-use-shield',reason:ok?'Shield proficiency':'Class cannot equip shields',slots};}
    else if(inv==='HOLDABLE'){const ok=OFFHAND.has(classKey);result={version:LOOT_ELIGIBILITY_VERSION,eligible:ok,status:ok?'eligible':'class-cannot-use-offhand',reason:ok?'Off-hand proficiency':'Class cannot equip caster off-hands',slots};}
    else {result=null;for(const [armor,set] of Object.entries(ARMOR))if(sub.includes(armor)){const ok=set.has(classKey);result={version:LOOT_ELIGIBILITY_VERSION,eligible:ok,status:ok?'eligible':'wrong-armor-specialization',reason:ok?`${armor} armor specialization`:`${player.className||'Class'} is not an intended ${armor} wearer`,slots};break;}if(!result)result={version:LOOT_ELIGIBILITY_VERSION,eligible:true,status:'eligible-universal-armor-slot',reason:'Universal jewelry/back/trinket armor-class item',slots};}
  }else if(itemClass.includes('weapon')){
    const key=canonicalWeaponSubclassV1(sub),set=key?WEAPONS[key]:null;
    if(!set)result={version:LOOT_ELIGIBILITY_VERSION,eligible:false,status:'weapon-proficiency-unresolved',reason:`Weapon subclass ${item?.itemSubclass?.name||'unknown'} is not mapped yet`,slots:[]};
    else {const ok=set.has(classKey);result={version:LOOT_ELIGIBILITY_VERSION,eligible:ok,status:ok?'eligible':'class-cannot-use-weapon',reason:ok?`${item.itemSubclass.name} proficiency`:`${player.className||'Class'} cannot equip ${item.itemSubclass.name}`,slots};}
  }else result={version:LOOT_ELIGIBILITY_VERSION,eligible:true,status:'eligible-generic',reason:'Equippable item; final validation delegated to SimulationCraft',slots};
  return finalize(item,player,result);
}

export function filterEligibleRaidersV1(item,players=[]){return(players||[]).map(player=>({player,eligibility:evaluateLootEligibilityV1(item,player)})).filter(row=>row.eligibility.simEligible);}
