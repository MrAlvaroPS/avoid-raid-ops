import { createHash } from 'node:crypto';
import { corpusGet, corpusSet } from './storage.mjs';
import { aggregateKey, corpusId } from './keys.mjs';
import { getBossSamplingManifest, loadOperationalEncounterModelV2 } from './service-v2.mjs';
import { getOperationalExecutionV1 } from '../engines/operational-execution-v1.mjs';

export const OPERATIONAL_READINESS_VERSION='global-boss-operational-readiness-v3';
export const OPERATIONAL_REHEARSAL_DEFAULTS=Object.freeze({reports:3,minSuccessfulReports:2,minObservedMechanics:3,minCoveragePct:30,maxTruncatedReports:0});

const positive=(value,label)=>{const n=Number(value);if(!Number.isInteger(n)||n<=0)throw new Error(`${label} is required`);return n;};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
const digest=value=>createHash('sha1').update(JSON.stringify(stable(value))).digest('hex');
const readinessKey=args=>`operational-readiness/${corpusId(args)}.json`;
const hasTruncation=value=>value&&typeof value==='object'&&Object.entries(value).some(([key,row])=>key==='truncated'?row===true:hasTruncation(row));
const observed=row=>Number(row?.opportunities||0)>0||Number(row?.observedIncidents||0)>0||Number(row?.failedOccurrences||0)>0||Number(row?.failures||0)>0||Number(row?.evidenceCount||0)>0;
const isWcl429=error=>Number(error?.status)===429||/WCL GraphQL 429|"status"\s*:\s*429|Too many requests from this IP address/i.test(String(error?.message||error||''));
const idFields=['castIds','opportunityCastIds','damageIds','failureDamageIds','failureAuraIds'];
const sum=(...values)=>values.reduce((total,value)=>total+(Number(value)||0),0);

function chooseReports(codes=[],scope,count=3){
  return [...new Set((codes||[]).map(String).filter(Boolean))]
    .map(code=>({code,rank:digest({scope,code})}))
    .sort((a,b)=>a.rank.localeCompare(b.rank))
    .slice(0,Math.max(1,Number(count)||3))
    .map(row=>row.code);
}

async function resolveOperationalScope(input={}){
  const encounterId=positive(input.encounterId,'encounterId'),difficulty=positive(input.difficulty,'difficulty');
  const operational=await loadOperationalEncounterModelV2({encounterId,difficulty,partition:Number(input.partition||0)}).catch(()=>null);
  if(!operational?.operationalReference?.scope)return{encounterId,difficulty,partition:Number(input.partition||0),operational:null};
  return{...operational.operationalReference.scope,operational};
}

function combineOrigin(aggregate,id){
  const rows=['train','validation'].map(split=>aggregate?.splits?.[split]?.originEvidence?.[String(id)]).filter(Boolean);
  if(!rows.length)return null;
  return{
    reportsWithEvidence:rows.reduce((n,row)=>n+Number(row.reportsWithEvidence||0),0),
    events:rows.reduce((n,row)=>n+Number(row.events||0),0),
    friendlySourceEvents:rows.reduce((n,row)=>n+Number(row.friendlySourceEvents||0),0),
    encounterOrUnknownSourceEvents:rows.reduce((n,row)=>n+Number(row.encounterOrUnknownSourceEvents||0),0),
    unknownSourceEvents:rows.reduce((n,row)=>n+Number(row.unknownSourceEvents||0),0),
  };
}
function abilityEvidence(aggregate,id){
  const train=aggregate?.splits?.train?.abilities?.[String(id)]||null,validation=aggregate?.splits?.validation?.abilities?.[String(id)]||null,a=train||validation;
  if(!a)return{id:Number(id),presentInAggregate:false,origin:combineOrigin(aggregate,id)};
  const wideKind=kind=>({reportsWith:sum(train?.wide?.kill?.[kind]?.reportsWith,train?.wide?.wipe?.[kind]?.reportsWith,validation?.wide?.kill?.[kind]?.reportsWith,validation?.wide?.wipe?.[kind]?.reportsWith),count:sum(train?.wide?.kill?.[kind]?.count,train?.wide?.wipe?.[kind]?.count,validation?.wide?.kill?.[kind]?.count,validation?.wide?.wipe?.[kind]?.count)});
  const deepSide=key=>sum(train?.deep?.kill?.[key],train?.deep?.wipe?.[key],validation?.deep?.kill?.[key],validation?.deep?.wipe?.[key]);
  return{id:Number(id),name:a.name||null,presentInAggregate:true,wide:{casts:wideKind('Casts'),damage:wideKind('Damage'),debuffs:wideKind('Debuffs'),buffs:wideKind('Buffs')},deep:{begins:deepSide('begins'),casts:deepSide('casts'),damageHits:deepSide('damageHits'),damageOccurrences:deepSide('damageOccurrences'),enemyBuffApplications:deepSide('enemyBuffApplications'),enemyDebuffApplications:deepSide('enemyDebuffApplications')},origin:combineOrigin(aggregate,id)};
}
function packDiagnostics(pack,aggregate){
  const stateIds=[...new Set((pack?.stateDimensions||[]).flatMap(dim=>Object.values(dim?.values||{}).flatMap(value=>value?.ids||[])).map(Number).filter(Number.isFinite))];
  return{
    mechanics:(pack?.mechanics||[]).map(mechanic=>{
      const ids=Object.fromEntries(idFields.map(field=>[field,[...new Set((mechanic?.[field]||[]).map(Number).filter(Number.isFinite))]]));
      const allIds=[...new Set([...Object.values(ids).flat(),...(mechanic?.requiredState?stateIds:[])])];
      return{key:mechanic.key||null,name:mechanic.name||null,category:mechanic.category||null,inference:mechanic.inference||null,scoreable:Boolean(mechanic.scoreable),ids,generatedPrimaryAbilityId:Number(mechanic?.generated?.primaryAbilityId)||null,abilityEvidence:allIds.map(id=>abilityEvidence(aggregate,id))};
    }),
    stateDimensionIds:stateIds,
    diagnosticContract:{zeroNetwork:true,aggregateEvidenceOnly:true,doesNotReclassify:true,doesNotPromote:true},
  };
}

export async function loadOperationalReadinessV1(input={}){
  const scope=await resolveOperationalScope(input);if(!scope.operational||!(Number(scope.partition)>0))return null;
  return corpusGet(readinessKey(scope));
}

export async function previewOperationalRehearsalV1(input={}){
  const scope=await resolveOperationalScope(input),reports=Math.max(1,Math.min(8,Number(input.reports)||OPERATIONAL_REHEARSAL_DEFAULTS.reports));
  if(!scope.operational)return{version:OPERATIONAL_READINESS_VERSION,status:'data-not-ready',scope:{encounterId:scope.encounterId,difficulty:scope.difficulty,partition:scope.partition||null},dataReady:false,mechanicCoverageReady:false,liveReady:false,selectedReports:[],networkExecuted:false,networkUpperBound:{operationalExecutionRuns:0},reason:'A fail-closed Operational Reference is not available yet.'};
  const [manifest,stored,aggregate]=await Promise.all([getBossSamplingManifest(scope),corpusGet(readinessKey(scope)),corpusGet(aggregateKey(scope))]);
  const selectedReports=chooseReports(manifest?.selectedWideCodes||[],scope,reports);
  const operationalModelFingerprint=digest({
    scope:{encounterId:Number(scope.encounterId),difficulty:Number(scope.difficulty),partition:Number(scope.partition)},
    pack:scope.operational?.pack||null,
    knowledgeContract:scope.operational?.knowledgeContract||null,
    operationalReference:scope.operational?.operationalReference||null,
    sampling:{policyVersion:manifest?.policyVersion||null,contractVersion:manifest?.contractVersion||null,selectedWideCodes:manifest?.selectedWideCodes||[],selectedDeepCodes:manifest?.selectedDeepCodes||[]},
  });
  const request={version:OPERATIONAL_READINESS_VERSION,scope:{encounterId:Number(scope.encounterId),difficulty:Number(scope.difficulty),partition:Number(scope.partition)},operationalReferenceVersion:scope.operational.operationalReference?.version||null,operationalModelFingerprint,samplingPolicyVersion:manifest?.policyVersion||null,selectedReports};
  const fingerprint=digest(request),storedCurrent=String(stored?.rehearsalFingerprint||'')===fingerprint;
  return{version:OPERATIONAL_READINESS_VERSION,status:storedCurrent?(stored?.status||'rehearsal-required'):'rehearsal-required',fingerprint,operationalModelFingerprint,scope:request.scope,dataReady:true,mechanicCoverageReady:storedCurrent&&stored?.mechanicCoverageReady===true,liveReady:storedCurrent&&stored?.liveReady===true,operationalReference:scope.operational.operationalReference,sampling:{wideReports:Number(manifest?.wide?.reports||0),wideSources:Number(manifest?.wide?.sources||0),deepReports:Number(manifest?.deep?.reports||0),deepSources:Number(manifest?.deep?.sources||0)},selectedReports,packDiagnostics:packDiagnostics(scope.operational?.pack,aggregate),stored:storedCurrent?stored:null,storedPrevious:storedCurrent?null:(stored||null),networkExecuted:false,networkUpperBound:{operationalExecutionRuns:selectedReports.length},evidenceContract:{deterministicCanonicalReports:true,reportSelectionUsesPerformance:false,externalReportsNeverEnterHomeExecution:true,rehearsalDoesNotTrain:true,rehearsalDoesNotPromote:true,sameDifficultyOnly:true,staleCoverageReviewCannotBlockChangedModel:true,packDiagnosticsFromPersistedAggregate:true,wcl429NeverBecomesCoverageEvidence:true}};
}

function summarizeRun(result){
  const mechanics=result?.mechanics?.mechanics||[],observedRows=mechanics.filter(observed),denominatorRows=mechanics.filter(row=>Number(row?.opportunities||0)>0&&row?.denominatorStatus!=='pending');
  return{reportCode:result?.report?.code||null,status:result?.status||'unknown',homeRaidEligible:Boolean(result?.raidKnowledge?.homeRaidEligible),encounterId:Number(result?.encounter?.id||0)||null,difficulty:Number(result?.encounter?.difficulty||0)||null,packMechanics:Number(result?.rulePack?.mechanics||mechanics.length||0),observedMechanics:observedRows.map(row=>row.key),denominatorMechanics:denominatorRows.map(row=>row.key),classifiedFailures:Number(result?.mechanics?.failures?.length||0),eligiblePulls:Number(result?.analysisPopulation?.eligiblePulls||0),truncated:hasTruncation(result?.dataCompleteness),packSource:result?.rulePack?.source||null};
}

export async function executeOperationalRehearsalV1(input={}){
  if(input.confirmExecution!==true)throw new Error('confirmExecution:true is required for Operational Rehearsal');
  const preview=await previewOperationalRehearsalV1(input);if(!preview.dataReady)throw new Error('Operational Reference is not DATA READY');
  if(String(input.previewFingerprint)!==String(preview.fingerprint))throw new Error('Operational Rehearsal preview fingerprint mismatch');
  if(!preview.selectedReports.length)throw new Error('Canonical sampling has no external rehearsal reports');
  const runs=[];
  for(const code of preview.selectedReports){
    try{const result=await getOperationalExecutionV1({reportCode:code,encounterId:preview.scope.encounterId,difficulty:preview.scope.difficulty});runs.push(summarizeRun(result));}
    catch(error){if(isWcl429(error))throw error;runs.push({reportCode:code,status:'error',error:error instanceof Error?error.message:String(error),homeRaidEligible:false,packMechanics:0,observedMechanics:[],denominatorMechanics:[],classifiedFailures:0,eligiblePulls:0,truncated:false,packSource:null});}
  }
  const safe=runs.filter(row=>row.status==='ready'&&!row.homeRaidEligible&&Number(row.encounterId)===preview.scope.encounterId&&Number(row.difficulty)===preview.scope.difficulty),observedKeys=new Set(safe.flatMap(row=>row.observedMechanics||[])),denominatorKeys=new Set(safe.flatMap(row=>row.denominatorMechanics||[])),packMechanics=Math.max(0,...safe.map(row=>Number(row.packMechanics||0))),truncatedReports=safe.filter(row=>row.truncated).length,coveragePct=packMechanics?Math.round(observedKeys.size/packMechanics*1000)/10:0;
  const thresholds={...OPERATIONAL_REHEARSAL_DEFAULTS,...(input.thresholds||{}),minSuccessfulReports:Math.min(Number(input.thresholds?.minSuccessfulReports||OPERATIONAL_REHEARSAL_DEFAULTS.minSuccessfulReports),preview.selectedReports.length),minObservedMechanics:Math.min(Number(input.thresholds?.minObservedMechanics||OPERATIONAL_REHEARSAL_DEFAULTS.minObservedMechanics),packMechanics||Number(input.thresholds?.minObservedMechanics||OPERATIONAL_REHEARSAL_DEFAULTS.minObservedMechanics))};
  const checks={successfulReports:safe.length>=thresholds.minSuccessfulReports,observedMechanics:observedKeys.size>=thresholds.minObservedMechanics,coveragePct:coveragePct>=thresholds.minCoveragePct,truncation:truncatedReports<=thresholds.maxTruncatedReports,externalOnly:runs.every(row=>row.homeRaidEligible!==true),sameDifficulty:safe.every(row=>Number(row.difficulty)===preview.scope.difficulty)};
  const mechanicCoverageReady=Object.values(checks).every(Boolean),record={version:OPERATIONAL_READINESS_VERSION,generatedAt:Date.now(),status:mechanicCoverageReady?'live-ready':'coverage-review',scope:preview.scope,rehearsalFingerprint:preview.fingerprint,operationalModelFingerprint:preview.operationalModelFingerprint,dataReady:true,mechanicCoverageReady,liveReady:mechanicCoverageReady,thresholds,checks,coverage:{selectedReports:preview.selectedReports.length,successfulReports:safe.length,errorReports:runs.length-safe.length,packMechanics,observedMechanics:observedKeys.size,denominatorMechanics:denominatorKeys.size,coveragePct,truncatedReports,classifiedFailures:safe.reduce((sum,row)=>sum+Number(row.classifiedFailures||0),0),eligiblePulls:safe.reduce((sum,row)=>sum+Number(row.eligiblePulls||0),0)},runs,operationalReference:preview.operationalReference,evidenceContract:{dataReadyDoesNotImplyLiveReady:true,deterministicCanonicalReports:true,reportSelectionUsesPerformance:false,externalReportsNeverEnterHomeExecution:true,rehearsalDoesNotTrain:true,rehearsalDoesNotPromote:true,sameDifficultyOnly:true,wcl429NeverBecomesCoverageEvidence:true,automaticPromotion:false}};
  await corpusSet(readinessKey(preview.scope),record);return record;
}
