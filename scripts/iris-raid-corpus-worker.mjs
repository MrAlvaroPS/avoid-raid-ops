import { previewRaidCorpusBootstrapV1 } from '../server/services/raid-corpus-bootstrap-service.mjs';
import { stepCorpus } from '../server/corpus/service.mjs';
import { RAID_CORPUS_FOUNDATION_PROFILE } from '../server/corpus/raid-corpus-bootstrap-v1.mjs';

const argv=process.argv.slice(2),value=flag=>{const i=argv.indexOf(flag);return i>=0?argv[i+1]:null;};
const maxSteps=Math.max(1,Math.min(5000,Number(value('--steps'))||100)),difficultyNames=String(value('--difficulties')||'Normal,Heroic,Mythic').split(',').map(x=>x.trim()).filter(Boolean);
let steps=0;
console.log(`\nIRIS CURRENT RAID FOUNDATION WORKER · max ${maxSteps} checkpointed steps`);
while(steps<maxSteps){
  const preview=await previewRaidCorpusBootstrapV1({difficultyNames});
  const building=preview.scopes.filter(row=>row.bootstrapStatus==='reference-building'),runnable=building.filter(row=>row.corpus?.status==='running');
  if(!building.length){console.log('No foundation corpus is currently building.');break;}
  if(!runnable.length){console.log(JSON.stringify({status:'no-runnable-scope',building:building.map(row=>({boss:row.bossName,difficulty:row.difficulty?.name,status:row.corpus?.status,phase:row.corpus?.phase}))},null,2));break;}
  for(const row of runnable){
    if(steps>=maxSteps)break;
    const status=await stepCorpus({encounterId:row.wclEncounterId,difficulty:row.difficulty.id,partition:row.partition||0,...RAID_CORPUS_FOUNDATION_PROFILE});steps++;
    console.log(`[${steps}/${maxSteps}] ${row.bossName} · ${row.difficulty.name} · ${status.status}/${status.phase} · ${Number(status.pullCount||0)} wide · ${Number(status.deepPullCount||0)} deep · ${Number(status.sourceStats?.total||0)} sources`);
  }
}
const finalPreview=await previewRaidCorpusBootstrapV1({difficultyNames});
console.log(JSON.stringify({steps,summary:finalPreview.summary,scopes:finalPreview.scopes.map(row=>({boss:row.bossName,difficulty:row.difficulty?.name,status:row.bootstrapStatus,jobStatus:row.corpus?.status||null,phase:row.corpus?.phase||null,pulls:row.corpus?.pullCount||0,deepPulls:row.corpus?.deepPullCount||0,sources:row.corpus?.sourceStats?.total||0}))},null,2));
console.log('\nOK: current-raid foundation worker stopped at a persistent checkpoint.');
