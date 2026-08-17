import { reportSourceKey } from './aggregate.mjs';

export const SEMANTIC_SURGICAL_PROBE_PLAN_V2_VERSION='semantic-surgical-probe-plan-v2';
export const SEMANTIC_PROBE_EVIDENCE_SELECTION_VERSION='semantic-probe-evidence-selection-v1';

const num=value=>Number.isFinite(Number(value))?Number(value):0;
const uniq=values=>[...new Set((values||[]).filter(value=>value!==null&&value!==undefined))];
const ids=values=>uniq((values||[]).map(Number).filter(value=>Number.isFinite(value)&&value>0));

function targetRows(model={}){
  const synthesis=model?.learning?.localMechanicSynthesis||{};
  return (synthesis.signals||[])
    .filter(row=>row?.state==='external-evidence-needed')
    .map(row=>({
      id:Number(row.id),
      name:row.name||`Ability ${row.id}`,
      importance:num(row.importance),
      missingEvidence:row.missingEvidence||[],
      nextQuestion:row.nextQuestion||null,
      origin:row.origin||null,
      localContext:row.context||null,
    }))
    .filter(row=>Number.isFinite(row.id)&&row.id>0);
}

function familyMemberIds(model={},targetId){
  const out=[];
  for(const family of model?.discovery?.variantFamilies||[]){
    const members=ids(family?.encounterMemberIds||family?.memberIds||family?.members?.map(member=>member?.id));
    if(!members.includes(Number(targetId)))continue;
    out.push(...members.filter(id=>id!==Number(targetId)));
  }
  return ids(out);
}

function relationNeighborIds(model={},targetId){
  const out=[];
  for(const relation of [...(model?.discovery?.relationCandidates||[]),...(model?.discovery?.filteredRelationCandidates||[])]){
    const target=Number(relation?.targetId);
    const triggers=ids(relation?.triggerCastIds||[]);
    if(target===Number(targetId))out.push(...triggers);
    if(triggers.includes(Number(targetId))&&Number.isFinite(target)&&target>0)out.push(target);
  }
  return ids(out);
}

function rejectedNeighborIds(model={},targetId){
  const out=[];
  for(const row of model?.rejected||[]){
    const primary=Number(row?.primaryAbilityId??row?.generated?.primaryAbilityId);
    const fields=ids([
      ...(row?.castIds||[]),...(row?.damageIds||[]),...(row?.failureDamageIds||[]),
      ...(row?.failureAuraIds||[]),...(row?.auraIds||[]),...(row?.triggerCastIds||[]),
      ...(row?.stateValueIds||[]),...(row?.generated?.castIds||[]),...(row?.generated?.damageIds||[]),
      ...(row?.generated?.failureDamageIds||[]),...(row?.generated?.failureAuraIds||[]),
      ...(row?.generated?.triggerCastIds||[]),...(row?.generated?.stateValueIds||[]),
    ]);
    if(primary===Number(targetId)||fields.includes(Number(targetId))){
      if(Number.isFinite(primary)&&primary>0&&primary!==Number(targetId))out.push(primary);
      out.push(...fields.filter(id=>id!==Number(targetId)));
    }
  }
  return ids(out);
}

function contextAbilityIds(model={},targetId,max=12){
  return ids([
    ...relationNeighborIds(model,targetId),
    ...familyMemberIds(model,targetId),
    ...rejectedNeighborIds(model,targetId),
  ]).filter(id=>id!==Number(targetId)).slice(0,Math.max(0,Number(max)||12));
}

function profileTargetEvidence(profile={},targetId){
  const key=String(targetId);
  const originEvents=num(profile?.originEvidence?.[key]?.events);
  let tablePresence=false;
  for(const table of Object.values(profile?.tables||{})){
    const row=table?.[key];
    if(row&&(num(row.count)>0||num(row.total)>0||num(row.rows)>0)){tablePresence=true;break;}
  }
  return{
    originEvents,
    tablePresence,
    hasTarget:originEvents>0||tablePresence,
    presenceKind:originEvents>0?'persisted-origin-events':tablePresence?'report-table-presence':'none',
  };
}

function completeDeep(profile={}){
  const required=['enemyCasts','friendDamage','interrupts','debuffs','buffs','enemyBuffs','enemyDebuffs','deaths'];
  return required.every(key=>profile?.completeness?.[key]===true);
}

function canonicalPool(profiles=[],selectedCodes=[]){
  const selected=new Set((selectedCodes||[]).map(String).filter(Boolean));
  return (profiles||[]).filter(profile=>profile?.code&&(!selected.size||selected.has(String(profile.code))));
}

function canonicalDeepPool(deepProfiles=[],selectedWideCodes=[],selectedDeepCodes=[]){
  const wide=new Set((selectedWideCodes||[]).map(String).filter(Boolean));
  const deep=new Set((selectedDeepCodes||[]).map(String).filter(Boolean));
  if(!deep.size)return[];
  return (deepProfiles||[]).filter(profile=>{
    const code=String(profile?.code||'');
    if(!code||!completeDeep(profile))return false;
    if(wide.size&&!wide.has(code))return false;
    if(!deep.has(code))return false;
    return true;
  });
}

function selectionCandidates({widePool=[],deepPool=[],targetId}){
  const byCode=new Map();
  const add=(profile,tier,tierLabel,canonicalDeepSelected)=>{
    const evidence=profileTargetEvidence(profile,targetId);
    if(!evidence.hasTarget)return;
    const code=String(profile.code);
    const row={
      profile,
      source:reportSourceKey(profile),
      tier,
      tierLabel,
      canonicalDeepSelected,
      completeCanonicalDeep:completeDeep(profile),
      targetEvidence:evidence,
      rank:tier*1_000_000+evidence.originEvents*100+num(profile?.deepPulls||profile?.fights?.length),
    };
    const previous=byCode.get(code);
    if(!previous||row.rank>previous.rank)byCode.set(code,row);
  };

  for(const profile of deepPool){
    const evidence=profileTargetEvidence(profile,targetId);
    add(profile,evidence.originEvents>0?3:2,evidence.originEvents>0?'canonical-deep-target-events':'canonical-deep-report-presence',true);
  }
  for(const profile of widePool)add(profile,1,'canonical-wide-report-presence',false);

  return [...byCode.values()]
    .filter(row=>row.source)
    .sort((a,b)=>b.rank-a.rank||String(a.source).localeCompare(String(b.source))||String(a.profile.code).localeCompare(String(b.profile.code)));
}

function fightBand(fight={}){
  if(fight.kill)return'kill';
  const remaining=Number(fight.fightPercentage??fight.bossPercentage);
  if(!Number.isFinite(remaining))return'unknown';
  if(remaining<=35)return'deep-wipe';
  if(remaining<=70)return'mid-wipe';
  return'early-wipe';
}

function balancedFightIDs(profile={},max=6){
  const limit=Math.max(1,Math.min(8,Number(max)||6));
  const fights=(profile?.fights||[]).filter(fight=>Number.isFinite(Number(fight?.id)));
  const buckets={kill:[], 'deep-wipe':[], 'mid-wipe':[], 'early-wipe':[], unknown:[]};
  for(const fight of fights)buckets[fightBand(fight)].push(fight);
  for(const bucket of Object.values(buckets))bucket.sort((a,b)=>Number(a.fightPercentage??100)-Number(b.fightPercentage??100)||Number(a.id)-Number(b.id));
  const chosen=[];
  for(const key of ['deep-wipe','mid-wipe','early-wipe','kill','unknown']){
    const row=buckets[key]?.shift();if(row)chosen.push(row);
    if(chosen.length>=limit)return chosen.map(row=>Number(row.id));
  }
  const rest=Object.values(buckets).flat().sort((a,b)=>Number(a.fightPercentage??100)-Number(b.fightPercentage??100)||Number(a.id)-Number(b.id));
  for(const fight of rest){if(chosen.length>=limit)break;chosen.push(fight);}
  return ids(chosen.map(row=>row.id));
}

function filterForIds(abilityIds=[]){
  const values=ids(abilityIds);
  return values.length?`ability.id IN (${values.join(',')})`:null;
}

export function buildSemanticSurgicalProbePlanV2({
  model={},aggregate={},wideProfiles=[],deepProfiles=[],encounterId=0,difficulty=5,partition=0,
  maxSignals=3,maxSourcesPerSignal=5,maxFightsPerSource=6,maxContextAbilityIds=12,
}={}){
  const selectedWideCodes=aggregate?.sampling?.selectedWideCodes||[];
  const selectedDeepCodes=aggregate?.sampling?.selectedDeepCodes||[];
  const widePool=canonicalPool(wideProfiles,selectedWideCodes);
  const deepPool=canonicalDeepPool(deepProfiles,selectedWideCodes,selectedDeepCodes);
  const targets=targetRows(model).slice(0,Math.max(1,Number(maxSignals)||3));
  const signals=[];

  for(const target of targets){
    const contextIds=contextAbilityIds(model,target.id,maxContextAbilityIds);
    const candidates=selectionCandidates({widePool,deepPool,targetId:target.id});
    const deepTargetCandidates=candidates.filter(row=>row.tier>=2).length;
    const deepTargetEventCandidates=candidates.filter(row=>row.tier===3).length;
    const wideFallbackCandidates=candidates.filter(row=>row.tier===1).length;
    const seenSources=new Set(),anchorRequests=[];

    for(const row of candidates){
      if(seenSources.has(row.source))continue;
      const fightIDs=balancedFightIDs(row.profile,maxFightsPerSource);
      if(!fightIDs.length)continue;
      seenSources.add(row.source);
      anchorRequests.push({
        stage:'anchor-occurrences',
        reportCode:String(row.profile.code),
        source:row.source,
        fightIDs,
        selectionEvidence:{
          policyVersion:SEMANTIC_PROBE_EVIDENCE_SELECTION_VERSION,
          selectionTier:row.tierLabel,
          targetPresenceKind:row.targetEvidence.presenceKind,
          persistedTargetEvents:row.targetEvidence.originEvents,
          completeCanonicalDeep:row.completeCanonicalDeep,
          canonicalDeepSelected:row.canonicalDeepSelected,
        },
        question:`Locate exact ${target.name} occurrences and retain timestamp, event type, source and target identity inside selected canonical fights.`,
        queryShape:{
          encounterID:Number(encounterId)||null,
          difficulty:Number(difficulty)||5,
          partition:Number(partition)||0,
          fightIDs,
          abilityID:target.id,
          filterExpression:filterForIds([target.id]),
          startTime:null,
          endTime:null,
          phase:null,
          sourceID:null,
          targetID:null,
          includeResources:false,
          limit:1000,
        },
        evidenceClass:'diagnostic-semantic-surgical',
        canonicalCoverageContribution:{deepReports:0,deepPulls:0},
        executesWcl:false,
      });
      if(anchorRequests.length>=Math.max(1,Number(maxSourcesPerSignal)||5))break;
    }

    signals.push({
      ...target,
      semanticQuestion:`What repeatable encounter event/actor/target pattern surrounds ${target.name}, and does the same upstream context reproduce across independent sources?`,
      contextAbilityIds:contextIds,
      contextAbilityFilterExpression:filterForIds(contextIds),
      candidateEvidence:{
        canonicalDeepTargetReports:deepTargetCandidates,
        canonicalDeepTargetEventReports:deepTargetEventCandidates,
        canonicalWideFallbackReports:wideFallbackCandidates,
      },
      selectedSources:anchorRequests.length,
      requestedSources:Math.max(1,Number(maxSourcesPerSignal)||5),
      sourceShortfall:Math.max(0,Math.max(1,Number(maxSourcesPerSignal)||5)-anchorRequests.length),
      anchorRequests,
      followUpTemplate:{
        stage:'temporal-context',
        onlyAfterAnchorOccurrence:true,
        oneWindowPerAnchorOccurrence:true,
        timeWindowMs:{before:5000,after:5000},
        preserveReportCode:true,
        preserveExactFightID:true,
        includeResources:false,
        preferredContextAbilityIds:contextIds,
        preferredFilterExpression:filterForIds(contextIds),
        fallbackWhenNoContextAbilityIds:'Query only a ±5s exact-fight event window around the anchor and retain encounter cast/aura/damage event identity. Do not broaden to the report.',
        requiredFields:['timestamp','type','ability.id','sourceID','targetID','fightID'],
      },
      verificationContract:{
        version:'semantic-surgical-verification-v1',
        minimumIndependentSources:3,
        minimumAnchorOccurrences:6,
        sourceReproductionRequired:true,
        noNameBasedSemantics:true,
        noAutomaticMechanicPromotion:true,
        noDirectScoreChange:true,
        acceptableOutcome:'Identify a reproducible temporal/actor relationship or conclude that the sampled evidence remains semantically unresolved.',
        promotionBoundary:'Any conversion into an accepted mechanic requires a separately versioned promotion contract and validation; this plan can only produce diagnostic semantic evidence.',
      },
      reportLevelPresenceCaveat:'Canonical Deep with persisted target events is selected first. Wide report-level presence is only a fallback because it cannot prove which exact fight contains the target event.',
    });
  }

  const plannedAnchorRequests=signals.reduce((sum,row)=>sum+row.anchorRequests.length,0);
  return{
    version:SEMANTIC_SURGICAL_PROBE_PLAN_V2_VERSION,
    evidenceSelectionVersion:SEMANTIC_PROBE_EVIDENCE_SELECTION_VERSION,
    dryRun:true,
    executesWcl:false,
    wclCallsExecuted:0,
    scope:{encounterId:Number(encounterId),difficulty:Number(difficulty)||5,partition:Number(partition)||0},
    canonicalWideOnly:Boolean(selectedWideCodes.length),
    canonicalWideReportsInPool:widePool.length,
    canonicalDeepManifestAvailable:Boolean(selectedDeepCodes.length),
    canonicalDeepReportsInPool:deepPool.length,
    targetSignals:signals.length,
    plannedAnchorRequests,
    signals,
    evidenceContract:{
      class:'diagnostic-semantic-surgical',
      countsTowardDeepReports:false,
      countsTowardDeepPulls:false,
      canChangeScoresDirectly:false,
      canPromoteMechanics:false,
    },
    safety:{
      exactFightIDs:true,
      independentSourceFirst:true,
      canonicalDeepLoaded:true,
      canonicalDeepPreferredForSelection:true,
      wideFallbackOnlyAfterDeep:true,
      noWholeReportFallback:true,
      includeResources:false,
      executorImplemented:false,
    },
    nextStep:signals.length
      ? 'Review the Deep-first anchor and temporal-context plan. Execution is intentionally not implemented in v2.'
      : 'No local-synthesis signal is currently marked external-evidence-needed.',
  };
}
