const TABLE_KINDS=['Casts','Damage','Debuffs','Buffs','Interrupts','Deaths'];
const emptyRelations=()=>({castToEnemyAura:{},castToDamage:{}});
const emptySplit=()=>({wideReports:0,deepReports:0,killReports:0,wipeReports:0,killPulls:0,wipePulls:0,deepKillPulls:0,deepWipePulls:0,abilities:{},statePairs:{},relations:emptyRelations(),completeness:{},sourceReports:{},deepSourceReports:{}});

export function hashString(value){let h=2166136261;for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}

export function reportSourceKey(profile={}){
  const guildId=Number(profile?.guild?.id);if(Number.isFinite(guildId)&&guildId>0)return`guild:${guildId}`;
  const ownerId=Number(profile?.owner?.id);if(Number.isFinite(ownerId)&&ownerId>0)return`user:${ownerId}`;
  return profile?.code?`report:${String(profile.code)}`:null;
}

// v3.7 prevents train/holdout leakage: every report from the same guild/uploader
// is deterministically assigned to the same split. Strings remain supported for tests/legacy callers.
export function corpusSplit(profileOrKey,validationFraction=.2){
  const key=typeof profileOrKey==='string'?profileOrKey:(reportSourceKey(profileOrKey)||profileOrKey?.code||'unknown');
  return (hashString(key)%10000)<Math.round(validationFraction*10000)?'validation':'train';
}

export function createAggregate({encounterId,difficulty=5,partition=0,encounter=null,validationFraction=.2}={}){
  return{schemaVersion:2,encounterId:Number(encounterId),difficulty:Number(difficulty),partition:Number(partition||0),resolvedPartition:null,encounter,validationFraction,createdAt:Date.now(),updatedAt:Date.now(),wideReports:0,deepReports:0,killPulls:0,wipePulls:0,deepKillPulls:0,deepWipePulls:0,sourceReports:{},deepSourceReports:{},discoveredSourcePool:0,splits:{train:emptySplit(),validation:emptySplit()}};
}

function incrementSource(target,key){if(!key)return;target[key]=(Number(target[key])||0)+1;}

function abilityBucket(split,id,meta={}){
  const key=String(id);if(!split.abilities[key]){
    split.abilities[key]={id:Number(id),name:meta.name||`Ability ${id}`,type:meta.type||null,wide:{kill:{},wipe:{}},deep:{kill:{begins:0,casts:0,interrupts:0,damageHits:0,damageOccurrences:0,damageTargets:0,deathLinks:0,phaseBoundaryCasts:0,enemyBuffApplications:0,enemyDebuffApplications:0},wipe:{begins:0,casts:0,interrupts:0,damageHits:0,damageOccurrences:0,damageTargets:0,deathLinks:0,phaseBoundaryCasts:0,enemyBuffApplications:0,enemyDebuffApplications:0}},stateAlignment:{}};
  }else if(meta.name&&!String(split.abilities[key].name||'').startsWith('Ability ')){/* keep first meaningful name */}
  else if(meta.name)split.abilities[key].name=meta.name;
  return split.abilities[key];
}

function mergeWideTable(split,profile,cohort,kind){
  const table=profile.tables?.[`${cohort}${kind}`]||{};const pullCount=cohort==='kill'?profile.kills:profile.wipes;if(pullCount<=0)return;
  for(const [id,row] of Object.entries(table)){
    const b=abilityBucket(split,id,profile.abilities?.[id]||row);if(!b.wide[cohort][kind])b.wide[cohort][kind]={reportsWith:0,count:0,total:0,rows:0};const x=b.wide[cohort][kind];x.reportsWith++;x.count+=Number(row.count)||0;x.total+=Number(row.total)||0;x.rows+=Number(row.rows)||0;
  }
}

export function mergeWideProfile(aggregate,profile,{validationFraction=aggregate.validationFraction??.2}={}){
  const splitName=corpusSplit(profile,validationFraction),split=aggregate.splits[splitName]||(aggregate.splits[splitName]=emptySplit());
  const source=reportSourceKey(profile);
  aggregate.wideReports++;aggregate.killPulls+=profile.kills||0;aggregate.wipePulls+=profile.wipes||0;aggregate.updatedAt=Date.now();incrementSource(aggregate.sourceReports,source);
  split.wideReports++;split.killPulls+=profile.kills||0;split.wipePulls+=profile.wipes||0;if(profile.kills>0)split.killReports++;if(profile.wipes>0)split.wipeReports++;incrementSource(split.sourceReports,source);
  for(const kind of TABLE_KINDS){mergeWideTable(split,profile,'kill',kind);mergeWideTable(split,profile,'wipe',kind);}
  return splitName;
}

function addDeepSideSelective(dst,src={},completeness={}){
  const castOk=Boolean(completeness.enemyCasts);
  const interruptOk=Boolean(completeness.interrupts);
  const damageOk=Boolean(completeness.friendDamage);
  const deathLinkOk=damageOk&&Boolean(completeness.deaths);
  const enemyBuffOk=Boolean(completeness.enemyBuffs);
  const enemyDebuffOk=Boolean(completeness.enemyDebuffs);
  if(castOk)for(const k of ['begins','casts','phaseBoundaryCasts'])dst[k]=(Number(dst[k])||0)+(Number(src[k])||0);
  if(interruptOk)dst.interrupts=(Number(dst.interrupts)||0)+(Number(src.interrupts)||0);
  if(damageOk)for(const k of ['damageHits','damageOccurrences','damageTargets'])dst[k]=(Number(dst[k])||0)+(Number(src[k])||0);
  if(deathLinkOk)dst.deathLinks=(Number(dst.deathLinks)||0)+(Number(src.deathLinks)||0);
  if(enemyBuffOk)dst.enemyBuffApplications=(Number(dst.enemyBuffApplications)||0)+(Number(src.enemyBuffApplications)||0);
  if(enemyDebuffOk)dst.enemyDebuffApplications=(Number(dst.enemyDebuffApplications)||0)+(Number(src.enemyDebuffApplications)||0);
}

function mergeRelationSide(dst,src={}){
  for(const cohort of ['kill','wipe']){
    dst[cohort] ||= {sourceOccurrences:0,linkedOccurrences:0,deltaTotalMs:0};
    const s=src[cohort]||{};
    dst[cohort].sourceOccurrences+=(Number(s.sourceOccurrences)||0);
    dst[cohort].linkedOccurrences+=(Number(s.linkedOccurrences)||0);
    dst[cohort].deltaTotalMs+=(Number(s.deltaTotalMs)||0);
  }
}
function mergeRelations(split,relations={},completeness={}){
  if(Boolean(completeness.enemyCasts)&&Boolean(completeness.enemyBuffs||completeness.enemyDebuffs)){
    for(const [key,row] of Object.entries(relations.castToEnemyAura||{})){
      const dst=split.relations.castToEnemyAura[key]||(split.relations.castToEnemyAura[key]={sourceId:Number(row.sourceId),targetId:Number(row.targetId),targetKind:row.targetKind||'buff',kill:{sourceOccurrences:0,linkedOccurrences:0,deltaTotalMs:0},wipe:{sourceOccurrences:0,linkedOccurrences:0,deltaTotalMs:0}});mergeRelationSide(dst,row);
    }
  }
  if(Boolean(completeness.enemyCasts)&&Boolean(completeness.friendDamage)){
    for(const [key,row] of Object.entries(relations.castToDamage||{})){
      const dst=split.relations.castToDamage[key]||(split.relations.castToDamage[key]={sourceId:Number(row.sourceId),targetId:Number(row.targetId),kill:{sourceOccurrences:0,linkedOccurrences:0,deltaTotalMs:0},wipe:{sourceOccurrences:0,linkedOccurrences:0,deltaTotalMs:0}});mergeRelationSide(dst,row);
    }
  }
}

export function mergeDeepProfile(aggregate,profile,{validationFraction=aggregate.validationFraction??.2}={}){
  const splitName=corpusSplit(profile,validationFraction),split=aggregate.splits[splitName]||(aggregate.splits[splitName]=emptySplit());const source=reportSourceKey(profile);
  aggregate.deepReports++;split.deepReports++;incrementSource(aggregate.deepSourceReports,source);incrementSource(split.deepSourceReports,source);
  const deepKills=(profile.fights||[]).filter(f=>f.kill).length,deepWipes=(profile.fights||[]).filter(f=>!f.kill).length;aggregate.deepKillPulls=(aggregate.deepKillPulls||0)+deepKills;aggregate.deepWipePulls=(aggregate.deepWipePulls||0)+deepWipes;split.deepKillPulls=(split.deepKillPulls||0)+deepKills;split.deepWipePulls=(split.deepWipePulls||0)+deepWipes;aggregate.updatedAt=Date.now();
  const completeness=profile.completeness||{};
  for(const [k,v] of Object.entries(completeness)){const row=split.completeness[k]||(split.completeness[k]={complete:0,total:0});row.total++;if(v)row.complete++;}
  const stateOk=Boolean(completeness.friendDamage)&&Boolean(completeness.debuffs)&&Boolean(completeness.buffs);
  for(const [id,row] of Object.entries(profile.abilityStats||{})){
    const b=abilityBucket(split,id,profile.abilities?.[id]||row);addDeepSideSelective(b.deep.kill,row.kill,completeness);addDeepSideSelective(b.deep.wipe,row.wipe,completeness);
    if(stateOk)for(const [pairKey,alignment] of Object.entries(row.stateAlignment||{})){if(!b.stateAlignment[pairKey])b.stateAlignment[pairKey]={pairKey,required:alignment.required,tokens:alignment.tokens||null,kill:{match:0,mismatch:0,unknown:0},wipe:{match:0,mismatch:0,unknown:0}};for(const cohort of ['kill','wipe'])for(const key of ['match','mismatch','unknown'])b.stateAlignment[pairKey][cohort][key]+=(Number(alignment?.[cohort]?.[key])||0);}
  }
  const auraOk=Boolean(completeness.debuffs)&&Boolean(completeness.buffs);
  if(auraOk)for(const pair of profile.statePairs||[]){const key=pair.key;if(!split.statePairs[key])split.statePairs[key]={key,dimension:pair.dimension,values:pair.values,tokens:pair.tokens,applications:0,conflicts:0,reports:0,players:0,fights:0,valueCounts:{}};const x=split.statePairs[key];x.applications+=Number(pair.applications)||0;x.conflicts+=Number(pair.conflicts)||0;x.reports++;x.players+=Number(pair.players)||0;x.fights+=Number(pair.fights)||0;for(const [value,count] of Object.entries(pair.valueCounts||{}))x.valueCounts[value]=(Number(x.valueCounts[value])||0)+(Number(count)||0);}
  mergeRelations(split,profile.relations||{},completeness);
  return splitName;
}

export function aggregateSummary(aggregate){
  const trainSources=Object.keys(aggregate.splits.train.sourceReports||{}).length,validationSources=Object.keys(aggregate.splits.validation.sourceReports||{}).length;
  return{wideReports:aggregate.wideReports,deepReports:aggregate.deepReports,killPulls:aggregate.killPulls,wipePulls:aggregate.wipePulls,deepKillPulls:aggregate.deepKillPulls||0,deepWipePulls:aggregate.deepWipePulls||0,independentSources:Object.keys(aggregate.sourceReports||{}).length,deepSources:Object.keys(aggregate.deepSourceReports||{}).length,discoveredSourcePool:Number(aggregate.discoveredSourcePool||0),train:{wideReports:aggregate.splits.train.wideReports,deepReports:aggregate.splits.train.deepReports,independentSources:trainSources},validation:{wideReports:aggregate.splits.validation.wideReports,deepReports:aggregate.splits.validation.deepReports,independentSources:validationSources},abilityCount:new Set([...Object.keys(aggregate.splits.train.abilities||{}),...Object.keys(aggregate.splits.validation.abilities||{})]).size};
}
