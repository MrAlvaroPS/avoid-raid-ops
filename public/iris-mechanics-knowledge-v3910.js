(()=>{
'use strict';

const RELEASE='3.9.10';
const ENDPOINT='/api/wcl/mechanic-knowledge';
const STATE={active:'execution',scopeKey:null,data:null,loading:false,error:null};
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const num=value=>Number.isFinite(Number(value))?Number(value):null;
const fmt=value=>num(value)==null?'—':new Intl.NumberFormat('en-US').format(Number(value));
const fmtPct=value=>num(value)==null?'—':`${Math.round(Number(value)*100)}%`;
const short=value=>String(value||'').slice(0,10)||'—';

function mechanicsPage(){return String(document.querySelector('.page-head h1')?.textContent||'').trim().toLowerCase()==='mechanics';}
function canvas(){return document.querySelector('.canvas');}
function banner(){return canvas()?.querySelector(':scope > .page-banner')||document.querySelector('.page-banner');}
function currentScope(){
  const encounter=window.__AVOID_WCL__?.encounter;
  const encounterId=Number(encounter?.id||0),difficulty=Number(encounter?.difficulty||5);
  return encounterId?{encounterId,difficulty,encounterName:encounter?.name||null}:null;
}

function ensureTabs(){
  const root=canvas(),hero=banner();if(!root||!hero||!mechanicsPage())return null;
  let tabs=root.querySelector(':scope > .iris-mechanics-tabs');
  if(!tabs){
    tabs=document.createElement('div');tabs.className='iris-mechanics-tabs';tabs.dataset.irisMechanicsRelease=RELEASE;
    tabs.innerHTML='<button type="button" data-iris-mechanics-tab="execution">RAID EXECUTION</button><button type="button" data-iris-mechanics-tab="knowledge"><span>IRIS</span> KNOWLEDGE</button><small>Observed execution ↔ learned boss knowledge</small>';
    hero.insertAdjacentElement('afterend',tabs);
    tabs.addEventListener('click',event=>{const button=event.target.closest('[data-iris-mechanics-tab]');if(!button)return;switchTab(button.dataset.irisMechanicsTab);});
  }
  let host=root.querySelector(':scope > .iris-mechanics-knowledge');
  if(!host){host=document.createElement('section');host.className='iris-mechanics-knowledge';host.hidden=true;tabs.insertAdjacentElement('afterend',host);}
  markExecutionNodes(root,tabs,host);
  return{root,hero,tabs,host};
}

function markExecutionNodes(root,tabs,host){
  for(const node of [...root.children]){
    if(node===tabs||node===host||node.classList.contains('page-head')||node.classList.contains('page-banner')||node.tagName==='FOOTER')continue;
    node.dataset.irisMechanicsExecution='1';
  }
}

function patchBanner(mode,hero){
  const title=hero?.querySelector('h2'),copy=hero?.querySelector('p');if(!title||!copy)return;
  if(!hero.dataset.irisOriginalTitle){hero.dataset.irisOriginalTitle=title.textContent||'';hero.dataset.irisOriginalCopy=copy.textContent||'';}
  if(mode==='knowledge'){
    title.textContent='Iris Boss Knowledge';
    copy.textContent='What Iris knows, what the evidence rejected, and why the learning pipeline stopped or advanced.';
  }else{
    title.textContent=hero.dataset.irisOriginalTitle;copy.textContent=hero.dataset.irisOriginalCopy;
  }
}

function switchTab(mode){
  const ui=ensureTabs();if(!ui)return;STATE.active=mode==='knowledge'?'knowledge':'execution';
  for(const button of ui.tabs.querySelectorAll('[data-iris-mechanics-tab]'))button.classList.toggle('active',button.dataset.irisMechanicsTab===STATE.active);
  for(const node of ui.root.querySelectorAll(':scope > [data-iris-mechanics-execution="1"]'))node.hidden=STATE.active==='knowledge';
  ui.host.hidden=STATE.active!=='knowledge';patchBanner(STATE.active,ui.hero);
  if(STATE.active==='knowledge')loadAndRender(ui.host);
}

function sourceCard(label,source,kind){
  const ready=source?.status==='ready';
  let value='NOT AVAILABLE',meta='No persisted source';
  if(kind==='official'&&ready){value=`${fmt(source.spellCount)} SPELLS`;meta=`${fmt(source.sectionCount)} sections · ${esc(source.namespace||'build unknown')}`;}
  if(kind==='structural'&&ready){value=`${fmt(source.relations)} RELATIONS`;meta=`DB2 ${esc(source.build||'build unknown')} · ${fmt(source.resolvedQueries)}/${fmt(source.queryCount)} queries`;}
  if(kind==='corpus'&&ready){value=`${fmt(source.independentSources)} SOURCES`;meta=`${fmt(source.wideReports)} Wide · ${fmt(source.deepReports)} Deep`;}
  return `<article class="iris-k-source ${ready?'ready':'missing'}"><small>${esc(label)}</small><strong>${value}</strong><p>${meta}</p><i>${ready?'READY':'MISSING'}</i></article>`;
}

function stageLabel(stage){
  const status=String(stage?.status||'not-built');
  if(['observed','built','supported','encounter-edge-supported','evidence-available'].includes(status))return'PASS';
  if(status==='no-supported-pattern'||status==='rejected')return'STOP';
  if(status.startsWith('not-eligible')||status==='not-built'||status==='pending')return'—';
  if(status.includes('insufficient')||status.includes('required')||status.includes('no-exact'))return'CHECK';
  return status.replaceAll('-',' ').toUpperCase();
}

function ladder(mechanic){
  return `<div class="iris-k-ladder">${(mechanic.evidenceLadder||[]).map(stage=>`<div class="iris-k-stage ${esc(stage.tone||'neutral')}"><span>${esc(stage.label)}</span><b>${esc(stageLabel(stage))}</b><small>${esc(stage.detail||stage.status||'')}</small></div>`).join('')}</div>`;
}

function officialPath(mechanic){
  const memberships=mechanic?.anchor?.officialMembership?.memberships||[];
  return memberships[0]?.path?.length?memberships[0].path.join(' › '):'Not listed in persisted official Journal';
}

function candidateRow(candidate){
  const matched=candidate.matchedNull;
  const official=candidate.official?.status||'official unresolved';
  const provenance=candidate.actorProvenance?.encounterOrigin?'encounter-origin':candidate.actorProvenance?.playerOrigin?'player-origin':candidate.actorProvenance?.status||'unresolved';
  return `<div class="iris-k-candidate">
    <div class="iris-k-candidate-name"><strong>${esc(candidate.name||`Ability ${candidate.abilityId}`)}</strong><small>#${esc(candidate.abilityId)} · ${esc(candidate.relation||candidate.eventType||'context')}</small></div>
    <span class="iris-k-pill ${esc(candidate.state?.tone||'neutral')}">${esc(candidate.state?.label||'DIAGNOSTIC')}</span>
    <div><small>ACTOR</small><b>${esc(provenance)}</b></div>
    <div><small>OFFICIAL</small><b>${esc(official.replaceAll('-',' '))}</b></div>
    <div><small>MATCHED NULL</small><b>${esc(matched?.status?.replaceAll('matched-','').replaceAll('-',' ')||'not evaluated')}</b></div>
    <div><small>Δ PREVALENCE</small><b>${matched?fmtPct(matched.prevalenceDelta):'—'}</b></div>
    ${candidate.structural?.direct?'<em>DB2 DIRECT LINK</em>':''}
  </div>`;
}

function mechanicCard(mechanic,index){
  const candidates=(mechanic.candidates||[]).slice(0,12);
  return `<article class="iris-k-mechanic" data-iris-mechanic="${index}">
    <header>
      <div><small>MECHANIC INVESTIGATION · #${esc(mechanic.anchor.abilityId)}</small><h3>${esc(mechanic.anchor.name||`Ability ${mechanic.anchor.abilityId}`)}</h3><p>${esc(officialPath(mechanic))}</p></div>
      <span class="iris-k-status ${esc(mechanic.status?.tone||'neutral')}">${esc(mechanic.status?.label||'UNDER INVESTIGATION')}</span>
    </header>
    <div class="iris-k-stop"><b>${esc(mechanic.status?.why?'WHY IRIS STOPPED / CURRENT STATE':'CURRENT STATE')}</b><p>${esc(mechanic.status?.why||'No explanation available.')}</p></div>
    ${ladder(mechanic)}
    <div class="iris-k-mini-stats">
      <div><small>MATCHED PAIRS</small><b>${fmt(mechanic.matchedNull?.matchedPairs)}</b></div>
      <div><small>INDEPENDENT SOURCES</small><b>${fmt(mechanic.matchedNull?.matchedSources)}</b></div>
      <div><small>SUPPORTED AFTER NULL</small><b>${fmt(mechanic.matchedNull?.summary?.supported)}</b></div>
      <div><small>NOISE / PARTIAL</small><b>${fmt(mechanic.matchedNull?.summary?.noise)} / ${fmt(mechanic.matchedNull?.summary?.partial)}</b></div>
    </div>
    <details class="iris-k-evidence" ${index===0?'open':''}><summary>VIEW EVIDENCE & CANDIDATES <span>${candidates.length}</span></summary>
      <div class="iris-k-candidates">${candidates.length?candidates.map(candidateRow).join(''):'<div class="iris-k-empty-inline">No supporting candidate patterns are stored for this Episode.</div>'}</div>
      <div class="iris-k-provenance"><span>Episode <b>${esc(short(mechanic.episode?.buildFingerprint))}</b></span><span>Empirical <b>${esc(short(mechanic.episode?.empiricalEvidenceFingerprint))}</b></span><span>Truth <b>WCL</b></span><span>Auto promotion <b>OFF</b></span></div>
    </details>
  </article>`;
}

function render(host,payload){
  const data=payload?.result||payload;if(!data){renderError(host,'No Iris knowledge response was returned.');return;}
  const sources=data.sources||{},mechanics=data.mechanics||[];
  host.innerHTML=`
    <div class="iris-k-hero">
      <div class="iris-k-eyebrow"><span>IRIS / GLOBAL BOSS KNOWLEDGE</span><i>READ ONLY · 0 NETWORK</i></div>
      <div class="iris-k-title"><div><h2>${esc(data.encounter?.name||'Encounter knowledge')}</h2><p>Mythic evidence scope · WCL encounter ${esc(data.scope?.encounterId)} · partition ${esc(data.scope?.partition)}</p></div><b>${fmt(mechanics.length)} INVESTIGATIONS</b></div>
      <div class="iris-k-source-grid">${sourceCard('OFFICIAL SEMANTICS',sources.official,'official')}${sourceCard('SPELL STRUCTURE',sources.structural,'structural')}${sourceCard('PUBLIC WCL CORPUS',sources.corpus,'corpus')}</div>
    </div>
    <div class="iris-k-section-head"><div><small>MECHANIC INTELLIGENCE</small><h3>What Iris currently believes</h3></div><p>Every state below is reconstructed from persisted evidence. Provider metadata is context; observed combat remains Warcraft Logs.</p></div>
    <div class="iris-k-mechanics">${mechanics.length?mechanics.map(mechanicCard).join(''):`<div class="iris-k-empty"><b>NO MECHANIC EPISODES YET</b><p>The corpus exists, but Iris has not persisted a mechanic Episode for this encounter yet. The same screen will populate automatically when evidence reaches that stage.</p></div>`}</div>
    <div class="iris-k-contract"><b>EVIDENCE CONTRACT</b><span>Blizzard = published semantics</span><span>DB2 = structural wiring</span><span>WCL = observed combat truth</span><span>Promotion = explicit only</span></div>`;
}

function renderLoading(host,scope){host.innerHTML=`<div class="iris-k-loading"><i></i><b>IRIS IS RECONSTRUCTING BOSS KNOWLEDGE</b><span>${esc(scope?.encounterName||'Selected encounter')} · persisted evidence only</span></div>`;}
function renderError(host,message){host.innerHTML=`<div class="iris-k-empty"><b>IRIS KNOWLEDGE UNAVAILABLE</b><p>${esc(message)}</p><small>No fallback data has been invented.</small></div>`;}

async function loadAndRender(host){
  const scope=currentScope();if(!scope){renderLoading(host,{encounterName:'Waiting for Warcraft Logs encounter scope'});return;}
  const key=`${scope.encounterId}:${scope.difficulty}`;
  if(STATE.scopeKey===key&&STATE.data){render(host,STATE.data);return;}
  if(STATE.loading)return;
  STATE.loading=true;STATE.error=null;renderLoading(host,scope);
  try{
    const url=new URL(ENDPOINT,location.origin);url.searchParams.set('encounter',String(scope.encounterId));url.searchParams.set('difficulty',String(scope.difficulty));
    const response=await fetch(url,{headers:{accept:'application/json'}});const payload=await response.json().catch(()=>null);
    if(!response.ok||!payload?.ok)throw new Error(payload?.error||`HTTP ${response.status}`);
    STATE.scopeKey=key;STATE.data=payload;render(host,payload);
  }catch(error){STATE.error=String(error?.message||error);renderError(host,STATE.error);}finally{STATE.loading=false;}
}

function patch(){
  if(!mechanicsPage())return;
  const ui=ensureTabs();if(!ui)return;
  switchTab(STATE.active);
}

window.addEventListener('avoid:wcl-request-state',event=>{if(event?.detail?.path==='/api/wcl/report'&&event.detail.state==='complete'){STATE.scopeKey=null;STATE.data=null;setTimeout(patch,100);}});
document.addEventListener('DOMContentLoaded',patch,{once:true});
window.addEventListener('load',patch,{once:true});
setInterval(patch,700);
})();
