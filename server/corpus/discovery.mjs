const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,Number(v)||0));
const lower=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[’']/g,"'");
const STOP_WORDS=new Set(['the','of','a','an','s','and','or']);

export const OPPOSITE_STATE_TOKENS=Object.freeze([
  {key:'light-void',values:['LIGHT','VOID'],tokens:['light','void']},
  {key:'holy-shadow',values:['HOLY','SHADOW'],tokens:['holy','shadow']},
  {key:'radiant-dark',values:['RADIANT','DARK'],tokens:['radiant','dark']},
  {key:'fire-frost',values:['FIRE','FROST'],tokens:['fire','frost']},
  {key:'flame-frost',values:['FLAME','FROST'],tokens:['flame','frost']},
  {key:'red-blue',values:['RED','BLUE'],tokens:['red','blue']},
  {key:'solar-lunar',values:['SOLAR','LUNAR'],tokens:['solar','lunar']},
  {key:'sun-moon',values:['SUN','MOON'],tokens:['sun','moon']},
  {key:'positive-negative',values:['POSITIVE','NEGATIVE'],tokens:['positive','negative']},
]);

function nameTokens(name){return lower(name).replace(/'s\b/g,' ').replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(Boolean);}
function stripToken(name,token){return nameTokens(name).filter(x=>x!==token&&!STOP_WORDS.has(x)).join(' ');}
function tablePresence(split,ability,cohort,kind){const den=cohort==='kill'?Number(split?.killReports||0):Number(split?.wipeReports||0);const n=Number(ability?.wide?.[cohort]?.[kind]?.reportsWith||0);return den>0?n/den:0;}
function deepMetric(ability,cohort,key){return Number(ability?.deep?.[cohort]?.[key]||0);}
function maxPresence(split,a,kind){return Math.max(tablePresence(split,a,'kill',kind),tablePresence(split,a,'wipe',kind));}
function tokenDescriptor(name){const tokens=nameTokens(name);for(const group of OPPOSITE_STATE_TOKENS){for(let i=0;i<group.tokens.length;i++){if(tokens.includes(group.tokens[i]))return{group,value:group.values[i],token:group.tokens[i],base:stripToken(name,group.tokens[i])};}}return null;}
function jaccard(a,b){const A=new Set(String(a||'').split(/\s+/).filter(Boolean)),B=new Set(String(b||'').split(/\s+/).filter(Boolean));if(!A.size||!B.size)return 0;let hit=0;for(const x of A)if(B.has(x))hit++;return hit/(A.size+B.size-hit);}
function abilityActivity(split,a){
  const cast=maxPresence(split,a,'Casts'),damage=maxPresence(split,a,'Damage'),aura=Math.max(maxPresence(split,a,'Buffs'),maxPresence(split,a,'Debuffs'));
  const deep=deepMetric(a,'kill','begins')+deepMetric(a,'wipe','begins')+deepMetric(a,'kill','damageOccurrences')+deepMetric(a,'wipe','damageOccurrences')+deepMetric(a,'kill','enemyBuffApplications')+deepMetric(a,'wipe','enemyBuffApplications')+deepMetric(a,'kill','enemyDebuffApplications')+deepMetric(a,'wipe','enemyDebuffApplications');
  return{cast,damage,aura,deep};
}

export function discoverVariantFamilies(split={}){
  const groups=new Map();
  for(const [id,a] of Object.entries(split.abilities||{})){
    const d=tokenDescriptor(a.name);if(!d?.base)continue;const key=`${d.group.key}:${d.base}`;let row=groups.get(key);if(!row){row={key,tokenGroup:d.group.key,tokens:d.group.tokens,values:{},base:d.base,members:[],lexicalConfidence:1};groups.set(key,row);}row.values[d.value]||=[];row.values[d.value].push(Number(id));row.members.push({id:Number(id),name:a.name,value:d.value,activity:abilityActivity(split,a)});
  }
  const out=[];
  for(const row of groups.values()){
    const group=OPPOSITE_STATE_TOKENS.find(x=>x.key===row.tokenGroup);if(!group||!group.values.every(v=>row.values[v]?.length))continue;
    const active=row.members.filter(m=>Math.max(m.activity.cast,m.activity.damage,m.activity.aura)>0.03||m.activity.deep>0);
    if(active.length<2)continue;
    const byValue=group.values.map(v=>row.members.filter(m=>m.value===v));
    const scoreFor=member=>Math.max(member.activity.aura,member.activity.cast,member.activity.damage)+Math.min(.2,member.activity.deep/100);
    const primary=Object.fromEntries(group.values.map((v,i)=>[v,[...byValue[i]].sort((a,b)=>scoreFor(b)-scoreFor(a))[0]?.id]).filter(([,id])=>id!=null));
    const pMembers=Object.entries(primary).map(([value,id])=>row.members.find(m=>m.id===id&&m.value===value)).filter(Boolean);
    const auraScore=pMembers.length?pMembers.reduce((s,m)=>s+m.activity.aura,0)/pMembers.length:0;
    const damageScore=pMembers.length?pMembers.reduce((s,m)=>s+m.activity.damage,0)/pMembers.length:0;
    const castScore=pMembers.length?pMembers.reduce((s,m)=>s+m.activity.cast,0)/pMembers.length:0;
    const activityVals=pMembers.map(scoreFor);const balance=activityVals.length>=2&&Math.max(...activityVals)>0?Math.min(...activityVals)/Math.max(...activityVals):0;
    const confidence=clamp(.45+.25*balance+.15*Math.max(auraScore,damageScore,castScore)+.15*Math.min(1,active.length/2));
    out.push({...row,primary,auraScore,damageScore,castScore,balance,confidence});
  }
  return out.sort((a,b)=>b.confidence-a.confidence);
}

function statePairTokenGroup(pair){const tokens=(pair?.tokens||[]).map(lower);for(const group of OPPOSITE_STATE_TOKENS)if(group.tokens.every(t=>tokens.includes(t)))return group;const key=String(pair?.key||'').split(':')[0];return OPPOSITE_STATE_TOKENS.find(g=>g.key===key)||null;}
function stateValueBalance(counts={}){const vals=Object.values(counts).map(Number).filter(x=>x>0);if(vals.length<2)return .5;return Math.min(...vals)/Math.max(...vals);}

export function discoverStateDimensions(split={}){
  const found=[];const seenIds=new Set();
  for(const pair of Object.values(split.statePairs||{})){
    const group=statePairTokenGroup(pair);if(!group)continue;const applications=Number(pair.applications||0),conflicts=Number(pair.conflicts||0),exclusivity=applications?clamp(1-conflicts/applications):0,reportSupport=clamp(Number(pair.reports||0)/8),balance=stateValueBalance(pair.valueCounts||{});
    if(applications<12||exclusivity<.8)continue;
    const confidence=clamp(.4+.35*exclusivity+.12*balance+.13*reportSupport);const ids=Object.values(pair.values||{}).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);if(ids.length<2)continue;seenIds.add(ids.join(':'));
    found.push({key:String(pair.dimension||group.key),tokenGroup:group.key,tokens:group.tokens,values:Object.fromEntries(Object.entries(pair.values||{}).map(([v,id])=>[v,{ids:[Number(id)]}])),confidence,source:'event-mutual-exclusivity',evidence:{applications,conflicts,exclusivity,reports:Number(pair.reports||0),players:Number(pair.players||0),fights:Number(pair.fights||0),balance},pairKey:pair.key});
  }

  // Fallback: a mirrored opposite-token family that behaves like an aura can reveal the
  // existence of a state even when old stored deep profiles did not preserve raw aura timelines.
  for(const family of discoverVariantFamilies(split)){
    if(family.auraScore<.28||family.auraScore<Math.max(family.damageScore,family.castScore)*.75)continue;
    const ids=Object.values(family.primary).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);if(ids.length<2||seenIds.has(ids.join(':')))continue;
    const confidence=clamp(.48+.22*family.auraScore+.15*family.balance+.15*family.confidence);seenIds.add(ids.join(':'));
    found.push({key:family.base||family.tokenGroup,tokenGroup:family.tokenGroup,tokens:family.tokens,values:Object.fromEntries(Object.entries(family.primary).map(([v,id])=>[v,{ids:[Number(id)]}])),confidence,source:'mirrored-aura-family',evidence:{auraScore:family.auraScore,balance:family.balance,family:family.key},pairKey:null});
  }
  return found.sort((a,b)=>b.confidence-a.confidence);
}

export function stateDimensionForAbility(ability,dimensions=[]){
  const d=tokenDescriptor(ability?.name);if(!d)return null;const candidates=dimensions.filter(x=>x.tokenGroup===d.group.key).sort((a,b)=>b.confidence-a.confidence);if(!candidates.length)return null;return{dimension:candidates[0],requiredValue:d.value,tokenGroup:d.group.key,base:d.base};
}

export function alignmentForDimension(ability,dimension,cohort='kill'){
  if(!ability||!dimension)return null;let best=null;
  for(const [pairKey,row] of Object.entries(ability.stateAlignment||{})){
    const prefix=String(pairKey).split(':')[0];const tokens=(row.tokens||[]).map(lower);if(prefix!==dimension.tokenGroup&&!dimension.tokens.every(t=>tokens.includes(t)))continue;
    const b=row?.[cohort]||{};const known=Number(b.match||0)+Number(b.mismatch||0);if(!known)continue;const candidate={pairKey,required:row.required,known,match:Number(b.match||0)/known,mismatch:Number(b.mismatch||0)/known,unknown:Number(b.unknown||0)};if(!best||candidate.known>best.known)best=candidate;
  }
  return best;
}

export function discoverRelationCandidates(split={},families=discoverVariantFamilies(split)){
  const byTarget=new Map();
  for(const row of Object.values(split.relations?.castToEnemyAura||{})){
    const k=row.kill||{},w=row.wipe||{};const kDen=Number(k.sourceOccurrences||0),wDen=Number(w.sourceOccurrences||0);if(kDen+wDen<8)continue;const kRate=kDen?Number(k.linkedOccurrences||0)/kDen:0,wRate=wDen?Number(w.linkedOccurrences||0)/wDen:0,lift=wRate-kRate;
    if(!(wRate>=.08&&lift>=.05))continue;
    const targetId=Number(row.targetId),sourceId=Number(row.sourceId);if(!byTarget.has(targetId))byTarget.set(targetId,[]);byTarget.get(targetId).push({sourceId,targetId,targetKind:row.targetKind||'buff',killRate:kRate,wipeRate:wRate,lift,killN:kDen,wipeN:wDen,meanDeltaMs:(Number(w.linkedOccurrences||0)+Number(k.linkedOccurrences||0))?((Number(w.deltaTotalMs||0)+Number(k.deltaTotalMs||0))/(Number(w.linkedOccurrences||0)+Number(k.linkedOccurrences||0))):null});
  }
  const out=[];
  for(const [targetId,edges] of byTarget){
    const sourceIds=[...new Set(edges.map(x=>x.sourceId))];const family=families.find(f=>sourceIds.some(id=>f.members.some(m=>m.id===id)));const weightedLift=edges.reduce((s,e)=>s+e.lift*Math.max(1,e.wipeN),0)/edges.reduce((s,e)=>s+Math.max(1,e.wipeN),0);const wipeRate=Math.max(...edges.map(x=>x.wipeRate)),killRate=Math.min(...edges.map(x=>x.killRate));const confidence=clamp(.48+.25*clamp(weightedLift/.3)+.17*clamp((wipeRate-.08)/.5)+.1*clamp(edges.reduce((s,e)=>s+e.wipeN,0)/40));
    out.push({targetId,triggerCastIds:sourceIds,targetKind:edges[0]?.targetKind||'buff',familyKey:family?.key||null,tokenGroup:family?.tokenGroup||null,confidence,killRate,wipeRate,lift:weightedLift,edges});
  }
  return out.sort((a,b)=>b.confidence-a.confidence);
}

export function abilityImportance(split={},ability={}){
  const castK=tablePresence(split,ability,'kill','Casts'),castW=tablePresence(split,ability,'wipe','Casts'),damageK=tablePresence(split,ability,'kill','Damage'),damageW=tablePresence(split,ability,'wipe','Damage');
  const prevalence=Math.max(castK,castW,damageK,damageW);const wipeLift=Math.max(0,castW-castK,damageW-damageK);const deepPulls=Math.max(1,Number(split.deepKillPulls||0)+Number(split.deepWipePulls||0));const deathRate=(deepMetric(ability,'kill','deathLinks')+deepMetric(ability,'wipe','deathLinks'))/deepPulls;const enemyAuraRate=(deepMetric(ability,'kill','enemyBuffApplications')+deepMetric(ability,'wipe','enemyBuffApplications')+deepMetric(ability,'kill','enemyDebuffApplications')+deepMetric(ability,'wipe','enemyDebuffApplications'))/deepPulls;const deepAct=(deepMetric(ability,'kill','begins')+deepMetric(ability,'wipe','begins')+deepMetric(ability,'kill','damageOccurrences')+deepMetric(ability,'wipe','damageOccurrences'))/deepPulls;
  return clamp(.34*prevalence+.26*clamp(wipeLift/.35)+.18*clamp(deathRate/.25)+.12*clamp(enemyAuraRate/.5)+.1*clamp(deepAct/3));
}

export function importantSignals(split={},threshold=.18){
  return Object.values(split.abilities||{}).map(a=>({id:Number(a.id),name:a.name,importance:abilityImportance(split,a)})).filter(x=>x.importance>=threshold).sort((a,b)=>b.importance-a.importance);
}

export function resolvedAbilityIds(mechanics=[]){
  const ids=new Set();for(const m of mechanics||[]){for(const key of ['castIds','damageIds','failureDamageIds','failureAuraIds','triggerCastIds','stateValueIds'])for(const id of m?.[key]||[])if(Number.isFinite(Number(id)))ids.add(Number(id));const primary=Number(m?.generated?.primaryAbilityId??m?.primaryAbilityId);if(Number.isFinite(primary))ids.add(primary);}return ids;
}

export function signalCoverage(split={},mechanics=[]){
  const signals=importantSignals(split);if(!signals.length)return{score:1,resolved:0,total:0,criticalUnresolved:[],signals:[]};const resolved=resolvedAbilityIds(mechanics);let totalWeight=0,resolvedWeight=0;const unresolved=[];for(const s of signals){totalWeight+=s.importance;if(resolved.has(s.id))resolvedWeight+=s.importance;else unresolved.push(s);}const score=totalWeight?resolvedWeight/totalWeight:1;return{score:clamp(score),resolved:signals.length-unresolved.length,total:signals.length,criticalUnresolved:unresolved.filter(x=>x.importance>=.48).slice(0,8),signals:signals.slice(0,40)};
}

export function semanticCoverage(split={},mechanics=[],dimensions=discoverStateDimensions(split),families=discoverVariantFamilies(split),relations=discoverRelationCandidates(split,families)){
  const resolved=resolvedAbilityIds(mechanics);const needs=[];
  const relevantFamilies=families.filter(f=>Math.max(f.damageScore,f.castScore)>=.12&&f.base&&f.auraScore<.9);
  for(const f of relevantFamilies){const ids=Object.values(f.primary).map(Number);const hasState=dimensions.some(d=>d.tokenGroup===f.tokenGroup);const resolvedCount=ids.filter(id=>resolved.has(id)).length;needs.push({kind:'variant-family',key:f.key,weight:hasState?1.4:1,resolved:resolvedCount===ids.length&&ids.length>=2,detail:{ids,hasState}});}
  for(const r of relations.filter(r=>r.confidence>=.62)){needs.push({kind:'causal-relation',key:`${r.triggerCastIds.join(',')}>${r.targetId}`,weight:1.6,resolved:resolved.has(r.targetId),detail:r});}
  const interruptHints=Object.values(split.abilities||{}).filter(a=>{const begins=deepMetric(a,'kill','begins')+deepMetric(a,'wipe','begins'),ints=deepMetric(a,'kill','interrupts')+deepMetric(a,'wipe','interrupts');return begins>=12&&ints/begins>=.35;});
  for(const a of interruptHints)needs.push({kind:'interrupt-family',key:String(a.id),weight:1.2,resolved:resolved.has(Number(a.id)),detail:{id:Number(a.id),name:a.name}});
  const signal=signalCoverage(split,mechanics);
  needs.push({kind:'signal-classification',key:'important-signals',weight:2,resolved:signal.score>=.72,partial:signal.score});
  const statefulNeed=relevantFamilies.some(f=>dimensions.some(d=>d.tokenGroup===f.tokenGroup));if(statefulNeed)needs.push({kind:'state-model',key:'state-dimensions',weight:1.8,resolved:dimensions.some(d=>d.confidence>=.72),partial:dimensions.length?Math.max(...dimensions.map(d=>d.confidence)):0});
  let den=0,num=0;for(const n of needs){den+=n.weight;num+=n.weight*(n.resolved?1:clamp(n.partial||0));}
  return{score:den?clamp(num/den):signal.score,needs,resolvedNeeds:needs.filter(n=>n.resolved).length,totalNeeds:needs.length,stateDimensions:dimensions.length,variantFamilies:relevantFamilies.length,relationCandidates:relations.filter(r=>r.confidence>=.62).length};
}

export function tokenInfoForAbility(name){return tokenDescriptor(name);}
export function wideReportPresence(split,ability,cohort,kind){return tablePresence(split,ability,cohort,kind);}
export function deepAbilityMetric(ability,cohort,key){return deepMetric(ability,cohort,key);}
export function clamp01(v){return clamp(v);}
