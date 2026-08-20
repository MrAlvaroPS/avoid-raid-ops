(()=>{
'use strict';
const previous=window.fetch.bind(window);
function currentPlayers(){const ctx=window.__AVOID_EXECUTION_CONTEXT__||{},telemetry=ctx.activeData?.telemetry||window.__AVOID_ACTIVE_REPORT_DATA__?.telemetry||window.__AVOID_WCL_TELEMETRY__||null;return telemetry?.players||[];}
function localLootUrl(input){try{const raw=input instanceof Request?input.url:String(input),url=new URL(raw,location.href);return url.origin===location.origin&&url.pathname==='/api/loot';}catch{return false;}}
function enrichPlayers(players=[]){const source=new Map(currentPlayers().map(row=>[String(row?.name||'').trim().toLowerCase(),row]));return players.map(row=>{const observed=source.get(String(row?.name||'').trim().toLowerCase());return observed?.character?{...row,character:observed.character}:row;});}
window.fetch=async(input,init={})=>{
  if(!localLootUrl(input)||String(init?.method||'GET').toUpperCase()!=='POST'||typeof init?.body!=='string')return previous(input,init);
  try{const body=JSON.parse(init.body);if(body?.action!=='simulate'&&body?.action!=='eligibility')return previous(input,init);const next={...body,players:enrichPlayers(Array.isArray(body.players)?body.players:[])};return previous(input,{...init,body:JSON.stringify(next)});}catch{return previous(input,init);}
};
window.__AVOID_LOOT_PROFILE_BRIDGE__=Object.freeze({version:'3.9.13.0',source:'WCL CombatantInfo',fallback:'SimulationCraft Battle.net armory'});
})();
