import { previewOperationalRehearsalV1,executeOperationalRehearsalV1 } from '../server/corpus/operational-readiness-v1.mjs';

const argv=process.argv.slice(2),value=flag=>{const i=argv.indexOf(flag);return i>=0?argv[i+1]:null;},has=flag=>argv.includes(flag);
const encounterId=Number(value('--encounter')||0),difficultyRaw=String(value('--difficulty')||'').trim(),reports=Math.max(1,Math.min(8,Number(value('--reports'))||3)),execute=has('--execute');
const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const difficulty=Number.isInteger(Number(difficultyRaw))&&Number(difficultyRaw)>0?Number(difficultyRaw):({lfr:1,normal:3,heroic:4,hc:4,mythic:5})[norm(difficultyRaw)]||null;
if(!encounterId||!difficulty)throw new Error('Usage: npm run validate:operational-rehearsal -- --encounter <id> --difficulty <Normal|Heroic|Mythic> [--execute]');

console.log('\nIRIS OPERATIONAL REHEARSAL · DATA READY ≠ LIVE READY');
const preview=await previewOperationalRehearsalV1({encounterId,difficulty,reports});
console.log(JSON.stringify({mode:'preview',status:preview.status,scope:preview.scope,dataReady:preview.dataReady,mechanicCoverageReady:preview.mechanicCoverageReady,liveReady:preview.liveReady,sampling:preview.sampling,selectedReports:preview.selectedReports,networkExecuted:preview.networkExecuted,networkUpperBound:preview.networkUpperBound,stored:preview.stored?{status:preview.stored.status,coverage:preview.stored.coverage,checks:preview.stored.checks}:null},null,2));
if(!execute){console.log('\nOK: rehearsal preview completed at zero network. Add --execute to test canonical external reports through the production Operational Execution path.');process.exit(0);}
if(!preview.dataReady)throw new Error('Boss is not DATA READY. Prepare the boss corpus before rehearsal.');
const result=await executeOperationalRehearsalV1({encounterId,difficulty,reports,confirmExecution:true,previewFingerprint:preview.fingerprint});
console.log(JSON.stringify({mode:'execute',status:result.status,scope:result.scope,dataReady:result.dataReady,mechanicCoverageReady:result.mechanicCoverageReady,liveReady:result.liveReady,coverage:result.coverage,checks:result.checks,runs:result.runs},null,2));
console.log(result.liveReady?'\nOK: LIVE READY. The production Operational Execution path recognized enough same-difficulty mechanics on deterministic external rehearsal reports.':'\nREVIEW: DATA READY but mechanic coverage did not clear the operational rehearsal gate. Do not weaken the gate; inspect coverage/runs.');
