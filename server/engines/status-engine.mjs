import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { LIVE_STATUS_QUERY } from '../wcl/queries/status.mjs';
import { selectEncounter } from '../wcl/normalization/fights.mjs';
import { splitAnalyticalPulls } from '../analysis/pulls/pull-eligibility.mjs';

export async function getLiveStatus({reportCode,encounterId}){
  const data=await wclGraphql(LIVE_STATUS_QUERY,{code:reportCode});
  const report=data?.reportData?.report;if(!report)return null;
  const fights=selectEncounter(report.fights,encounterId);
  const rawLatest=fights.at(-1)||null;
  const rawClosed=fights.filter(f=>!f.inProgress);
  const split=splitAnalyticalPulls(rawClosed);
  const latestMeaningful=split.eligible.at(-1)||null;
  // While a pull is genuinely live, status must follow it. Once closed, an
  // obvious run-wipe/reset is ignored and the latest meaningful pull remains
  // the analytical reference.
  const latest=rawLatest?.inProgress?rawLatest:(latestMeaningful||rawLatest);
  return {
    generatedAt:Date.now(),engineVersion:'3.4.2',
    report:{code:report.code,endTime:report.endTime,revision:report.revision,segments:report.segments,exportedSegments:report.exportedSegments},
    encounter:latest?{
      id:latest.encounterID,name:latest.name,totalPulls:split.eligible.length,rawPulls:fights.length,excludedPulls:split.excluded,
      latestFight:{id:latest.id,inProgress:Boolean(latest.inProgress),kill:Boolean(latest.kill),fightPercentage:latest.fightPercentage,startTime:latest.startTime,endTime:latest.endTime}
    }:null
  };
}
