import { createHash } from 'node:crypto';
import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { ACTIVE_REPORT_MANIFEST_QUERY } from '../wcl/queries/active-report-manifest.mjs';
import { classifyActiveReportManifestV1 } from '../execution/execution-context-v1.mjs';

const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const digest=value=>createHash('sha1').update(JSON.stringify(stable(value))).digest('hex');

export async function getActiveReportManifestV1({reportCode,live=false,requestedFight=null}={}){
  if(!reportCode)throw new Error('reportCode is required');
  const data=await wclGraphql(ACTIVE_REPORT_MANIFEST_QUERY,{code:String(reportCode)});
  const report=data?.reportData?.report;if(!report)return null;
  const manifest=classifyActiveReportManifestV1({report,live,requestedFight,generatedAt:Date.now()});
  const pollFingerprint=digest({
    code:manifest.report.code,
    revision:manifest.report.revision,
    fights:manifest.fights.map(row=>({fightId:row.fightId,scopeKey:row.scopeKey,startTime:row.startTime,endTime:row.endTime,inProgress:row.inProgress,kill:row.kill,fightPercentage:row.fightPercentage,bossPercentage:row.bossPercentage})),
  });
  return{
    ...manifest,
    pollFingerprint,
    rateLimit:data?.rateLimitData||null,
    usage:{wclMetadataCalls:1,wclCombatEventCalls:0,heavyAnalysisCalls:0},
    pollingContract:{manifestOnly:true,heavyRefreshOnlyWhenFingerprintChanges:true},
  };
}
