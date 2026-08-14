import { applyEncounterPolicyV372 } from './model-policy-v372.mjs';
import { importantSignals, resolvedAbilityIds, semanticCoverage, discoverVariantFamilies } from './discovery.mjs';

const num=v=>Number.isFinite(Number(v))?Number(v):0;
const clamp=v=>Math.max(0,Math.min(1,num(v)));
const pct=v=>Math.round(clamp(v)*1000)/10;
const grade=s=>s>=95?'VERIFIED':s>=85?'MATURE':s>=70?'STRONG':s>=50?'PARTIAL':s>=25?'LEARNING':'DISCOVERY';
const primary=m=>{const x=Number(m?.generated?.primaryAbilityId??m?.primaryAbilityId);if(Number.isFinite(x))return x;for(const k of ['castIds','damageIds','failureDamageIds','failureAuraIds','auraIds']){const n=Number(m?.[k]?.[0]);if(Number.isFinite(n))return n;}return null;};
const mechanicWeight=m=>Math.max(.5,num(m?.generated?.semanticWeight)||1);
const uniq=a=>[...new Set((a||[]).filter(x=>x!==null&&x!==undefined))];

function reportPresence(split,ability,kind){
  if(!ability)return 0;
  const kDen=Math.max(1,num(split?.killReports)),wDen=Math.max(1,num(split?.wipeReports));
  return Math.max(num(ability?.wide?.kill?.[kind]?.reportsWith)/kDen,num(ability?.wide?.wipe?.[kind]?.reportsWith)/wDen);
}
function originEvidence(split,id){
  const row=split?.originEvidence?.[String(id)]||{};
  const friendly=num(row.friendlySourceEvents),encounter=num(row.encounterOrUnknownSourceEvents),unknown=num(row.unknownSourceEvents),known=friendly+encounter;
  const friendlyRate=known?friendly/known:null,encounterRate=known?encounter/known:null;
  let classification='unknown';
  if(known>=8&&friendlyRate>=.8)classification='friendly-player';
  else if(known>=8&&encounterRate>=.7)classification='encounter-or-environment';
  else if(known>=8)classification='mixed';
  return{friendlySourceEvents:friendly,encounterOrUnknownSourceEvents:encounter,unknownSourceEvents:unknown,reportsWithEvidence:num(row.reportsWithEvidence),knownEvents:known,friendlyRate,encounterRate,classification};
}
function memberEvidence(split,id,stateIds){
  const ability=split?.abilities?.[String(id)],origin=originEvidence(split,id),cast=reportPresence(split,ability,'Casts'),damage=reportPresence(split,ability,'Damage'),isState=stateIds.has(Number(id));
  const provenFriendly=origin.classification==='friendly-player';
  const encounterFacing=!provenFriendly&&(cast>=.02||damage>=.02||origin.classification==='encounter-or-environment'||isState);
  return{id:Number(id),name:ability?.name||`Ability ${id}`,castPresence:cast,damagePresence:damage,isCanonicalState:isState,encounterFacing,origin};
}
function familyDiagnostics(baseFamilies,split,dimensions){
  const stateIds=new Set((dimensions||[]).flatMap(d=>Object.values(d.values||{}).flatMap(v=>v?.ids||[])).map(Number));
  const supportedTokens=new Set((dimensions||[]).map(d=>d.tokenGroup));
  return(baseFamilies||[]).map(f=>{
    const lexical=uniq((f.memberIds||f.members?.map(m=>m.id)||Object.values(f.primary||{})).map(Number).filter(Number.isFinite));
    const evidence=lexical.map(id=>memberEvidence(split,id,stateIds));
    const encounter=evidence.filter(x=>x.encounterFacing).map(x=>x.id),excluded=evidence.filter(x=>!x.encounterFacing).map(x=>x.id);
    return{...f,lexicalMemberIds:lexical,encounterMemberIds:encounter,excludedMemberIds:excluded,memberEvidence:evidence,encounterSupported:supportedTokens.has(f.tokenGroup),originPolicy:'encounter-members-v1'};
  });
}
function familyForMechanic(m,families){
  const key=m?.generated?.encounterFamilyKey;if(key){const f=families.find(x=>x.key===key);if(f)return f;}
  const id=primary(m);return families.find(f=>(f.encounterMemberIds||[]).includes(id)||(f.lexicalMemberIds||[]).includes(id))||null;
}
function refineMechanics(mechanics,families){
  const kept=[],filtered=[];
  for(const m of mechanics||[]){
    if(!m.requiredState){kept.push(m);continue;}
    const f=familyForMechanic(m,families),id=primary(m);
    if(!f||!(f.encounterMemberIds||[]).includes(id)){filtered.push({key:m.key,name:m.name,primaryAbilityId:id,reason:'not-encounter-facing-family-member',category:'filtered-signal',inference:'encounter-origin-filter-v3'});continue;}
    kept.push({...m,generated:{...(m.generated||{}),encounterFamilyKey:f.key,originPolicy:'encounter-member-v1'}});
  }
  return{kept,filtered};
}
function signalCoverageV373(split,mechanics,excludedIds){
  if(!split?.abilities)return{score:0,resolved:0,total:0,criticalUnresolved:[],signals:[],ignoredNonEncounter:excludedIds.size};
  const signals=importantSignals(split).filter(s=>!excludedIds.has(Number(s.id))),resolved=resolvedAbilityIds(mechanics);let totalWeight=0,resolvedWeight=0;const unresolved=[];
  for(const s of signals){totalWeight+=num(s.importance);if(resolved.has(Number(s.id)))resolvedWeight+=num(s.importance);else unresolved.push(s);}
  return{score:clamp(totalWeight?resolvedWeight/totalWeight:1),resolved:signals.length-unresolved.length,total:signals.length,criticalUnresolved:unresolved.filter(x=>num(x.importance)>=.48).slice(0,8),signals:signals.slice(0,40),ignoredNonEncounter:excludedIds.size};
}
function validationV373(mechanics,signal){
  const rows=(mechanics||[]).filter(m=>Number.isFinite(Number(m?.generated?.validationScore))),weight=rows.reduce((s,m)=>s+mechanicWeight(m),0);
  const mean=weight?rows.reduce((s,m)=>s+num(m.generated.validationScore)*mechanicWeight(m),0)/weight:0;
  const breadth=signal.total?clamp((mechanics||[]).reduce((s,m)=>s+mechanicWeight(m),0)/Math.max(4,signal.total*1.2)):1;
  return{mean,breadth,confidence:clamp(mean*(.68+.32*breadth))};
}
function relationScoreForMechanic(m){
  if(m.semanticInference==='enemy-aura-after-cast'||m.inference==='failure-aura-is-failure'||m.inference==='wrong-state-impact')return 1;
  if(m.category==='interrupt'&&m.requiredState)return .88;
  if(m.category==='interrupt'||m.inference==='completed-cast-is-failure')return .82;
  if(m.inference==='failure-damage-by-occurrence')return .72;
  if(m.inference==='stateful-impact-observed')return .48;
  if(m.inference==='stateful-cast-observed')return .35;
  return null;
}
function relationUnderstanding(mechanics,candidates,damageRelations){
  let sum=0,weight=0;for(const m of mechanics||[]){const score=relationScoreForMechanic(m);if(score==null)continue;const w=mechanicWeight(m);sum+=score*w;weight+=w;}
  const accepted=new Set((mechanics||[]).map(primary).filter(Number.isFinite));
  const auraBonus=Math.min(.10,(candidates||[]).filter(r=>num(r.confidence)>=.62).length*.025);
  const damageBonus=Math.min(.10,(damageRelations||[]).filter(r=>num(r.confidence)>=.58&&(accepted.has(Number(r.sourceId))||accepted.has(Number(r.targetId)))).length*.0125);
  return clamp((weight?sum/weight:0)+auraBonus+damageBonus);
}
function deficits(model){const c=model.corpus||{},t=model?.validation?.thresholds||{},wide=num(c.killPulls)+num(c.wipePulls),deep=num(c.deepKillPulls)+num(c.deepWipePulls);return{widePulls:Math.max(0,num(t.minWidePulls)-wide),deepPulls:Math.max(0,num(t.minDeepPulls)-deep),wideReports:Math.max(0,num(t.minWideReports)-num(c.wideReports)),deepReports:Math.max(0,num(t.minDeepReports)-num(c.deepReports)),validationReports:Math.max(0,num(t.minValidationReports)-num(c.validationReports)),independentSources:Math.max(0,num(t.minIndependentSources)-num(c.independentSources)),validationSources:Math.max(0,num(t.minValidationSources)-num(c.validationSources))};}
function plan(model,components){
  const d=deficits(model),c=model.corpus||{},rel=num(components.relationUnderstandingPct),data=num(components.dataDepthPct),currentDeep=num(c.deepKillPulls)+num(c.deepWipePulls),avg=num(c.deepReports)>0?currentDeep/num(c.deepReports):8;
  const deepForReports=Math.ceil(d.deepReports*Math.max(1,avg)),targetedDeep=Math.max(d.deepPulls,deepForReports);
  let priority='medium',mode='wide-and-deep',reason='Increase representative Wide and Deep evidence while preserving source diversity.',addWide=d.widePulls,addDeep=d.deepPulls,addWideReports=d.wideReports;
  if(rel<65&&data>=42){priority='high';mode='targeted-deep';reason='Deep relationships are the best next investment. Reuse persisted Wide reports before discovering new pulls.';addWide=0;addWideReports=0;addDeep=Math.max(20,targetedDeep);}
  else if(d.independentSources||d.validationSources){priority='high';mode='diversity-first';reason='Independent-source coverage is limiting confidence.';}
  else if(d.wideReports||d.deepReports||d.validationReports){mode='reports-first';reason='Distinct report breadth is the next publication gate.';}
  else if(num(model?.learning?.scorePct)>=82){priority='low';mode='review-or-publish';reason='The model is mature enough for review.';}
  return{priority,mode,reason,suggestedAdditionalWidePulls:Math.min(2000,Math.max(0,Math.ceil(addWide/100)*100)),suggestedAdditionalDeepPulls:Math.min(500,Math.max(0,Math.ceil(addDeep/10)*10)),suggestedAdditionalWideReports:addWideReports,suggestedAdditionalDeepReports:d.deepReports,suggestedAdditionalValidationReports:d.validationReports,suggestedAdditionalIndependentSources:d.independentSources,suggestedAdditionalValidationSources:d.validationSources,estimatedExistingWideReportsAvailableForDeep:Math.max(0,num(c.wideReports)-num(c.deepReports)),deficits:d};
}
function actionBottleneck(rec,lowest){if(rec.mode==='targeted-deep')return'relationUnderstandingPct';if(rec.mode==='diversity-first')return'sourceDiversityPct';if(rec.mode==='reports-first'||rec.mode==='wide-and-deep')return'dataDepthPct';return lowest;}
function scoreModel(components,critical=[]){let raw=(.25*num(components.signalDiscoveryPct)+.25*num(components.relationUnderstandingPct)+.20*num(components.validationConfidencePct)+.20*num(components.dataDepthPct)+.10*num(components.sourceDiversityPct))/100,caps=[];if(num(components.relationUnderstandingPct)<40){raw=Math.min(raw,.69);caps.push('relations-under-resolved');}else if(num(components.relationUnderstandingPct)<55){raw=Math.min(raw,.79);caps.push('relations-partial');}if(critical.length){raw=Math.min(raw,.79);caps.push('critical-unresolved-signals');}if(num(components.dataDepthPct)<30){raw=Math.min(raw,.59);caps.push('data-depth-thin');}return{scorePct:Math.round(raw*1000)/10,caps};}
function enrichmentFocus(model,mechanics,excluded){
  const ids=[];for(const r of [...(model.rejected||[])].filter(r=>!String(r.inference||'').startsWith('encounter-origin-filter')).sort((a,b)=>Math.max(num(b.validationScore),num(b.trainingConfidence))-Math.max(num(a.validationScore),num(a.trainingConfidence))).slice(0,6)){const id=Number(r.primaryAbilityId);if(Number.isFinite(id)&&!excluded.has(id))ids.push(id);}
  for(const m of (mechanics||[]).filter(m=>m.requiredState)){const id=primary(m);if(Number.isFinite(id)&&!excluded.has(id))ids.push(id);if(ids.length>=24)break;}
  return uniq(ids).slice(0,24);
}
function originSummary(split){const rows=Object.values(split?.originEvidence||{});return{abilitiesWithEvidence:rows.length,friendlyClassified:rows.filter(r=>originEvidence({originEvidence:{x:r}},'x').classification==='friendly-player').length,encounterClassified:rows.filter(r=>originEvidence({originEvidence:{x:r}},'x').classification==='encounter-or-environment').length,mixedOrUnknown:rows.filter(r=>!['friendly-player','encounter-or-environment'].includes(originEvidence({originEvidence:{x:r}},'x').classification)).length};}

export function applyEncounterPolicyV373(input,aggregate=null){
  if(!input)return null;
  const base=applyEncounterPolicyV372(input,aggregate),train=aggregate?.splits?.train||null,dimensions=base?.discovery?.stateDimensions||[],baseFamilies=base?.discovery?.variantFamilies||[];
  const families=familyDiagnostics(baseFamilies,train,dimensions),refined=refineMechanics(base?.pack?.mechanics||[],families),mechanics=refined.kept;
  const excluded=new Set(refined.filtered.map(x=>Number(x.primaryAbilityId)).filter(Number.isFinite));
  for(const f of families)for(const id of f.excludedMemberIds||[])excluded.add(Number(id));
  for(const r of base?.rejected||[])if(String(r.inference||'').startsWith('encounter-origin-filter')){const id=Number(r.primaryAbilityId);if(Number.isFinite(id))excluded.add(id);}
  const signal=signalCoverageV373(train,mechanics,excluded),validation=validationV373(mechanics,signal),relations=base?.discovery?.relationCandidates||[],damageRelations=base?.discovery?.castDamageRelations||[],rel=relationUnderstanding(mechanics,relations,damageRelations);
  const old=base?.learning?.components||{},components={signalDiscoveryPct:pct(signal.score),relationUnderstandingPct:pct(rel),validationConfidencePct:pct(validation.confidence),dataDepthPct:num(old.dataDepthPct),sourceDiversityPct:num(old.sourceDiversityPct||old.diversityPct)};
  Object.assign(components,{signalCoveragePct:components.signalDiscoveryPct,holdoutPct:components.validationConfidencePct,diversityPct:components.sourceDiversityPct,semanticResolutionPct:components.relationUnderstandingPct});
  const critical=signal.criticalUnresolved||[],scored=scoreModel(components,critical),scorePct=scored.scorePct,lowest=Object.entries({signalDiscoveryPct:components.signalDiscoveryPct,relationUnderstandingPct:components.relationUnderstandingPct,validationConfidencePct:components.validationConfidencePct,dataDepthPct:components.dataDepthPct,sourceDiversityPct:components.sourceDiversityPct}).sort((a,b)=>a[1]-b[1])[0]?.[0]||'unknown',rec=plan(base,components),action=actionBottleneck(rec,lowest);
  const fullFamilies=train?.abilities?discoverVariantFamilies(train):[],technical=train?semanticCoverage(train,mechanics,dimensions,fullFamilies,relations):{score:num(base?.learning?.semantic?.score)||0,resolved:0,total:0,needs:[]};
  const rejected=[...(base?.rejected||[])];for(const r of refined.filtered)if(!rejected.some(x=>Number(x.primaryAbilityId)===Number(r.primaryAbilityId)&&x.reason===r.reason))rejected.push(r);
  const thresholds={...(base?.validation?.thresholds||{}),minLearnedPct:82,minRelationUnderstanding:.60};
  const checks={...(base?.validation?.publishChecks||{}),validationMean:validation.mean>=num(thresholds.minMeanScore||.66),learningScore:scorePct>=num(thresholds.minLearnedPct||82),signalCoverage:signal.score>=num(thresholds.minSignalCoverage||.75),semanticCoverage:num(technical.score)>=num(thresholds.minSemanticCoverage||.70),criticalUnresolved:critical.length<=num(thresholds.maxCriticalUnresolved||0),relationUnderstanding:rel>=num(thresholds.minRelationUnderstanding||.60),manualReviewHold:true};
  base.schemaVersion=Math.max(5,num(base.schemaVersion));base.engineVersion='3.7.3';base.policyVersion='encounter-origin-v3';base.status='candidate';
  base.discovery={...(base.discovery||{}),variantFamilies:families,encounterOriginPolicy:{version:'v3',rule:'lexical family membership is diagnostic only; scoreable/state-linked mechanics require encounter-facing member evidence, with friendly-source Deep evidence able to veto membership'},originEvidence:originSummary(train)};
  base.pack={...(base.pack||{}),mechanics};base.rejected=rejected;base.filtered={...(base.filtered||{}),originV3Mechanics:refined.filtered,count:(base.filtered?.statefulMechanics||[]).length+refined.filtered.length};
  base.validation={...(base.validation||{}),acceptedMechanics:mechanics.length,rejectedMechanics:rejected.length,meanScore:validation.mean,validationRecalculated:{meanScore:validation.mean,breadth:validation.breadth,confidenceScore:validation.confidence},thresholds,publishChecks:checks,publicationMode:'manual-review-hold-v3.7.3'};
  base.learning={...(base.learning||{}),scorePct,grade:grade(scorePct),components,lowestDimension:lowest,actionBottleneck:action,bottleneck:action,caps:[...new Set([...(base?.learning?.caps||[]),...scored.caps])],criticalUnresolvedSignals:critical,signalCoverage:{resolved:signal.resolved,total:signal.total,ignoredNonEncounter:signal.ignoredNonEncounter},semantic:{score:num(technical.score),resolvedNeeds:num(technical.resolved),totalNeeds:num(technical.total),stateDimensions:dimensions.length,variantFamilies:families.filter(f=>f.encounterSupported).length,relationCandidates:relations.length},relationUnderstanding:{score:rel,scorePct:components.relationUnderstandingPct,stateDimensions:dimensions.length,candidateRelations:relations.length,castDamageRelations:damageRelations.length,meaning:'How well important encounter signals are connected into validated state, completion or temporal relationships.'},validationRecalculated:{meanScore:validation.mean,breadth:validation.breadth,confidenceScore:validation.confidence},enrichmentRecommendation:rec,enrichmentFocusAbilityIds:enrichmentFocus(base,mechanics,excluded),originEvidence:originSummary(train)};
  return base;
}

export function modelDiagnosticsV373(input,aggregate=null){const model=applyEncounterPolicyV373(input,aggregate);if(!model)return null;return{engineVersion:'3.7.3',schemaVersion:model.schemaVersion,status:model.status,learnedPct:model.learning.scorePct,learningGrade:model.learning.grade,learningComponents:model.learning.components,lowestDimension:model.learning.lowestDimension,actionBottleneck:model.learning.actionBottleneck,relationUnderstanding:model.learning.relationUnderstanding,enrichmentRecommendation:model.learning.enrichmentRecommendation,enrichmentFocusAbilityIds:model.learning.enrichmentFocusAbilityIds,originEvidence:model.learning.originEvidence,acceptedMechanics:model.validation.acceptedMechanics,rejectedMechanics:model.validation.rejectedMechanics,validationMean:model.validation.meanScore,publishChecks:model.validation.publishChecks,thresholds:model.validation.thresholds,publicationMode:model.validation.publicationMode,filteredSignals:model.filtered};}
