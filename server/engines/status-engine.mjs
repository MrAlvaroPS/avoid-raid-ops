import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { LIVE_STATUS_QUERY } from '../wcl/queries/status.mjs';
import { selectEncounter } from '../wcl/normalization/fights.mjs';
import { splitAnalyticalPulls } from '../analysis/pulls/pull-eligibility.mjs';

export async function getLiveStatus({reportCode,encounterId,difficulty}){
  const data=await wclGraphql(LIVE_STATUS_QUERY,{code:reportCode}),report=data?.reportData?.report;if(!report)return null;
  const fights=selectEncounter(report.fights,encounterId,difficulty),rawLatest=fights.at(-1)||null;
  if(fights.length&&fights.some(f=>Number(f.difficulty)!==Number(fights[0].difficulty)))throw new Error('Cross-difficulty live status selection rejected');
  const rawClosed=fights.filter(f=>!f.inProgress),split=splitAnalyticalPulls(rawClosed),latestMeaningful=split.eligible.at(-1)||null,latest=rawLatest?.inProgress?rawLatest:(latestMeaningful||rawLatest),selectedDifficulty=Number(latest?.difficulty||fights[0]?.difficulty||0)||null;
  return{
    generatedAt:Date.now(),engineVersion:'3.9.10-difficulty-scope',
    report:{code:report.code,endTime:report.endTime,revision:report.revision,segments:report.segments,exportedSegments:report.exportedSegments},
    encounter:latest?{id:latest.encounterID,name:latest.name,difficulty:selectedDifficulty,difficultyName:({1:'LFR',2:'Flexible',3:'Normal',4:'Heroic',5:'Mythic'})[selectedDifficulty]||`Difficulty ${selectedDifficulty}`,scopeKey:`${latest.encounterID}:d${selectedDifficulty}`,totalPulls:split.eligible.length,rawPulls:fights.length,excludedPulls:split.excluded,latestFight:{id:latest.id,inProgress:Boolean(latest.inProgress),kill:Boolean(latest.kill),fightPercentage:latest.fightPercentage,startTime:latest.startTime,endTime:latest.endTime}}:null,
    evidenceContract:{scopeIdentity:'encounter+difficulty',crossDifficultyComparisonForbidden:true}
  };
}
