import { buildOfficialEncounterKnowledgePreviewV1,resolveOfficialEncounterKnowledgeV1 } from '../server/knowledge/official-encounter-knowledge-v1.mjs';
import { loadLatestOfficialEncounterGraphByWclIdV1 } from '../server/knowledge/official-encounter-store-v1.mjs';
import { resolveAbilityKnowledgeV1 } from '../server/knowledge/ability-knowledge-v1.mjs';
import { reconcileOfficialEncounterAbilitiesV1 } from '../server/knowledge/official-encounter-reconciliation-v1.mjs';

function parseArgs(argv){
  const out={abilities:[]};
  for(let i=0;i<argv.length;i++){
    const token=argv[i];
    const next=()=>argv[++i];
    if(token==='--name')out.encounterName=next();
    else if(token==='--journal')out.journalEncounterId=Number(next());
    else if(token==='--wcl')out.wclEncounterId=Number(next());
    else if(token==='--region')out.region=next();
    else if(token==='--locale')out.locale=next();
    else if(token==='--abilities')out.abilities=String(next()||'').split(',').map(Number).filter(Number.isInteger);
    else if(token==='--help'||token==='-h')out.help=true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return out;
}

function usage(){
  console.log(`Usage:\n  npm run validate:official-encounter -- --name "Encounter Name" --wcl 1234 --abilities 111,222,333\n\nAlternative:\n  npm run validate:official-encounter -- --journal 5678 --wcl 1234 --abilities 111,222\n\nThis command:\n  1. previews the exact Blizzard request;\n  2. resolves and persists the official Journal graph;\n  3. reloads it by WCL encounter ID with zero provider/WCL calls;\n  4. resolves supplied ability IDs from stored official knowledge only;\n  5. compares supplied ability pairs in the official hierarchy.\n`);
}

const args=parseArgs(process.argv.slice(2));
if(args.help){usage();process.exit(0);}
if(!args.encounterName&&!args.journalEncounterId){usage();throw new Error('--name or --journal is required');}
if(!Number.isInteger(args.wclEncounterId)||args.wclEncounterId<=0)throw new Error('--wcl must be a positive WCL encounter ID');

const input={
  encounterName:args.encounterName,
  journalEncounterId:args.journalEncounterId,
  wclEncounterId:args.wclEncounterId,
  region:args.region||process.env.BLIZZARD_REGION||'eu',
  locale:args.locale||process.env.BLIZZARD_LOCALE||'en_US',
};

const preview=buildOfficialEncounterKnowledgePreviewV1(input);
console.log('\n[1/5] Preview');
console.log(JSON.stringify({fingerprint:preview.fingerprint,request:preview.request,networkUpperBound:preview.networkUpperBound},null,2));

console.log('\n[2/5] Resolve + persist official Blizzard graph');
const resolved=await resolveOfficialEncounterKnowledgeV1(input);
console.log(JSON.stringify({
  journalEncounterId:resolved.encounter?.journalEncounterId,
  wclEncounterId:resolved.encounter?.wclEncounterId,
  encounterName:resolved.encounter?.name,
  namespace:resolved.source?.namespace,
  fingerprint:resolved.fingerprint,
  sectionCount:resolved.graph?.sectionCount,
  spellCount:resolved.graph?.spellCount,
  maxDepth:resolved.graph?.maxDepth,
  changedFromPrevious:resolved.storage?.changedFromPrevious,
  previousFingerprint:resolved.storage?.previousFingerprint,
  usage:resolved.usage,
},null,2));

console.log('\n[3/5] Reload persisted graph by WCL encounter ID (0 Blizzard / 0 WCL)');
const stored=await loadLatestOfficialEncounterGraphByWclIdV1(args.wclEncounterId);
if(!stored)throw new Error('Persisted WCL alias lookup returned no graph');
console.log(JSON.stringify({
  aliasResolved:true,
  journalEncounterId:stored.encounter?.journalEncounterId,
  fingerprint:stored.fingerprint,
  fingerprintMatchesResolved:stored.fingerprint===resolved.fingerprint,
  namespace:stored.source?.namespace,
  providerCalls:0,
  wclCalls:0,
},null,2));

console.log('\n[4/5] Ability Knowledge from stored official graph only');
let abilityKnowledge=null;
if(args.abilities.length){
  abilityKnowledge=await resolveAbilityKnowledgeV1({
    encounterId:args.wclEncounterId,
    abilityIds:args.abilities,
    providers:{lorrgs:false,parseWowhead:false,wcl:false},
  });
  console.log(JSON.stringify({
    usage:abilityKnowledge.usage,
    abilities:abilityKnowledge.abilities.map(row=>({
      abilityId:row.abilityId,
      name:row.identity?.name||null,
      semanticClass:row.semanticClass,
      officialStatus:row.providerSignals?.blizzardJournal?.status,
      officialMembership:row.interpretation?.officialEncounterMembership,
      memberships:row.providerSignals?.blizzardJournal?.memberships||[],
      negativeEvidence:row.providerSignals?.blizzardJournal?.negativeEvidence,
    })),
  },null,2));
}else console.log('No --abilities supplied; skipped.');

console.log('\n[5/5] Official hierarchy reconciliation');
const comparisons=[];
for(let i=0;i<args.abilities.length;i++)for(let j=i+1;j<args.abilities.length;j++){
  const row=reconcileOfficialEncounterAbilitiesV1(stored,args.abilities[i],args.abilities[j]);
  comparisons.push({leftAbilityId:row.leftAbilityId,rightAbilityId:row.rightAbilityId,status:row.status,bestRelation:row.bestRelation});
}
console.log(JSON.stringify(comparisons,null,2));

console.log('\nOK: official encounter smoke validation completed. No WCL combat-event request was made by this command.');
