(()=>{
'use strict';
const RELEASE='3.9.11.0';
const HISTORY_API='/api/wcl/home-history';
const MANIFEST_API='/api/wcl/active-report-manifest';
const STORAGE_URL='avoid:active-report-url:v1';
const POLL_WAITING_MS=30000,POLL_ACTIVE_MS=15000,POLL_IDLE_MS=20000;
const state={history:null,historyScope:null,pullSelection:{mode:'all',fightId:null},activeReport:null,activeUrl:localStorage.getItem(STORAGE_URL)||'',live:false,pollState:'stopped',pollTimer:null,lastFingerprint:null,error:null};
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const qs=(sel,root=document)=>root?.querySelector(sel)||null;

async function json(url,init){const response=await fetch(url,init),payload=await response.json().catch(()=>({}));if(!response.ok||payload?.ok===false)throw new Error(payload?.error||`HTTP ${response.status}`);return payload;}
function currentContext(){return Object.freeze({version:'avoid-execution-context-browser-v1',release:RELEASE,homeHistory:state.history,homeHistoryScope:state.historyScope,activeReport:state.activeReport,pullSelection:state.pullSelection,live:{enabled:state.live,pollState:state.pollState},isolation:{globalIrisIndependent:true,activeReportDoesNotMutateHomeHistory:true,homeHistoryRefreshExplicit:true,pullSelectionIsConsumerOptIn:true,firstPageWclNetworkAllowed:false}});}
function publish(kind='context'){
  window.__AVOID_HOME_HISTORY__=state.history;
  window.__AVOID_WCL_HISTORY__=state.historyScope;
  window.__AVOID_ACTIVE_REPORT__=state.activeReport;
  window.__AVOID_PULL_SELECTION__=state.pullSelection;
  window.__AVOID_EXECUTION_CONTEXT__=currentContext();
  window.dispatchEvent(new CustomEvent('avoid:execution-context',{detail:window.__AVOID_EXECUTION_CONTEXT__}));
  window.dispatchEvent(new CustomEvent(`avoid:${kind}`,{detail:window.__AVOID_EXECUTION_CONTEXT__}));
}
function setRaidBreadcrumb(){const name=state.history?.zone?.name;if(!name)return;const spans=qs('.breadcrumbs')?.querySelectorAll('span');if(spans?.[1]&&!qs('.topbar')?.dataset?.irisMechanicsHeaderRelease)spans[1].textContent=String(name).toUpperCase();}
function latestHistoryPull(){return(state.history?.pulls||[]).filter(row=>row?.mode==='single').at(-1)||null;}
async function loadDefaultHistoryScope(){
  const latest=latestHistoryPull();if(!latest){state.historyScope=null;publish('home-history-ready');return null;}
  try{const u=new URL(HISTORY_API,location.origin);u.searchParams.set('encounter',String(latest.encounterId));u.searchParams.set('difficulty',String(latest.difficulty));state.historyScope=await json(u);publish('home-history-ready');return state.historyScope;}catch(error){state.historyScope=null;state.error=error.message;publish('home-history-ready');return null;}
}
async function loadHistory(){
  try{state.history=await json(HISTORY_API);state.error=null;setRaidBreadcrumb();render();await loadDefaultHistoryScope();return state.history;}
  catch(error){state.error=error.message;state.history={status:'unavailable',reports:[],pulls:[{key:'all',mode:'all',label:'All pulls'}],networkExecuted:false,wclCallsExecuted:0};render();publish('home-history-ready');return null;}
}
async function refreshHistory(){
  const button=qs('[data-exec-refresh]');if(button){button.disabled=true;button.textContent='SYNCING…';}
  try{await json(HISTORY_API,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({action:'refresh',confirmExecution:true})});await loadHistory();}
  catch(error){state.error=error.message;render();}
}
function selectPull(value){
  if(!value||value==='all')state.pullSelection={mode:'all',fightId:null};
  else{const pull=(state.history?.pulls||[]).find(row=>String(row.key)===String(value));state.pullSelection=pull?{mode:'single',fightId:Number(pull.fightId),reportCode:pull.reportCode,encounterId:Number(pull.encounterId),difficulty:Number(pull.difficulty),scopeKey:pull.scopeKey}: {mode:'all',fightId:null};}
  publish('pull-selection');renderStatus();
}
function activeReference(){return String(qs('[data-exec-url]')?.value||state.activeUrl||'').trim();}
function liveChecked(){return Boolean(qs('[data-exec-live]')?.checked);}
function pollDelay(){if(state.activeReport?.waitingForFirstCombat)return POLL_WAITING_MS;if(state.activeReport?.selectedFight?.inProgress)return POLL_ACTIVE_MS;return POLL_IDLE_MS;}
function clearPoll(){if(state.pollTimer)clearTimeout(state.pollTimer);state.pollTimer=null;}
function schedulePoll(){clearPoll();if(state.pollState!=='running')return;state.pollTimer=setTimeout(()=>void pollActive(),pollDelay());}
async function requestManifest({schedule=false}={}){
  const report=activeReference();if(!report)throw new Error('Paste a Warcraft Logs report URL first');
  state.activeUrl=report;localStorage.setItem(STORAGE_URL,report);state.live=liveChecked();
  const u=new URL(MANIFEST_API,location.origin);u.searchParams.set('report',report);if(state.live)u.searchParams.set('live','1');
  const payload=await json(u);const changed=state.lastFingerprint!==payload.pollFingerprint;state.lastFingerprint=payload.pollFingerprint;state.activeReport=payload;state.error=null;publish(changed?'active-report-changed':'active-report');render();if(schedule)schedulePoll();return payload;
}
async function startOrLoad(){
  clearPoll();state.live=liveChecked();state.pollState=state.live?'running':'stopped';renderStatus();
  try{await requestManifest({schedule:state.live});}catch(error){state.pollState='stopped';state.error=error.message;render();}
}
async function pollActive(){if(state.pollState!=='running')return;try{await requestManifest({schedule:true});}catch(error){state.error=error.message;render();schedulePoll();}}
function stopPolling(){clearPoll();state.pollState='stopped';publish('active-report');render();}
function activeStatus(){
  if(state.error)return{tone:'bad',title:'ERROR',detail:state.error};
  const active=state.activeReport;
  if(!active)return{tone:'muted',title:'NO ACTIVE REPORT',detail:'Paste a WCL URL when you want report-scoped execution data.'};
  if(active.waitingForFirstCombat)return{tone:'waiting',title:'LIVE · WAITING FOR FIRST COMBAT',detail:'Connected. No encounter has been published yet; nothing is scored as bad.'};
  if(active.state==='no-raid-combat-found')return{tone:'muted',title:'NO RAID COMBAT FOUND',detail:'Static report loaded, but it contains no raid encounter fights.'};
  const scope=active.selectedScope,mode=state.pollState==='running'?'LIVE':'STATIC';return{tone:'good',title:`${mode} · ${scope?.bossName||'REPORT READY'} · ${scope?.difficultyName||''}`,detail:`${active.fights?.length||0} fights · difficulty classified per fight`};
}
function renderStatus(){const node=qs('[data-exec-status]');if(!node)return;const row=activeStatus();node.className=`avoid-exec-status ${row.tone}`;node.innerHTML=`<b>${esc(row.title)}</b><small>${esc(row.detail)}</small>`;const stop=qs('[data-exec-stop]');if(stop)stop.disabled=state.pollState!=='running';const launch=qs('[data-exec-launch]');if(launch)launch.textContent=liveChecked()?'START LIVE':'LOAD';}
function pullOptions(){const pulls=state.history?.pulls||[{key:'all',mode:'all',label:'All pulls'}];return pulls.map(row=>`<option value="${esc(row.key)}" ${row.mode==='all'?'selected':''}>${esc(row.label||row.key)}</option>`).join('');}
function historyMeta(){if(!state.history)return'LOADING STORED HISTORY';if(state.history.status==='empty')return'NO STORED HISTORY · REFRESH WHEN READY';if(state.history.status==='partial')return`${state.history.pullCount||0} PULLS · ${state.history.refresh?.remainingChangedReports||0} REPORTS STILL TO SYNC`;return`${state.history.pullCount||0} PULLS · ${state.history.reportCount||0} REPORTS · WCL 0 ON LOAD`;}
function render(){
  const selectors=qs('.selectors');if(!selectors)return;
  if(selectors.dataset.avoidExecutionRelease!==RELEASE){
    selectors.dataset.avoidExecutionRelease=RELEASE;
    selectors.innerHTML=`<div class="avoid-exec-group history"><label>AVOID HISTORY</label><select data-exec-pulls aria-label="AvoiD historical pull selector"></select><button type="button" data-exec-refresh>↻ UPDATE</button><small data-exec-history-meta></small></div><div class="avoid-exec-group active"><label>ACTIVE WCL REPORT</label><input data-exec-url type="text" inputmode="url" placeholder="https://www.warcraftlogs.com/reports/…" aria-label="Warcraft Logs report URL"><label class="avoid-exec-live"><input data-exec-live type="checkbox"> LIVE</label><button type="button" class="primary" data-exec-launch>LOAD</button><button type="button" data-exec-stop disabled>STOP</button></div><div data-exec-status class="avoid-exec-status muted"></div>`;
    qs('[data-exec-refresh]')?.addEventListener('click',()=>void refreshHistory());
    qs('[data-exec-pulls]')?.addEventListener('change',event=>selectPull(event.target.value));
    qs('[data-exec-launch]')?.addEventListener('click',()=>void startOrLoad());
    qs('[data-exec-stop]')?.addEventListener('click',stopPolling);
    qs('[data-exec-live]')?.addEventListener('change',()=>{state.live=liveChecked();const launch=qs('[data-exec-launch]');if(launch)launch.textContent=state.live?'START LIVE':'LOAD';});
    qs('[data-exec-url]').value=state.activeUrl;
  }
  const select=qs('[data-exec-pulls]');if(select){const current=state.pullSelection.mode==='single'?`${state.pullSelection.reportCode}:${state.pullSelection.fightId}`:'all';select.innerHTML=pullOptions();if([...select.options].some(option=>option.value===current))select.value=current;else select.value='all';}
  const meta=qs('[data-exec-history-meta]');if(meta)meta.textContent=historyMeta();
  const input=qs('[data-exec-url]');if(input&&document.activeElement!==input)input.value=state.activeUrl;
  const live=qs('[data-exec-live]');if(live)live.checked=state.live;
  renderStatus();
}
function reveal(){document.documentElement.classList.remove('raidops-booting','raidops-wcl-core-pending');document.documentElement.classList.add('raidops-offline-ready');const boot=qs('#raidops-boot');if(boot){boot.hidden=true;boot.style.setProperty('display','none','important');}}
function mount(){reveal();render();publish();void loadHistory();}
window.__AVOID_EXECUTION__=Object.freeze({release:RELEASE,getState:currentContext,history:Object.freeze({reload:loadHistory,refresh:refreshHistory}),activeReport:Object.freeze({load:startOrLoad,stop:stopPolling,poll:pollActive}),selectPull});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
