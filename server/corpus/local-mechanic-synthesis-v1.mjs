export const LOCAL_MECHANIC_SYNTHESIS_VERSION='local-mechanic-synthesis-v1';

const num=value=>Number.isFinite(Number(value))?Number(value):0;
const clamp=value=>Math.max(0,Math.min(1,num(value)));
const uniq=values=>[...new Set((values||[]).filter(value=>value!==null&&value!==undefined))];

function presence(split,ability,cohort,kind){
  const reports=cohort==='kill'?num(split?.killReports):num(split?.wipeReports);
  const withCount=num(ability?.wide?.[cohort]?.[kind]?.reportsWith);
  return reports>0?withCount/reports:null;
}

function deep(ability,cohort,key){return num(ability?.deep?.[cohort]?.[key]);}
function safeRate(a,b){return b>0?a/b:null;}
function total(ability,key){return deep(ability,'kill',key)+deep(ability,'wipe',key);}

function alignmentSummary(ability={}){
  const rows=[];
  for(const [key,row] of Object.entries(ability?.stateAlignment||{})){
    const kill=row?.kill||{},wipe=row?.wipe||{};
    const killKnown=num(kill.match)+num(kill.mismatch),wipeKnown=num(wipe.match)+num(wipe.mismatch);
    const known=killKnown+wipeKnown;
    if(!known)continue;
    rows.push({
      pairKey:key,
      required:row?.required??null,
      tokens:row?.tokens||null,
      known,
      killKnown,
      wipeKnown,
      killMatchRate:killKnown?num(kill.match)/killKnown:null,
      killMismatchRate:killKnown?num(kill.mismatch)/killKnown:null,
      wipeMatchRate:wipeKnown?num(wipe.match)/wipeKnown:null,
      wipeMismatchRate:wipeKnown?num(wipe.mismatch)/wipeKnown:null,
      unknown:num(kill.unknown)+num(wipe.unknown),
    });
  }
  return rows.sort((a,b)=>b.known-a.known);
}

export function summarizeAbilityStructureV1(split={},id){
  const ability=split?.abilities?.[String(id)]||null;
  if(!ability)return null;
  const beginsKill=deep(ability,'kill','begins'),beginsWipe=deep(ability,'wipe','begins');
  const castsKill=deep(ability,'kill','casts'),castsWipe=deep(ability,'wipe','casts');
  const intsKill=deep(ability,'kill','interrupts'),intsWipe=deep(ability,'wipe','interrupts');
  const damageOccurrencesKill=deep(ability,'kill','damageOccurrences'),damageOccurrencesWipe=deep(ability,'wipe','damageOccurrences');
  const damageTargetsKill=deep(ability,'kill','damageTargets'),damageTargetsWipe=deep(ability,'wipe','damageTargets');
  return{
    id:Number(id),
    name:ability.name||`Ability ${id}`,
    reports:{kill:num(split?.killReports),wipe:num(split?.wipeReports),wide:num(split?.wideReports),deep:num(split?.deepReports)},
    presence:{
      casts:{kill:presence(split,ability,'kill','Casts'),wipe:presence(split,ability,'wipe','Casts')},
      damage:{kill:presence(split,ability,'kill','Damage'),wipe:presence(split,ability,'wipe','Damage')},
      buffs:{kill:presence(split,ability,'kill','Buffs'),wipe:presence(split,ability,'wipe','Buffs')},
      debuffs:{kill:presence(split,ability,'kill','Debuffs'),wipe:presence(split,ability,'wipe','Debuffs')},
    },
    deep:{
      begins:{kill:beginsKill,wipe:beginsWipe,total:beginsKill+beginsWipe},
      casts:{kill:castsKill,wipe:castsWipe,total:castsKill+castsWipe},
      interrupts:{kill:intsKill,wipe:intsWipe,total:intsKill+intsWipe},
      completionRate:{kill:safeRate(castsKill,beginsKill),wipe:safeRate(castsWipe,beginsWipe)},
      interruptRate:{kill:safeRate(intsKill,beginsKill),wipe:safeRate(intsWipe,beginsWipe)},
      damageOccurrences:{kill:damageOccurrencesKill,wipe:damageOccurrencesWipe,total:damageOccurrencesKill+damageOccurrencesWipe},
      averageTargets:{kill:safeRate(damageTargetsKill,damageOccurrencesKill),wipe:safeRate(damageTargetsWipe,damageOccurrencesWipe)},
      deathLinks:{kill:deep(ability,'kill','deathLinks'),wipe:deep(ability,'wipe','deathLinks'),total:total(ability,'deathLinks')},
      phaseBoundaryRate:{kill:safeRate(deep(ability,'kill','phaseBoundaryCasts'),castsKill),wipe:safeRate(deep(ability,'wipe','phaseBoundaryCasts'),castsWipe)},
      enemyBuffApplications:total(ability,'enemyBuffApplications'),
      enemyDebuffApplications:total(ability,'enemyDebuffApplications'),
    },
    stateAlignment:alignmentSummary(ability),
  };
}

function validationForRelation(validation={},relation={}){
  const table=validation?.relations?.castToEnemyAura||{};
  let killNum=0,killDen=0,wipeNum=0,wipeDen=0;
  for(const sourceId of relation?.triggerCastIds||[]){
    const row=table[`${Number(sourceId)}>${Number(relation.targetId)}`];
    if(!row)continue;
    killNum+=num(row.kill?.linkedOccurrences);killDen+=num(row.kill?.sourceOccurrences);
    wipeNum+=num(row.wipe?.linkedOccurrences);wipeDen+=num(row.wipe?.sourceOccurrences);
  }
  const totalDen=killDen+wipeDen;
  if(totalDen<6)return{status:'unknown',reason:'Validation split has fewer than 6 relation opportunities.',opportunities:totalDen};
  const killRate=killDen?killNum/killDen:0,wipeRate=wipeDen?wipeNum/wipeDen:0;
  if(wipeRate>=.05&&wipeRate-killRate>=.02)return{status:'supports',reason:'Validation reproduces the wipe-enriched temporal relation.',opportunities:totalDen,killRate,wipeRate};
  if(wipeRate<=.01&&killRate<=.01)return{status:'contradicts',reason:'Validation has enough opportunities but does not reproduce the temporal link.',opportunities:totalDen,killRate,wipeRate};
  return{status:'unknown',reason:'Validation relation evidence is present but not decisive.',opportunities:totalDen,killRate,wipeRate};
}

function candidateValidation(type,validationSummary,meta={}){
  if(type==='relation-linked')return validationForRelation(meta.validationSplit,meta.relation);
  if(!validationSummary)return{status:'unknown',reason:'No validation-split ability evidence is persisted.'};
  const p=validationSummary.presence,d=validationSummary.deep;
  const enoughWide=num(validationSummary.reports?.wide)>=8;
  if(type==='interrupt-candidate'){
    const begins=num(d.begins.kill)+num(d.begins.wipe);
    if(begins<6)return{status:'unknown',reason:'Validation has fewer than 6 cast starts.'};
    const ir=d.interruptRate.kill??d.interruptRate.wipe,cr=d.completionRate.kill??d.completionRate.wipe;
    if((ir??0)>=.35&&(cr??1)<=.5)return{status:'supports',reason:'Validation reproduces frequent interrupts and low completion.',begins,interruptRate:ir,completionRate:cr};
    if((cr??0)>=.65)return{status:'contradicts',reason:'Validation shows frequent completion, opposing the interrupt hypothesis.',begins,interruptRate:ir,completionRate:cr};
    return{status:'unknown',reason:'Validation cast outcomes are not decisive.',begins,interruptRate:ir,completionRate:cr};
  }
  if(type==='wipe-associated-cast'){
    if(!enoughWide||p.casts.kill==null||p.casts.wipe==null)return{status:'unknown',reason:'Validation lacks enough distinct reports for a kill/wipe cast comparison.'};
    const lift=p.casts.wipe-p.casts.kill;
    if(lift>=.03)return{status:'supports',reason:'Validation preserves higher cast presence in wipes.',lift};
    if(lift<=-.05)return{status:'contradicts',reason:'Validation reverses the train-side wipe association.',lift};
    return{status:'unknown',reason:'Validation cast-presence separation is too small.',lift};
  }
  if(type==='damage-signal'){
    if(!enoughWide||p.damage.kill==null||p.damage.wipe==null)return{status:'unknown',reason:'Validation lacks enough distinct reports for a kill/wipe damage comparison.'};
    const lift=p.damage.wipe-p.damage.kill;
    if(lift>=.03)return{status:'supports',reason:'Validation preserves higher damage presence in wipes.',lift};
    if(lift<=-.05)return{status:'contradicts',reason:'Validation reverses the train-side damage association.',lift};
    return{status:'unknown',reason:'Validation damage separation is too small.',lift};
  }
  if(type==='raid-pressure'){
    if(!enoughWide)return{status:'unknown',reason:'Validation has fewer than 8 Wide reports.'};
    const damagePresence=p.damage.kill??Math.max(p.damage.kill??0,p.damage.wipe??0),targets=d.averageTargets.kill??d.averageTargets.wipe;
    if((damagePresence??0)>=.5&&(targets??0)>=4)return{status:'supports',reason:'Validation reproduces broad raid damage exposure.',damagePresence,averageTargets:targets};
    if((damagePresence??0)<.15)return{status:'contradicts',reason:'Validation rarely observes the damage signal.',damagePresence,averageTargets:targets};
    return{status:'unknown',reason:'Validation raid-pressure evidence is not decisive.',damagePresence,averageTargets:targets};
  }
  if(type==='phase-boundary-observation'){
    const casts=num(d.casts.kill)+num(d.casts.wipe),rate=d.phaseBoundaryRate.kill??d.phaseBoundaryRate.wipe;
    if(casts<6||rate==null)return{status:'unknown',reason:'Validation has too few completed casts with phase-boundary context.'};
    if(rate>=.45)return{status:'supports',reason:'Validation reproduces concentration near a phase boundary.',casts,phaseBoundaryRate:rate};
    if(rate<.15)return{status:'contradicts',reason:'Validation does not reproduce phase-boundary concentration.',casts,phaseBoundaryRate:rate};
    return{status:'unknown',reason:'Validation phase-boundary concentration is intermediate.',casts,phaseBoundaryRate:rate};
  }
  if(type==='state-linked'){
    const best=validationSummary.stateAlignment?.[0];
    if(!best||best.known<8)return{status:'unknown',reason:'Validation has fewer than 8 state-aligned observations.'};
    const match=best.killMatchRate??best.wipeMatchRate;
    if((match??0)>=.72)return{status:'supports',reason:'Validation reproduces strong alignment to an inferred encounter state.',known:best.known,matchRate:match,pairKey:best.pairKey};
    if((match??1)<=.4)return{status:'contradicts',reason:'Validation state alignment is weak or reversed.',known:best.known,matchRate:match,pairKey:best.pairKey};
    return{status:'unknown',reason:'Validation state alignment is present but not decisive.',known:best.known,matchRate:match,pairKey:best.pairKey};
  }
  return{status:'unknown',reason:'No validation rule is defined for this structural hypothesis.'};
}

function buildCandidates({trainSummary,validationSummary,model,validationSplit,id}){
  if(!trainSummary)return[];
  const out=[];
  const p=trainSummary.presence,d=trainSummary.deep;
  const verifiedRelations=(model?.discovery?.relationCandidates||[]).filter(row=>Number(row?.targetId)===Number(id)||(row?.triggerCastIds||[]).map(Number).includes(Number(id)));
  for(const relation of verifiedRelations){
    const base=clamp(num(relation.confidence)||.62);
    const validation=candidateValidation('relation-linked',validationSummary,{validationSplit,relation});
    out.push({type:'relation-linked',confidence:clamp(base+(validation.status==='supports'?.08:validation.status==='contradicts'?-.15:0)),trainEvidence:{relation},validation,statement:'This signal participates in an origin-verified temporal encounter relation.'});
  }

  const begins=num(d.begins.kill)+num(d.begins.wipe),ir=d.interruptRate.kill,cr=d.completionRate.kill;
  if(begins>=12&&(ir??0)>=.45&&(cr??1)<=.42){
    const base=clamp(.5+.25*clamp(((ir??0)-.45)/.45)+.25*clamp((.42-(cr??.42))/.42));
    const validation=candidateValidation('interrupt-candidate',validationSummary);
    out.push({type:'interrupt-candidate',confidence:clamp(base+(validation.status==='supports'?.08:validation.status==='contradicts'?-.18:0)),trainEvidence:{begins,interruptRate:ir,completionRate:cr},validation,statement:'The encounter cast is frequently interrupted and rarely completes in successful evidence.'});
  }

  const state=trainSummary.stateAlignment?.[0];
  if(state&&state.known>=12){
    const match=state.killMatchRate??state.wipeMatchRate;
    if((match??0)>=.65){
      const base=clamp(.5+.3*clamp(((match??0)-.65)/.35)+.2*clamp(state.known/40));
      const validation=candidateValidation('state-linked',validationSummary);
      out.push({type:'state-linked',confidence:clamp(base+(validation.status==='supports'?.08:validation.status==='contradicts'?-.18:0)),trainEvidence:state,validation,statement:'The signal is strongly aligned with an inferred encounter state; player-failure semantics are not implied.'});
    }
  }

  if(p.casts.kill!=null&&p.casts.wipe!=null){
    const lift=p.casts.wipe-p.casts.kill;
    if(p.casts.wipe>=.1&&lift>=.06){
      const base=clamp(.48+1.2*lift+.08*clamp(begins/30));
      const validation=candidateValidation('wipe-associated-cast',validationSummary);
      out.push({type:'wipe-associated-cast',confidence:clamp(base+(validation.status==='supports'?.08:validation.status==='contradicts'?-.18:0)),trainEvidence:{killPresence:p.casts.kill,wipePresence:p.casts.wipe,lift,begins},validation,statement:'The cast appears more often in wipes than kills; causality is not assumed.'});
    }
  }

  if(p.damage.kill!=null&&p.damage.wipe!=null){
    const lift=p.damage.wipe-p.damage.kill;
    if(Math.max(p.damage.kill,p.damage.wipe)>=.15&&lift>=.08){
      const deaths=num(d.deathLinks.total);
      const base=clamp(.46+1.15*lift+.1*clamp(deaths/8));
      const validation=candidateValidation('damage-signal',validationSummary);
      out.push({type:'damage-signal',confidence:clamp(base+(validation.status==='supports'?.08:validation.status==='contradicts'?-.18:0)),trainEvidence:{killPresence:p.damage.kill,wipePresence:p.damage.wipe,lift,deathLinks:deaths},validation,statement:'Damage exposure is enriched in wipes; avoidability or individual blame is not assumed.'});
    }
  }

  const damagePresence=Math.max(p.damage.kill??0,p.damage.wipe??0),targets=d.averageTargets.kill??d.averageTargets.wipe;
  if(damagePresence>=.55&&(targets??0)>=4){
    const base=clamp(.48+.27*damagePresence+.25*clamp(((targets??0)-4)/12));
    const validation=candidateValidation('raid-pressure',validationSummary);
    out.push({type:'raid-pressure',confidence:clamp(base+(validation.status==='supports'?.08:validation.status==='contradicts'?-.15:0)),trainEvidence:{damagePresence,averageTargets:targets},validation,statement:'The signal behaves like broad raid pressure; this does not imply avoidable player failure.'});
  }

  const castPresence=Math.max(p.casts.kill??0,p.casts.wipe??0),phaseRate=d.phaseBoundaryRate.kill??d.phaseBoundaryRate.wipe;
  if(castPresence>=.5&&(phaseRate??0)>=.5){
    const base=clamp(.48+.24*castPresence+.28*(phaseRate??0));
    const validation=candidateValidation('phase-boundary-observation',validationSummary);
    out.push({type:'phase-boundary-observation',confidence:clamp(base+(validation.status==='supports'?.08:validation.status==='contradicts'?-.15:0)),trainEvidence:{castPresence,phaseBoundaryRate:phaseRate},validation,statement:'The cast is concentrated near a phase boundary; transition causality is not assumed.'});
  }

  return out.sort((a,b)=>b.confidence-a.confidence);
}

function contextForSignal(model={},id){
  const n=Number(id);
  const accepted=(model?.pack?.mechanics||[]).filter(row=>{
    const ids=[row?.primaryAbilityId,row?.generated?.primaryAbilityId,...(row?.castIds||[]),...(row?.damageIds||[]),...(row?.failureDamageIds||[]),...(row?.failureAuraIds||[]),...(row?.triggerCastIds||[])].map(Number);
    return ids.includes(n);
  }).slice(0,6).map(row=>({key:row.key,name:row.name,category:row.category,inference:row.inference||row.semanticInference||null,scoreable:Boolean(row.scoreable)}));
  const rejected=(model?.rejected||[]).filter(row=>Number(row?.primaryAbilityId)===n||Number(row?.generated?.primaryAbilityId)===n).slice(0,8).map(row=>({key:row.key,name:row.name,reason:row.reason||null,inference:row.inference||null,validationScore:row.validationScore??row?.generated?.validationScore??null}));
  const families=(model?.discovery?.variantFamilies||[]).filter(row=>(row?.encounterMemberIds||row?.memberIds||row?.members?.map(member=>member.id)||[]).map(Number).includes(n)).slice(0,6).map(row=>({key:row.key,tokenGroup:row.tokenGroup,confidence:row.confidence,encounterSupported:row.encounterSupported}));
  return{accepted,rejected,variantFamilies:families};
}

function stateForCandidate(candidate){
  if(!candidate)return'external-evidence-needed';
  if(candidate.validation?.status==='supports'&&candidate.confidence>=.72)return'local-evidence-sufficient';
  if(candidate.validation?.status==='contradicts')return'external-evidence-needed';
  if(candidate.confidence>=.45)return'local-evidence-partial';
  return'external-evidence-needed';
}

export function synthesizeCriticalSignalV1({signal,model,aggregate}){
  const id=Number(signal?.id);
  const train=aggregate?.splits?.train||{},validation=aggregate?.splits?.validation||{};
  const trainSummary=summarizeAbilityStructureV1(train,id);
  const validationSummary=summarizeAbilityStructureV1(validation,id);
  const candidates=buildCandidates({trainSummary,validationSummary,model,validationSplit:validation,id});
  const primary=candidates[0]||null;
  const state=stateForCandidate(primary);
  const missing=[];
  if(!trainSummary)missing.push('train-ability-structure');
  if(!primary)missing.push('deterministic-structural-pattern');
  else if(primary.validation?.status==='unknown')missing.push('decisive-validation-reproduction');
  else if(primary.validation?.status==='contradicts')missing.push('resolve-train-validation-conflict');
  const nextQuestion=state==='local-evidence-sufficient'
    ? 'A narrow structural statement is reproduced locally. Review a separately versioned promotion rule; do not spend WCL yet.'
    : state==='local-evidence-partial'
      ? 'Useful local structure exists, but validation/semantics are incomplete. Keep the signal unresolved and inspect local context before any WCL query.'
      : 'Persisted evidence cannot settle the remaining semantic question. Build a surgical semantic probe only for the explicit missing evidence.';
  return{
    id,
    name:signal?.name||trainSummary?.name||`Ability ${id}`,
    importance:num(signal?.importance),
    origin:signal?.origin||null,
    state,
    primaryHypothesis:primary,
    alternateHypotheses:candidates.slice(1,5),
    train:trainSummary,
    validation:validationSummary,
    context:contextForSignal(model,id),
    missingEvidence:uniq(missing),
    nextQuestion,
    wclCallsExecuted:0,
    changesAcceptedMechanics:false,
    changesScores:false,
  };
}

export function buildLocalMechanicSynthesisV1({model={},aggregate={}}={}){
  const queue=model?.learning?.signalTriage?.criticalLocalQueue||[];
  const signals=queue.map(signal=>synthesizeCriticalSignalV1({signal,model,aggregate}));
  const counts={
    total:signals.length,
    localEvidenceSufficient:signals.filter(row=>row.state==='local-evidence-sufficient').length,
    localEvidencePartial:signals.filter(row=>row.state==='local-evidence-partial').length,
    externalEvidenceNeeded:signals.filter(row=>row.state==='external-evidence-needed').length,
  };
  return{
    version:LOCAL_MECHANIC_SYNTHESIS_VERSION,
    execution:'local-only',
    wclCallsExecuted:0,
    modifiesAcceptedMechanics:false,
    modifiesScores:false,
    counts,
    externalEvidenceTargetAbilityIds:signals.filter(row=>row.state==='external-evidence-needed').map(row=>row.id),
    locallyReviewableAbilityIds:signals.filter(row=>row.state!=='external-evidence-needed').map(row=>row.id),
    signals,
    safety:{
      encounterOriginRequired:true,
      namesDoNotDetermineMeaning:true,
      validationUnknownIsNotSuccess:true,
      noAutomaticPromotion:true,
      noReliabilityImpact:true,
      noDeepCoverageImpact:true,
    },
    nextStep:counts.externalEvidenceNeeded===signals.length&&signals.length
      ? 'All remaining critical encounter signals need a concrete semantic evidence question before any external query.'
      : 'Review locally supported/partial structural hypotheses first. Only external-evidence-needed rows may advance to a surgical semantic probe.',
  };
}
