import { loadLatestOfficialEncounterGraphByWclIdV1 } from '../server/knowledge/official-encounter-store-v1.mjs';
import { buildSpellStructuralKnowledgePreviewV1,resolveSpellStructuralKnowledgeV1 } from '../server/knowledge/spell-structural-knowledge-v1.mjs';
import { loadLatestSpellStructuralKnowledgeV1 } from '../server/knowledge/spell-structural-store-v1.mjs';

function parseArgs(argv){
  const out={abilities:[],directions:'both'};
  for(let i=0;i<argv.length;i++){
    const token=argv[i],next=()=>argv[++i];
    if(token==='--wcl')out.wclEncounterId=Number(next());
    else if(token==='--abilities')out.abilities=String(next()||'').split(',').map(Number).filter(id=>Number.isInteger(id)&&id>0);
    else if(token==='--direction'||token==='--directions')out.directions=String(next()||'both').toLowerCase();
    else if(token==='--help'||token==='-h')out.help=true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return out;
}

function usage(){
  console.log('Usage:\n  npm run validate:spell-structure -- --wcl 3182 --abilities 1243560,1241163,1243866\n\nUses the already-persisted Blizzard official encounter graph to pin the exact WoW client build, then performs bounded Wago DB2 SpellEffect lookups. It never requests WCL combat events or Blizzard network data.');
}

const args=parseArgs(process.argv.slice(2));
if(args.help){usage();process.exit(0);}
if(!Number.isInteger(args.wclEncounterId)||args.wclEncounterId<=0)throw new Error('--wcl must be a positive WCL encounter ID');
if(!args.abilities.length)throw new Error('--abilities must contain at least one positive ability ID');

console.log('\n[1/4] Load persisted official Blizzard graph (0 network)');
const officialGraph=await loadLatestOfficialEncounterGraphByWclIdV1(args.wclEncounterId);
if(!officialGraph)throw new Error(`No persisted official encounter graph for WCL encounter ${args.wclEncounterId}`);
console.log(JSON.stringify({
  wclEncounterId:args.wclEncounterId,
  journalEncounterId:officialGraph.encounter?.journalEncounterId,
  encounterName:officialGraph.encounter?.name,
  namespace:officialGraph.source?.namespace,
  fingerprint:officialGraph.fingerprint,
},null,2));

console.log('\n[2/4] Preview bounded Wago DB2 structural lookup');
const input={wclEncounterId:args.wclEncounterId,seedAbilityIds:args.abilities,directions:args.directions};
const preview=buildSpellStructuralKnowledgePreviewV1(input,officialGraph);
console.log(JSON.stringify({fingerprint:preview.fingerprint,build:preview.officialGraph.build,seedAbilityIds:preview.request.seedAbilityIds,directions:preview.request.directions,networkUpperBound:preview.networkUpperBound},null,2));

console.log('\n[3/4] Resolve + persist build-pinned SpellEffect relations');
const resolved=await resolveSpellStructuralKnowledgeV1(input,{officialGraph});
console.log(JSON.stringify({
  fingerprint:resolved.fingerprint,
  provider:resolved.provider,
  usage:resolved.usage,
  summary:resolved.summary,
  storage:resolved.storage,
  relations:resolved.relations.map(row=>({
    sourceAbilityId:row.sourceAbilityId,
    sourceName:row.sourceName,
    relationKind:row.relationKind,
    targetAbilityId:row.targetAbilityId,
    targetName:row.targetName,
    providerRowId:row.providerRowId,
    officialContext:row.officialContext?.status,
    structuralEvidence:row.structuralEvidence,
  })),
},null,2));

console.log('\n[4/4] Reload persisted structural knowledge (0 network)');
const stored=await loadLatestSpellStructuralKnowledgeV1(args.wclEncounterId);
if(!stored)throw new Error('Persisted structural knowledge reload returned no result');
console.log(JSON.stringify({
  fingerprint:stored.fingerprint,
  fingerprintMatchesResolved:stored.fingerprint===resolved.fingerprint,
  build:stored.provider?.build,
  relations:stored.relations?.length||0,
  providerCalls:0,
  blizzardCalls:0,
  wclCalls:0,
},null,2));

const expected=resolved.relations.find(row=>row.sourceAbilityId===1243560&&row.targetAbilityId===1241163);
if(args.abilities.includes(1243560)&&args.abilities.includes(1241163)){
  console.log('\nBelo-ren fixture check (diagnostic, not a hard generic requirement):');
  console.log(JSON.stringify({relation1243560To1241163:Boolean(expected),relation:expected?{sourceAbilityId:expected.sourceAbilityId,targetAbilityId:expected.targetAbilityId,relationKind:expected.relationKind,providerRowId:expected.providerRowId,officialContext:expected.officialContext?.status}:null},null,2));
}

console.log('\nOK: build-pinned spell structural smoke validation completed. No WCL combat-event or Blizzard network request was made by this command.');
