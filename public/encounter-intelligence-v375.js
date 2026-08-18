(() => {
  const VERSION='3.7.5';
  let cachedModel=null,cachedStatus=null,cachedEncounter=null,modelAt=0,statusAt=0,modelFlight=false,statusFlight=false;
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const fmt=new Intl.NumberFormat(undefined,{maximumFractionDigits:0});
  const pct=v=>Number.isFinite(Number(v))?`${Math.round(Number(v))}%`:'—';
  const title=v=>String(v||'').replaceAll('-',' ').replace(/\b\w/g,m=>m.toUpperCase());
  const clamp=v=>Math.max(0,Math.min(1,num(v)));

  function encounterId(){const q=Number(new URLSearchParams(location.search).get('encounter'));if(Number.isFinite(q)&&q>0)return q;const i=Number(window.__AVOID_WCL_INTELLIGENCE__?.encounter?.id);if(Number.isFinite(i)&&i>0)return i;const c=Number(window.__AVOID_WCL__?.encounter?.id);return Number.isFinite(c)&&c>0?c:null;}
  function mechanicsPage(){return Array.from(document.querySelectorAll('.page-banner h2')).some(x=>x.textContent.trim()==='Mechanics Library');}
  function el(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;}
  function tip(text){const n=el('span','ei3-tip','i');n.tabIndex=0;n.dataset.tip=text;n.setAttribute('aria-label',text);return n;}
  function patchVersion(){const b=document.querySelector('.division b');if(b&&b.textContent!==`v${VERSION}`){b.textContent=`v${VERSION}`;b.title=`AvoiD Raid Operations ${VERSION}`;}}
  function mechanicCatalogue(){return Array.from(document.querySelectorAll('article.panel')).find(panel=>panel.querySelector('.panel-title h3')?.textContent.trim()==='Encounter mechanic catalogue')||null;}
  function ensureCorpusPanel(){
    if(!mechanicsPage())return null;
    let panel=document.querySelector('.corpus-workbench');
    if(panel){panel.style.display='';panel.dataset.avoidPageOwner='Mechanics';panel.dataset.avoidCorpusOwner='encounter-intelligence-v375';simplifyLegacy(panel);return panel;}
    const catalogue=mechanicCatalogue();if(!catalogue)return null;
    panel=el('article','panel corpus-workbench');panel.dataset.avoidPageOwner='Mechanics';panel.dataset.avoidCorpusOwner='encounter-intelligence-v375';
    const head=el('div','panel-title'),idx=el('i','', 'AI'),copy=el('div'),h3=el('h3','', 'Encounter Intelligence Corpus'),sub=el('p','', 'Durable hosted WCL corpus · background workflow · diverse raid groups · train/holdout validation · incremental enrichment');
    copy.append(h3,sub);head.append(idx,copy);panel.append(head);catalogue.insertAdjacentElement('beforebegin',panel);simplifyLegacy(panel);return panel;
  }
  function syncCorpusVisibility(){const panel=document.querySelector('.corpus-workbench');if(panel&&!mechanicsPage())panel.style.display='none';}
  async function fetchJson(action){const id=encounterId();if(!id)return null;const u=new URL('/api/wcl/corpus',location.origin);u.searchParams.set('encounter',String(id));u.searchParams.set('action',action);u.searchParams.set('_',String(Date.now()));const r=await fetch(u,{headers:{Accept:'application/json'}}),d=await r.json().catch(()=>({}));if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);return d;}
  async function fetchModel(force=false){const id=encounterId(),now=Date.now();if(!id||modelFlight)return cachedModel;if(!force&&cachedEncounter===id&&cachedModel&&now-modelAt<8000)return cachedModel;modelFlight=true;try{const d=await fetchJson('model');if(d?.model){cachedModel=d.model;cachedEncounter=id;modelAt=now;}}catch(error){console.warn('[AvoiD v3.7.5 model]',error);}finally{modelFlight=false;}return cachedModel;}
  async function fetchStatus(force=false){const id=encounterId(),now=Date.now();if(!id||statusFlight)return cachedStatus;if(!force&&cachedEncounter===id&&cachedStatus&&now-statusAt<1200)return cachedStatus;statusFlight=true;try{const d=await fetchJson('status');if(d?.status){cachedStatus=d.status;cachedEncounter=id;statusAt=now;}}catch(error){console.warn('[AvoiD v3.7.5 status]',error);}finally{statusFlight=false;}return cachedStatus;}

  async function corpusAction(action,button){
    const id=encounterId();if(!id)return;const old=button?.textContent||'';if(button){button.disabled=true;button.textContent=action==='improve'?'STARTING…':action==='recompile'?'COMPILING…':`${action.toUpperCase()}…`;}
    try{
      const r=await fetch('/api/wcl/corpus',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({action,encounterId:id,difficulty:Number(cachedModel?.difficulty||cachedStatus?.difficulty||5),partition:Number(cachedModel?.resolvedPartition||cachedModel?.partition||cachedStatus?.partition||0)})});
      const d=await r.json().catch(()=>({}));if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);
      if(d.status)cachedStatus=d.status;if(d.model)cachedModel=d.model;modelAt=0;statusAt=0;await tick(true);
    }catch(error){console.warn(`[AvoiD corpus ${action}]`,error);if(button){button.title=String(error?.message||error);button.textContent='TRY AGAIN';setTimeout(()=>{button.disabled=false;button.textContent=old;},2500);}return;}
    if(button){button.disabled=false;button.textContent=old;}
  }

  function simplifyLegacy(panel){
    panel.classList.add('ei3-active','ei5-active');const h=panel.querySelector('.panel-title h3'),p=panel.querySelector('.panel-title p');if(h)h.textContent='Encounter Corpus';if(p)p.textContent='Persistent WCL model · source-isolated validation';
  }
  function metricSlot(key){const n=el('div','ei3-metric');n.dataset.metric=key;const label=el('span'),value=el('b'),help=tip('');n.append(label,value,help);return n;}
  function setMetric(root,key,label,value,help){const n=root.querySelector(`[data-metric="${key}"]`);if(!n)return;const parts=n.children;parts[0].textContent=label;parts[1].textContent=value;parts[2].dataset.tip=help;parts[2].setAttribute('aria-label',help);}
  function data(root,key,value){const n=root.querySelector(`[data-live="${key}"]`);if(n)n.textContent=value;}
  function modelCorpus(model,status){return status?.model?.liveCorpus||model?.corpus||{};}
  function thresholds(model,status){return status?.model?.thresholds||model?.validation?.thresholds||{};}
  function components(model,status){return status?.model?.learningComponents||model?.learning?.components||{};}
  function learned(model,status){return num(status?.model?.learnedPct??model?.learning?.scorePct);}
  function grade(model,status){return status?.model?.learningGrade||model?.learning?.grade||'DISCOVERY';}
  function relationPct(model,status){return num(status?.model?.relationUnderstanding?.scorePct??components(model,status).relationUnderstandingPct);}
  function wclText(status){const r=status?.rateLimit||{};return r.pointsRemaining==null?'—':`${fmt.format(Math.max(0,num(r.pointsRemaining)))} / ${fmt.format(num(r.limitPerHour))}`;}
  function wclHelp(status){const r=status?.rateLimit||{};if(!r.limitPerHour)return'Warcraft Logs hourly API budget. The durable workflow automatically sleeps before the safety reserve is exhausted.';const reset=num(r.pointsResetIn),mins=Math.max(1,Math.ceil(reset/60));return `${fmt.format(Math.max(0,num(r.pointsRemaining)))} of ${fmt.format(num(r.limitPerHour))} WCL points remain this hour. Current window resets in about ${mins} min. AvoiD automatically sleeps before the safety reserve is crossed.`;}
  function validationReports(model,status){return num(modelCorpus(model,status).validationReports??status?.aggregate?.validation?.wideReports);}

  function phaseMetrics(model,status){
    const state=status?.status||'ready',phase=status?.phase||'complete',agg=status?.aggregate||{},c=modelCorpus(model,status),t=thresholds(model,status),rel=relationPct(model,status);
    if((state==='running'||state==='rate-limited')&&phase==='wide')return[
      ['m1','WIDE PULLS',`${fmt.format(num(status?.pullCount))} / ${fmt.format(num(status?.targetPulls))}`,'Current Wide-corpus progress. Each retained pull broadens cross-report statistics before Deep event profiling.'],
      ['m2','WIDE REPORTS',`${fmt.format(num(agg.wideReports??c.wideReports))} / ${fmt.format(num(t.minWideReports)||250)}`,'Distinct reports are a publication gate. This number should rise while the current Wide enrichment is running.'],
      ['m3','HOLDOUT',`${fmt.format(validationReports(model,status))} / ${fmt.format(num(t.minValidationReports)||50)}`,'Source-isolated reports reserved for unseen-log validation.'],
      ['m4','WCL BUDGET',wclText(status),wclHelp(status)],
    ];
    if((state==='running'||state==='rate-limited')&&phase==='deep')return[
      ['m1','DEEP PULLS',`${fmt.format(num(status?.deepPullCount))} / ${fmt.format(num(status?.deepTargetPulls))}`,'Event-level Deep pulls being profiled for state, provenance and temporal relationships.'],
      ['m2','DEEP REPORTS',`${fmt.format(num(agg.deepReports??c.deepReports))} / ${fmt.format(num(status?.deepTargetReports)||num(t.minDeepReports)||50)}`,'Distinct reports with event-level Deep profiling.'],
      ['m3','RELATIONS',pct(rel),'Relationship maturity after provenance filtering. Unverified cast→aura coincidences do not count.'],
      ['m4','WCL BUDGET',wclText(status),wclHelp(status)],
    ];
    if((state==='running'||state==='rate-limited')&&String(phase).startsWith('discover')||((state==='running'||state==='rate-limited')&&phase==='expand-sources'))return[
      ['m1','SOURCES',fmt.format(num(status?.sourceStats?.total)),'Independent guild/uploader sources discovered for corpus diversity.'],
      ['m2','CANDIDATES',fmt.format(num(status?.candidateCount)),'Candidate reports available for Wide profiling.'],
      ['m3','WIDE PULLS',fmt.format(num(status?.pullCount)),'Retained matching pulls already persisted.'],
      ['m4','WCL BUDGET',wclText(status),wclHelp(status)],
    ];
    return[
      ['m1','RELATIONS',pct(rel),'How much important encounter structure is connected by validated state, completion or origin-verified temporal relationships.'],
      ['m2','DEEP REPORTS',`${fmt.format(num(agg.deepReports??c.deepReports))} / ${fmt.format(num(t.minDeepReports)||50)}`,'Reports with event-level Deep profiling.'],
      ['m3','HOLDOUT',`${fmt.format(validationReports(model,status))} / ${fmt.format(num(t.minValidationReports)||50)}`,'Reports reserved for source-isolated unseen-log validation.'],
      ['m4','WCL BUDGET',wclText(status),wclHelp(status)],
    ];
  }
  function workProgress(status){
    const phase=status?.phase||'';
    if(phase==='wide')return clamp(num(status?.pullCount)/Math.max(1,num(status?.targetPulls)));
    if(phase==='deep')return clamp(num(status?.deepPullCount)/Math.max(1,num(status?.deepTargetPulls)));
    if(phase==='discover-ranking'||phase==='discover-identities'||phase==='expand-sources')return clamp(num(status?.progress?.discovery));
    return 1;
  }
  function formatResume(status){const resume=num(status?.resumeAt);if(!resume)return null;const sec=Math.max(0,Math.ceil((resume-Date.now())/1000));if(sec<60)return`${sec}s`;const min=Math.ceil(sec/60);return`${min}m`;}
  function workCopy(model,status){
    const state=status?.status||'ready',phase=status?.phase||'complete',agg=status?.aggregate||{},c=modelCorpus(model,status),t=thresholds(model,status);
    if(state==='rate-limited')return{label:'WCL SLEEP',title:'Rate budget protected',detail:`${title(phase)} paused safely · ${wclText(status)} points · resumes automatically${formatResume(status)?` in ${formatResume(status)}`:''}.`};
    if(state==='running'&&phase==='wide')return{label:'RUNNING · WIDE',title:'Expanding report breadth',detail:`${fmt.format(num(status.pullCount))} / ${fmt.format(num(status.targetPulls))} pulls · ${fmt.format(num(agg.wideReports??c.wideReports))} / ${fmt.format(num(t.minWideReports)||250)} reports · ${fmt.format(validationReports(model,status))} / ${fmt.format(num(t.minValidationReports)||50)} holdout.`};
    if(state==='running'&&phase==='deep')return{label:'RUNNING · DEEP',title:'Learning event relationships',detail:`${fmt.format(num(status.deepPullCount))} / ${fmt.format(num(status.deepTargetPulls))} Deep pulls · ${fmt.format(num(agg.deepReports??c.deepReports))} reports · source provenance and temporal evidence are being persisted.`};
    if(state==='running')return{label:`RUNNING · ${String(phase).toUpperCase()}`,title:'Expanding corpus',detail:status?.message||'Persistent workflow is progressing in the background.'};
    if(state==='paused')return{label:'PAUSED',title:'Corpus checkpoint retained',detail:status?.message||'No WCL points are being consumed while paused.'};
    const rec=model?.learning?.enrichmentRecommendation||status?.model?.enrichmentRecommendation||{};
    const detail=rec.mode==='targeted-deep'?`${fmt.format(num(rec.suggestedAdditionalDeepReports))} Deep reports · ~${fmt.format(num(rec.suggestedAdditionalDeepPulls))} pulls`:rec.mode==='reports-first'?`${fmt.format(num(rec.suggestedAdditionalWideReports))} Wide reports · ${fmt.format(num(rec.suggestedAdditionalValidationReports))} holdout reports`:rec.reason||'Review current evidence';
    return{label:'NEXT',title:title(rec.mode||'review'),detail};
  }
  function failingGates(model,status){const checks=status?.model?.publishChecks||model?.validation?.publishChecks||{};return Object.entries(checks).filter(([k,v])=>v!==true&&k!=='manualReviewHold').map(([k])=>title(k));}

  function buildRoot(panel,model,status,wasOpen=false){
    const root=el('section','encounter-intelligence-v375');
    const top=el('div','ei3-top'),identity=el('div','ei3-identity'),scoreBox=el('div','ei3-score');identity.append(el('span','ei3-kicker','ENCOUNTER MODEL'),el('h3','',model?.pack?.name||`Encounter ${model?.encounterId||''}`));const scoreLine=el('div','ei3-score-line');const score=el('b');score.dataset.live='score';const g=el('em');g.dataset.live='grade';scoreLine.append(score,g,tip('Boss Learned is evidence-weighted model maturity, not literal boss completion. It combines signal identification, relationship understanding, unseen-log validation, corpus depth and source diversity.'));scoreBox.append(scoreLine);top.append(identity,scoreBox);root.append(top);
    const meter=el('i','ei3-meter'),fill=el('em');fill.dataset.live='score-fill';meter.append(fill);root.append(meter);
    const metrics=el('div','ei3-metrics ei5-metrics');for(const key of ['m1','m2','m3','m4'])metrics.append(metricSlot(key));root.append(metrics);
    const next=el('div','ei3-next ei5-next'),nextCopy=el('div','ei3-next-copy');const kicker=el('span','ei3-kicker');kicker.dataset.live='work-label';const wt=el('b');wt.dataset.live='work-title';const wd=el('p');wd.dataset.live='work-detail';const workMeter=el('i','ei5-work-meter'),workFill=el('em');workFill.dataset.live='work-fill';workMeter.append(workFill);nextCopy.append(kicker,wt,wd,workMeter);next.append(nextCopy);
    const actions=el('div','ei3-actions');const state=status?.status||'ready';if(state==='running'||state==='rate-limited'){const pause=el('button','ei3-btn secondary','PAUSE');pause.addEventListener('click',()=>corpusAction('pause',pause));actions.append(pause);}else if(state==='paused'){const resume=el('button','ei3-btn','RESUME');resume.addEventListener('click',()=>corpusAction('resume',resume));actions.append(resume);}else{const recompile=el('button','ei3-btn secondary','RECOMPILE · 0 WCL'),improve=el('button','ei3-btn','IMPROVE MODEL');recompile.addEventListener('click',()=>corpusAction('recompile',recompile));improve.addEventListener('click',()=>corpusAction('improve',improve));actions.append(recompile,improve);}next.append(actions);root.append(next);
    const details=el('details','ei3-details');details.open=wasOpen;details.append(el('summary','','MODEL DETAILS'));const body=el('div','ei3-details-body'),grid=el('div','ei3-detail-grid');for(const key of ['d1','d2','d3','d4'])grid.append(metricSlot(key));body.append(grid);const diag=el('div','ei3-diagnostics');for(const key of ['diag1','diag2','diag3']){const p=el('p');p.dataset.live=key;diag.append(p);}const needs=el('ul','ei3-needs');needs.dataset.live='needs';diag.append(needs);body.append(diag);details.append(body);root.append(details);
    const titleBlock=panel.querySelector('.panel-title');if(titleBlock)titleBlock.insertAdjacentElement('afterend',root);else panel.prepend(root);return root;
  }

  function updateRoot(root,model,status){
    const score=learned(model,status),g=grade(model,status),c=components(model,status),metrics=phaseMetrics(model,status),work=workCopy(model,status),rel=status?.model?.relationUnderstanding||model?.learning?.relationUnderstanding||{},origin=status?.model?.originEvidence||model?.learning?.originEvidence||{},gates=failingGates(model,status);
    data(root,'score',`${Math.round(score)}%`);data(root,'grade',g);const sf=root.querySelector('[data-live="score-fill"]');if(sf)sf.style.width=`${Math.max(0,Math.min(100,score))}%`;
    for(const [key,label,value,help] of metrics)setMetric(root,key,label,value,help);
    data(root,'work-label',work.label);data(root,'work-title',work.title);data(root,'work-detail',work.detail);const wf=root.querySelector('[data-live="work-fill"]');if(wf)wf.style.width=`${Math.round(workProgress(status)*100)}%`;
    setMetric(root,'d1','SIGNALS',pct(c.signalDiscoveryPct),'Important encounter signals classified after encounter-origin filtering.');
    setMetric(root,'d2','RELATIONS',pct(c.relationUnderstandingPct),'Validated state, completion and origin-verified temporal relationship understanding.');
    setMetric(root,'d3','VALIDATION',pct(c.validationConfidencePct),'Confidence measured on source-isolated unseen reports.');
    setMetric(root,'d4','DATA DEPTH',pct(c.dataDepthPct),'Coverage across distinct Wide/Deep reports and pulls. Source diversity is tracked separately.');
    data(root,'diag1',`Accepted ${fmt.format(num(status?.model?.acceptedMechanics??model?.validation?.acceptedMechanics))} · Rejected ${fmt.format(num(status?.model?.rejectedMechanics??model?.validation?.rejectedMechanics))} · ${gates.length} publication gates still open.`);
    data(root,'diag2',`Temporal relations: ${fmt.format(num(rel.candidateRelations))} verified · ${fmt.format(num(rel.unverifiedRelations))} unverified · ${fmt.format(num(rel.rawCandidateRelations))} raw hypotheses.`);
    data(root,'diag3',`Origin provenance: ${fmt.format(num(origin.abilitiesWithEvidence))} abilities with Deep source evidence · ${fmt.format(num(origin.encounterClassified))} encounter-side · ${fmt.format(num(origin.friendlyClassified))} friendly-player.`);
    const list=root.querySelector('[data-live="needs"]');if(list){list.replaceChildren();for(const r of (model?.learning?.needsEvidence||[]).slice(0,4)){const li=el('li');li.append(el('b','',r.title),document.createTextNode(` — ${r.detail}`));list.append(li);}}
  }

  function structuralSignature(model,status){return`${model?.engineVersion||''}:${model?.encounterId||''}:${status?.status||'ready'}:${status?.phase||'complete'}`;}
  function render(model,status){
    if(!mechanicsPage())return;patchVersion();const panel=ensureCorpusPanel();if(!panel||!model)return;simplifyLegacy(panel);
    let root=panel.querySelector('.encounter-intelligence-v375');const sig=structuralSignature(model,status);
    if(!root||root.dataset.structure!==sig){const wasOpen=Boolean(root?.querySelector('.ei3-details')?.open);root?.remove();panel.querySelector('.encounter-intelligence-v374')?.remove();panel.querySelector('.encounter-intelligence-v373')?.remove();root=buildRoot(panel,model,status,wasOpen);root.dataset.structure=sig;}
    updateRoot(root,model,status);
  }

  async function tick(force=false){patchVersion();if(!mechanicsPage()){syncCorpusVisibility();return;}ensureCorpusPanel();const [status,model]=await Promise.all([fetchStatus(force),fetchModel(force)]);if(model)render(model,status);}
  window.__AVOID_ENCOUNTER_CORPUS_OWNER__=Object.freeze({version:VERSION,owner:'encounter-intelligence-v375',pageOwner:'Mechanics',writerPolicy:'single-corpus-writer',historicalWriters:Object.freeze(['applyCorpusWorkbench']),legacyRendererPolicy:'physically-retired-no-runtime-binding',legacyCompatibilityBinding:false,canonicalPanelCreation:true,crossPageVisibilityOwner:'encounter-intelligence-v375',pollingIntervalMs:1500});
  document.addEventListener('click',event=>{if(event.target?.closest?.('nav button'))setTimeout(()=>tick(true),120);},true);
  window.addEventListener('popstate',syncCorpusVisibility);
  setInterval(()=>tick(false),1500);window.addEventListener('DOMContentLoaded',()=>tick(true));if(document.readyState!=='loading')tick(true);
  console.info(`[AvoiD Raid Ops] Encounter Corpus UI ${VERSION}`);
})();
