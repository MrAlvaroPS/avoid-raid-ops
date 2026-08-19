import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { HOME_GUILD_ROSTER_QUERY } from '../wcl/queries/home-roster.mjs';
import { homeGuildId } from '../knowledge/scopes.mjs';
import { HOME_ROSTER_STORE_VERSION,loadHomeRosterV1,persistHomeRosterV1,normalizeGuildRosterMemberV1,mergeDirectoryRosterV1,mergeObservedRosterV1 } from '../home/roster-store-v1.mjs';

const finite=v=>Number.isFinite(Number(v))?Number(v):null;

export async function readHomeRosterV1({guildId=homeGuildId()}={}){
  const roster=await loadHomeRosterV1({guildId});
  return{version:HOME_ROSTER_STORE_VERSION,guildId:Number(guildId),roster:roster||null,networkExecuted:false,wclMetadataCalls:0};
}

export async function refreshHomeRosterV1({guildId=homeGuildId(),limit=100,maxPages=20}={}){
  const id=Number(guildId);if(!Number.isInteger(id)||id<=0)throw new Error('HOME guildId is required');
  const rows=[],classes=new Map();let guild=null,page=1,lastPage=1,calls=0,rateLimit=null;
  do{
    const data=await wclGraphql(HOME_GUILD_ROSTER_QUERY,{guildID:id,page,limit:Math.max(1,Math.min(100,Number(limit)||100))});calls++;
    const g=data?.guildData?.guild;if(!g)throw new Error(`WCL guild ${id} was not found or roster is unavailable`);guild=g;
    for(const c of data?.gameData?.classes||[])classes.set(Number(c.id),{id:Number(c.id),name:c.name||null,slug:c.slug||null,specs:(c.specs||[]).map(s=>({id:finite(s.id),name:s.name||null,slug:s.slug||null}))});
    const members=g?.members;for(const row of members?.data||[])rows.push(row);
    lastPage=Math.max(1,Number(members?.last_page)||1);rateLimit=data?.rateLimitData||rateLimit;page++;
  }while(page<=lastPage&&page<=Math.max(1,Number(maxPages)||20));
  const fetchedAt=Date.now(),incoming={version:HOME_ROSTER_STORE_VERSION,guildId:id,guild:{id:Number(guild.id),name:guild.name||null,server:guild.server?{id:finite(guild.server.id),name:guild.server.name||null,slug:guild.server.slug||null,region:guild.server.region?{id:finite(guild.server.region.id),name:guild.server.region.name||null,slug:guild.server.region.slug||null,compactName:guild.server.region.compactName||null}:null}:null},temporary:true,source:'wcl-guild-members',fetchedAt,updatedAt:fetchedAt,totalReported:Number(guild?.members?.total)||rows.length,members:rows.map(row=>normalizeGuildRosterMemberV1(row,classes,{fetchedAt}))};
  const existing=await loadHomeRosterV1({guildId:id}),merged=mergeDirectoryRosterV1(existing||{},incoming);await persistHomeRosterV1(merged,{guildId:id});
  return{version:HOME_ROSTER_STORE_VERSION,guildId:id,roster:merged,networkExecuted:true,wclMetadataCalls:calls,wclCombatCalls:0,rateLimit};
}

export async function observeHomeRosterV1({guildId=homeGuildId(),players=[],reportCode=null,fightId=null,observedAt=Date.now()}={}){
  const id=Number(guildId);if(!Number.isInteger(id)||id<=0)throw new Error('HOME guildId is required');
  const existing=await loadHomeRosterV1({guildId:id})||{version:HOME_ROSTER_STORE_VERSION,guildId:id,guild:{id},temporary:true,source:'observed-bootstrap',fetchedAt:null,members:[]};
  const merged=mergeObservedRosterV1(existing,players,{reportCode,fightId,observedAt});await persistHomeRosterV1(merged,{guildId:id});
  return{version:HOME_ROSTER_STORE_VERSION,guildId:id,roster:merged,networkExecuted:false,wclMetadataCalls:0,wclCombatCalls:0,observedPlayers:(players||[]).length};
}
