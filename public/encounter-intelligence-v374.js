(() => {
  const VERSION='3.7.4';
  let cachedModel=null,cachedStatus=null,cachedEncounter=null,modelAt=0,statusAt=0,modelFlight=false,statusFlight=false;
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const fmt=new Intl.NumberFormat();
  const pct=v=>Number.isFinite(Number(v))?`${Math.round(Number(v))}%`:'—';
  const title=v=>String(v||'').replaceAll('-',' ').replace(/\b\w/g,m=>m.toUpperCase());

  function encounterId(){const q=Number(new URLSearchParams(location.search).get('encounter'));if(Number.isFinite(q)&&q>0)return q;const i=Number(window.__AVOID_WCL_INTELLIGENCE__?.encounter?.id);if(Number.isFinite(i)&&i>0)return i;const c=Number(window.__AVOID_WCL__?.encounter?.id);return Number.isFinite(c)&&c>0?c:null;}
  function mechanicsPage(){return Array.from(document.querySelectorAll('.page-banner h2')).some(x=>x.textContent.trim()==='Mechanics Library');}
  function el(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;}
  function tip(text){const n=el('span','ei3-tip','i');n.tabIndex=0;n.dataset.tip=text;n.setAttribute('aria-label',text);return n;}

  async function getJson(url){const r=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store'}),d=await r.json().catch(()=>({}));if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);return d;}
  async function fetchModel(force=false){
    const id=encounterId(),now=Date.now();if(!id||modelFlight)return cachedModel;if(!force&&cachedEncounter===id&&cachedModel&&now-modelAt<5000)return cachedModel;modelFlight=true;
    try{const u=new URL('/api/wcl/corpus',location.origin);u.searchParams.set('encounter',String(id));u.searchParams.set('action','model');u.searchParams.set('_',String(now));const d=await getJson(u);if(d.model){cachedModel=d.model;cachedEncounter=id;modelAt=now;}}
    catch(error){console.warn('[AvoiD v3.7.4 model]',error);}finally{modelFlight=false;}return cachedModel;
  }
  async function fetchStatus(force=false){
    const id=encounterId(),now=Date.now();if(!id||statusFlight)return cachedStatus;if(!force&&cachedEncounter===id&&cachedStatus&&now-statusAt<1800)return cachedStatus;statusFlight=true;
    try{const u=new URL('/api/wcl/corpus',location.origin);u.searchParams.set('encounter',String(id));u.searchParams.set('action','status');u.searchParams.set('_',String(now));const d=await getJson(u);cachedStatus=d.status||null;cachedEncounter=id;statusAt=now;}
    catch(error){console.warn('[AvoiD v3.7.4 status]',error);}finally{statusFlight=false;}return cachedStatus;
  }

  async function corpusAction(action,button){
    const id=encounterId();if(!id)return;const old=button?.textContent||'';if(button){button.disabled=true;button.textContent=action==='improve'?'STARTING…':action==='recompile'?'COMPILING…':`${action.toUpperCase()}…`;}
    try{
      const r=await fetch('/api/wcl/corpus',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({action,encounterId:id,difficulty:Number(cachedModel?.difficulty||5),partition:Number(cachedModel?.resolvedPartition||cachedModel?.partition||0)})});const d=await r.json().catch(()=>({}));if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);
      if(d.status){cachedStatus=d.status;statusAt=Date.now();}if(d.model){cachedModel=d.model;modelAt=Date.now();}else modelAt=0;
      render(cachedModel,cachedStatus);setTimeout(()=>tick(true),500);
    }catch(error){console.warn(`[AvoiD corpus ${action}]`,error);if(button){button.title=String(error?.message||error);button.textContent='TRY AGAIN';setTimeout(()=>{button.disabled=false;button.textContent=old;},2500);}return;}
    if(button){button.disabled=false;button.textContent=old;}
  }

  function simplifyLegacy(panel){panel.classList.add('ei3-active','ei4-active');const h=panel.querySelector('.panel-title h3'),p=panel.querySelector('.panel-title p');if(h)h.textContent='Encounter Corpus';if(p)p.textContent='Persistent WCL model · source-isolated validation';}
  function metric(label,value,help){const n=el('div','ei3-metric');n.append(el('span','',label),el('b','',value),tip(help));return n;}
  function failingGates(model){const checks=model?.validation?.publishChecks||{};return Object.entries(checks).filter(([k,v])=>v!==true&&k!=='manualReviewHold').map(([k])=>title(k));}
  function actionSummary(model){const rec=model?.learning?.enrichmentRecommendation||{};if(rec.mode==='targeted-deep')return`${fmt.format(num(rec.suggestedAdditionalDeepReports))} Deep reports · ~${fmt.format(num(rec.suggestedAdditionalDeepPulls))} pulls · ${fmt.format(num(rec.estimatedExistingWideReportsAvailableForDeep))} Wide ready`;if(rec.mode==='reports-first')return`${fmt.format(num(rec.suggestedAdditionalWideReports))} reports · ${fmt.format(num(rec.suggestedAdditionalDeepReports))} Deep`;if(rec.mode==='diversity-first')return`${fmt.format(num(rec.suggestedAdditionalIndependentSources))} new sources`;return rec.reason||'Review current evidence';}
  function remainingTime(status){const at=num(status?.resumeAt);if(at>0){const sec=Math.max(0,Math.ceil((at-Date.now())/1000));if(sec>=3600)return`${Math.ceil(sec/3600)}h`;if(sec>=60)return`${Math.ceil(sec/60)}m`;return`${sec}s`;}const s=num(status?.rateLimit?.pointsResetIn);if(s>=3600)return`${Math.ceil(s/3600)}h`;if(s>=60)return`${Math.ceil(s/60)}m`;return s>0?`${Math.ceil(s)}s`:'—';}
  function workflowState(status){const s=String(status?.status||'').toLowerCase();if(s==='running')return'running';if(s==='rate-limited')return'rate-limited';if(s==='paused')return'paused';return'ready';}
  function liveNext(model,status){
    const state=workflowState(status),agg=status?.aggregate||{},deepReports=num(agg.deepReports||model?.corpus?.deepReports),deepPulls=num(status?.deepPullCount||agg.deepKillPulls)+num(status?.deepPullCount?0:agg.deepWipePulls),targetReports=num(status?.deepTargetReports)||num(model?.validation?.thresholds?.minDeepReports)||50,targetPulls=num(status?.deepTargetPulls)||num(model?.validation?.thresholds?.minDeepPulls)||300;
    if(state==='running')return{label:'RUNNING',title:title(status?.mode||status?.phase||'Corpus'),detail:`${fmt.format(deepReports)} / ${fmt.format(targetReports)} Deep reports · ${fmt.format(deepPulls)} / ${fmt.format(targetPulls)} pulls`};
    if(state==='rate-limited')return{label:'WCL SLEEP',title:'Rate budget protected',detail:`Resumes automatically in ${remainingTime(status)} · progress is persisted`};
    if(state==='paused')return{label:'PAUSED',title:'Corpus paused safely',detail:status?.message||'Resume when ready.'};
    const rec=model?.learning?.enrichmentRecommendation||{};return{label:'NEXT',title:title(rec.mode||model?.learning?.actionBottleneck||'review'),detail:actionSummary(model)};
  }

  function render(model,status){
    if(!mechanicsPage())return;const panel=document.querySelector('.corpus-workbench');if(!panel||!model)return;simplifyLegacy(panel);
    const agg=status?.aggregate||{},rate=status?.rateLimit||{},deepReports=num(agg.deepReports||model?.corpus?.deepReports),holdout=num(agg.validation?.wideReports||model?.corpus?.validationReports),signature=`${model.evaluatedAt||model.generatedAt||0}:${model.learning?.scorePct||0}:${status?.updatedAt||0}:${deepReports}:${rate.pointsRemaining??'x'}:${status?.status||''}`;let root=panel.querySelector('.encounter-intelligence-v374');if(root?.dataset.signature===signature)return;root?.remove();
    const score=num(model?.learning?.scorePct),grade=model?.learning?.grade||'DISCOVERY',c=model?.learning?.components||{},deepTarget=num(status?.deepTargetReports)||num(model?.validation?.thresholds?.minDeepReports)||50,holdoutTarget=num(model?.validation?.thresholds?.minValidationReports)||50,wclValue=rate?.pointsRemaining!=null&&rate?.limitPerHour?`${fmt.format(num(rate.pointsRemaining))} / ${fmt.format(num(rate.limitPerHour))}`:'—';
    root=el('section','encounter-intelligence-v373 encounter-intelligence-v374');root.dataset.signature=signature;

    const top=el('div','ei3-top'),identity=el('div','ei3-identity'),scoreBox=el('div','ei3-score');identity.append(el('span','ei3-kicker','ENCOUNTER MODEL'),el('h3','',model?.pack?.name||`Encounter ${model.encounterId||''}`));const scoreLine=el('div','ei3-score-line');scoreLine.append(el('b','',`${Math.round(score)}%`),el('em','',grade),tip('Boss Learned is model maturity, not literal boss completion. It combines signal discovery, relation understanding, unseen-log validation, data depth and source diversity.'));scoreBox.append(scoreLine);top.append(identity,scoreBox);root.append(top);
    const meter=el('i','ei3-meter'),fill=el('em');fill.style.width=`${Math.max(0,Math.min(100,score))}%`;meter.append(fill);root.append(meter);

    const metrics=el('div','ei3-metrics ei4-metrics');metrics.append(
      metric('RELATIONS',pct(c.relationUnderstandingPct),'Only origin-verified encounter relationships contribute to this score. Player-sourced aura coincidences are excluded.'),
      metric('DEEP REPORTS',`${fmt.format(deepReports)} / ${fmt.format(deepTarget)}`,'Live Deep-report count from the persistent aggregate, not the last compiled model snapshot.'),
      metric('HOLDOUT',`${fmt.format(holdout)} / ${fmt.format(holdoutTarget)}`,'Reports reserved for source-isolated validation. Raid groups in holdout are not used to train the model.'),
      metric('WCL BUDGET',wclValue,rate?.limitPerHour?`Hourly WCL points remaining / limit. AvoiD protects a reserve and sleeps automatically near the limit. Last-known reset window: ${remainingTime(status)}.`:'No WCL rate snapshot is available yet. The workflow still protects quota when WCL returns rate-limit data.')
    );root.append(metrics);

    const live=liveNext(model,status),next=el('div','ei3-next'),nextCopy=el('div','ei3-next-copy');nextCopy.append(el('span','ei3-kicker',live.label),el('b','',live.title),el('p','',live.detail));next.append(nextCopy);
    const actions=el('div','ei3-actions'),state=workflowState(status);
    if(state==='running'||state==='rate-limited'){const pause=el('button','ei3-btn secondary','PAUSE');pause.addEventListener('click',()=>corpusAction('pause',pause));actions.append(pause);}
    else if(state==='paused'){const resume=el('button','ei3-btn secondary','RESUME');resume.addEventListener('click',()=>corpusAction('resume',resume));actions.append(resume);}
    else{const recompile=el('button','ei3-btn secondary','RECOMPILE · 0 WCL'),improve=el('button','ei3-btn','IMPROVE MODEL');recompile.addEventListener('click',()=>corpusAction('recompile',recompile));improve.addEventListener('click',()=>corpusAction('improve',improve));actions.append(recompile,improve);}
    next.append(actions);root.append(next);

    const details=el('details','ei3-details'),summary=el('summary','','MODEL DETAILS');details.append(summary);const body=el('div','ei3-details-body'),metricsDetail=el('div','ei3-detail-grid');metricsDetail.append(metric('SIGNALS',pct(c.signalDiscoveryPct),'Important encounter signals classified after origin filtering.'),metric('VALIDATION',pct(c.validationConfidencePct),'Confidence on source-isolated unseen reports.'),metric('DATA',pct(c.dataDepthPct),'Live depth across Wide/Deep pulls and distinct reports.'),metric('DIVERSITY',pct(c.sourceDiversityPct),'Representation across independent raid groups.'));body.append(metricsDetail);
    const diag=el('div','ei3-diagnostics'),gates=failingGates(model),origin=model?.learning?.originEvidence||{},rel=model?.learning?.relationUnderstanding||{};diag.append(el('p','',`Status: ${String(status?.status||'ready').toUpperCase()} · ${status?.message||'Persistent corpus ready.'}`));diag.append(el('p','',`Accepted ${num(model?.validation?.acceptedMechanics)} · Rejected ${num(model?.validation?.rejectedMechanics)} · ${gates.length} publication gates open.`));diag.append(el('p','',`Relations: ${num(rel.candidateRelations)} origin-verified · ${num(rel.filteredFriendlyRelations)} filtered noisy/friendly · ${num(rel.unverifiedRelations)} awaiting provenance.`));diag.append(el('p','',`Origin evidence: ${num(origin.abilitiesWithEvidence)} abilities · WCL ${wclValue}${status?.resumeAt?` · resumes ${remainingTime(status)}`:''}.`));const needs=(model?.learning?.needsEvidence||[]).slice(0,4);if(needs.length){const list=el('ul','ei3-needs');for(const r of needs){const li=el('li');li.append(el('b','',r.title),document.createTextNode(` — ${r.detail}`));list.append(li);}diag.append(list);}body.append(diag);details.append(body);root.append(details);

    const titleBlock=panel.querySelector('.panel-title');if(titleBlock)titleBlock.insertAdjacentElement('afterend',root);else panel.prepend(root);
  }

  async function tick(force=false){if(!mechanicsPage())return;const [m,s]=await Promise.all([fetchModel(force),fetchStatus(force)]);if(m)render(m,s);}
  document.addEventListener('click',event=>{if(event.target?.closest?.('nav button'))setTimeout(()=>tick(true),120);},true);
  setInterval(()=>tick(false),2000);window.addEventListener('DOMContentLoaded',()=>tick(true));if(document.readyState!=='loading')tick(true);
  console.info(`[AvoiD Raid Ops] Encounter Corpus UI ${VERSION}`);
})();
