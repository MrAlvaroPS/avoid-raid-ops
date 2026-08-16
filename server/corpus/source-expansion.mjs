import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { CORPUS_REPORT_IDENTITY_QUERY, CORPUS_SOURCE_REPORTS_QUERY } from '../wcl/queries/corpus.mjs';

const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};

export async function fetchReportIdentity(code){
  const data=await wclGraphql(CORPUS_REPORT_IDENTITY_QUERY,{code:String(code)});
  const report=data?.reportData?.report;
  if(!report)return{identity:null,rateLimit:data?.rateLimitData||null};
  return{
    identity:{
      code:report.code,
      title:report.title||null,
      startTime:num(report.startTime),
      endTime:num(report.endTime),
      visibility:report.visibility||null,
      zone:report.zone?{id:num(report.zone.id),name:report.zone.name||null}:null,
      guild:report.guild?{id:num(report.guild.id),name:report.guild.name||null}:null,
      owner:report.owner?{id:num(report.owner.id)}:null,
    },
    rateLimit:data?.rateLimitData||null
  };
}

export function sourceKey(source){return source?.type&&source?.id!=null?`${source.type}:${source.id}`:null;}

export function sourceFromIdentity(identity){
  const ownerId=num(identity?.owner?.id);
  const guildId=num(identity?.guild?.id);if(guildId!=null)return{type:'guild',id:guildId,name:identity?.guild?.name||null,ownerId,page:1};
  if(ownerId!=null)return{type:'user',id:ownerId,name:null,ownerId,page:1};
  return null;
}

export async function fetchSourceReports({source,zoneId,page=1,limit=100,startTime=0,endTime=Date.now()}){
  if(!source?.type||!source?.id)throw new Error('source is required');
  const vars={guildID:source.type==='guild'?Number(source.id):null,userID:source.type==='user'?Number(source.id):null,zoneID:Number(zoneId),page:Number(page),limit:Math.max(1,Math.min(100,Number(limit)||100)),startTime:Number(startTime)||0,endTime:Number(endTime)||Date.now()};
  const data=await wclGraphql(CORPUS_SOURCE_REPORTS_QUERY,vars);
  const pagination=data?.reportData?.reports;
  const rows=(pagination?.data||[]).filter(r=>r?.code&&r?.visibility!=='private').map(r=>({code:r.code,title:r.title||null,startTime:num(r.startTime),endTime:num(r.endTime),visibility:r.visibility||null,zoneId:num(r?.zone?.id)}));
  return{
    rows,
    page:Number(pagination?.current_page||page),
    lastPage:Number(pagination?.last_page||page),
    hasMore:Boolean(pagination?.has_more_pages),
    total:Number(pagination?.total||rows.length),
    rateLimit:data?.rateLimitData||null
  };
}
