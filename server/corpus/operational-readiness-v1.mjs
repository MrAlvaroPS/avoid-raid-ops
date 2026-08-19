import { createHash } from 'node:crypto';
import { corpusGet, corpusSet } from './storage.mjs';
import { corpusId } from './keys.mjs';
import { getBossSamplingManifest, loadOperationalEncounterModelV2 } from './service-v2.mjs';
import { getOperationalExecutionV1 } from '../engines/operational-execution-v1.mjs';

export const OPERATIONAL_READINESS_VERSION='global-boss-operational-readiness-v1';
export const OPERATIONAL_REHEARSAL_DEFAULTS=Object.freeze({reports:3,minSuccessfulReports:2,minObservedMechanics:3,minCoveragePct:30,maxTruncatedReports:0});

const positive=(value,label)=>{const n=Number(value);if(!Number.isInteger(n)||n<=0)throw new Error(`${label} is required`);return n;};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
const digest=value=>createHash('sha1').update(JSON.stringify(stable(value))).digest('hex');
const readinessKey=args=>`operational-readiness/${corpusId(args)}.json`;
const hasTruncation=value=>value&&typeof value==='object'&&Object.entries(value).some(([key,row])=>key==='truncated'?row===true:hasTruncation(row));
const observed=row=>Number(row?.opportunities||0)>0||Number(row?.observedIncidents||0)>0||Number(row?.failedOccurrences||0)>0||Number(row?.failures||0)>0||Number(row?.evidenceCount||0)>0;

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

export async function loadOperationalReadinessV1(input={}){
  const scope=await resolveOperationalScope(input);if(!scope.operational||!(Number(scope.partition)>0))return null;
  return corpusGet(readinessKey(scope));
}

export async function previewOperationalRehearsalV1(input={}){
  const scope=await resolveOperationalScope(input),reports=Math.max(1,Math.min(8,Number(input.reports)||OPERATIONAL_REHEARSAL_DEFAULTS.reports));
  if(!scope.operational)return{version:OPERATIONAL_READINESS_VERSION,status:'data-not-ready',scope:{encounterId:scope.encounterId,difficulty:scope.difficulty,partition:scope.partition||null},dataReady:false,mechanicCoverageReady:false,liveReady:false,selectedReports:[],networkExecuted:false,networkUpperBound:{operationalExecutionRuns:0},reason:'A fail-closed Operational Reference is not available yet.'};
  const manifest=await getBossSamplingManifest(scope),selectedReports=chooseReports(manifest?.selectedWideCodes||[],scope,reports),stored=await corpusGet(readinessKey(scope));
  const request={version:OPERATIONAL_READINESS_VERSION,scope:{encounterId:Number(scope.encounterId),difficulty:Number(scope.difficulty),partition:Number(scope.partition)},operationalReferenceVersion:scope.operational.operationalReference?.version||null,samplingPolicyVersion:manifest?.policyVersion||null,selectedReports};
  return{version:OPERATIONAL_READINESS_VERSION,status:stored?.status||'rehearsal-required',fingerprint:digest(request),scope:request.scope,dataReady:true,mechanicCoverageReady:stored?.mechanicCoverageReady===true,liveReady:stored?.liveReady===true,operationalReference:scope.operational.operationalReference,sampling:{wideReports:Number(manifest?.wide?.reports||0),wideSources:Number(manifest?.wide?.sources||0),deepReports:Number(manifest?.deep?.reports||0),deepSources:Number(manifest?.deep?.sources||0)},selectedReports,stored:stored||null,networkExecuted:false,networkUpperBound:{operationalExecutionRuns:selectedReports.length},evidenceContract:{deterministicCanonicalReports:true,reportSelectionUsesPerformance:false,externalReportsNeverEnterHomeExecution:true,rehearsalDoesNotTrain:true,rehearsalDoesNotPromote:true,sameDifficultyOnly:true}};
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
    catch(error){runs.push({reportCode:code,status:'error',error:error instanceof Error?error.message:String(error),homeRaidEligible:false,packMechanics:0,observedMechanics:[],denominatorMechanics:[],classifiedFailures:0,eligiblePulls:0,truncated:false,packSource:null});}
  }
  const safe=runs.filter(row=>row.status==='ready'&&!row.homeRaidEligible&&Number(row.encounterId)===preview.scope.encounterId&&Number(row.difficulty)===preview.scope.difficulty),observedKeys=new Set(safe.flatMap(row=>row.observedMechanics||[])),denominatorKeys=new Set(safe.flatMap(row=>row.denominatorMechanics||[])),packMechanics=Math.max(0,...safe.map(row=>Number(row.packMechanics||0))),truncatedReports=safe.filter(row=>row.truncated).length,coveragePct=packMechanics?Math.round(observedKeys.size/packMechanics*1000)/10:0;
  const thresholds={...OPERATIONAL_REHEARSAL_DEFAULTS,...(input.thresholds||{}),minSuccessfulReports:Math.min(Number(input.thresholds?.minSuccessfulReports||OPERATIONAL_REHEARSAL_DEFAULTS.minSuccessfulReports),preview.selectedReports.length),minObservedMechanics:Math.min(Number(input.thresholds?.minObservedMechanics||OPERATIONAL_REHEARSAL_DEFAULTS.minObservedMechanics),packMechanics||Number(input.thresholds?.minObservedMechanics||OPERATIONAL_REHEARSAL_DEFAULTS.minObservedMechanics))};
  const checks={successfulReports:safe.length>=thresholds.minSuccessfulReports,observedMechanics:observedKeys.size>=thresholds.minObservedMechanics,coveragePct:coveragePct>=thresholds.minCoveragePct,truncation:truncatedReports<=thresholds.maxTruncatedReports,externalOnly:runs.every(row=>row.homeRaidEligible!==true),sameDifficulty:safe.every(row=>Number(row.difficulty)===preview.scope.difficulty)};
  const mechanicCoverageReady=Object.values(checks).every(Boolean),record={version:OPERATIONAL_READINESS_VERSION,generatedAt:Date.now(),status:mechanicCoverageReady?'live-ready':'coverage-review',scope:preview.scope,dataReady:true,mechanicCoverageReady,liveReady:mechanicCoverageReady,thresholds,checks,coverage:{selectedReports:preview.selectedReports.length,successfulReports:safe.length,errorReports:runs.length-safe.length,packMechanics,observedMechanics:observedKeys.size,denominatorMechanics:denominatorKeys.size,coveragePct,truncatedReports,classifiedFailures:safe.reduce((sum,row)=>sum+Number(row.classifiedFailures||0),0),eligiblePulls:safe.reduce((sum,row)=>sum+Number(row.eligiblePulls||0),0)},runs,operationalReference:preview.operationalReference,evidenceContract:{dataReadyDoesNotImplyLiveReady:true,deterministicCanonicalReports:true,reportSelectionUsesPerformance:false,externalReportsNeverEnterHomeExecution:true,rehearsalDoesNotTrain:true,rehearsalDoesNotPromote:true,sameDifficultyOnly:true,automaticPromotion:false}};
  await corpusSet(readinessKey(preview.scope),record);return record;
}
