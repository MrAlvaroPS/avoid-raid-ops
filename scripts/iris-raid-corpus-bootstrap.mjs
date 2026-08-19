import { previewRaidCorpusBootstrapV1,startRaidCorpusBootstrapV1 } from '../server/services/raid-corpus-bootstrap-service.mjs';

const args=process.argv.slice(2),has=flag=>args.includes(flag),value=flag=>{const i=args.indexOf(flag);return i>=0?args[i+1]:null;};
const start=has('--start'),maxNewScopes=Math.max(1,Math.min(32,Number(value('--max-scopes'))||4)),difficultyNames=String(value('--difficulties')||'Normal,Heroic,Mythic').split(',').map(x=>x.trim()).filter(Boolean);
console.log('\n[1/2] Preview current-raid GLOBAL public foundation corpora (0 network)');
const preview=await previewRaidCorpusBootstrapV1({difficultyNames});
console.log(JSON.stringify({fingerprint:preview.fingerprint,raid:preview.raid,profile:preview.profile,summary:preview.summary,networkUpperBound:preview.networkUpperBound,scopes:preview.scopes.map(row=>({boss:row.bossName,difficulty:row.difficulty?.name,availability:row.availabilityStatus,status:row.bootstrapStatus,publicSources:row.publicSources,corpus:row.corpus?{status:row.corpus.status,pulls:row.corpus.pullCount,deepPulls:row.corpus.deepPullCount,sources:row.corpus.sourceStats?.total||0}:null}))},null,2));
if(Number(preview.networkUpperBound?.previewWclCalls)!==0)throw new Error('Raid corpus bootstrap preview must execute zero WCL calls');
if(!start){console.log('\n[2/2] No corpus jobs started (--start not supplied)');console.log('\nOK: raid corpus foundation preview completed at 0 network.');process.exit(0);}
console.log(`\n[2/2] Start up to ${maxNewScopes} previewed public foundation corpora`);
const result=await startRaidCorpusBootstrapV1({preview,confirmExecution:true,previewFingerprint:preview.fingerprint,maxNewScopes});
console.log(JSON.stringify(result,null,2));
if(Number(result.usage?.wclCombatEventCalls)!==0)throw new Error('Foundation initialization must not execute WCL combat-event calls');
console.log('\nOK: bounded raid corpus foundation jobs initialized. The dedicated corpus worker may continue them from persistent checkpoints.');
