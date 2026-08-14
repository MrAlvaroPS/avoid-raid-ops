(() => {
  const VERSION='3.7.3';
  let cachedModel=null,cachedEncounter=null,fetchAt=0,inFlight=false;
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const fmt=new Intl.NumberFormat();
  const pct=v=>Number.isFinite(Number(v))?`${Math.round(Number(v))}%`:'—';
  const title=v=>String(v||'').replaceAll('-',' ').replace(/\b\w/g,m=>m.toUpperCase());

  function encounterId(){const q=Number(new URLSearchParams(location.search).get('encounter'));if(Number.isFinite(q)&&q>0)return q;const i=Number(window.__AVOID_WCL_INTELLIGENCE__?.encounter?.id);if(Number.isFinite(i)&&i>0)return i;const c=Number(window.__AVOID_WCL__?.encounter?.id);return Number.isFinite(c)&&c>0?c:null;}
  function mechanicsPage(){return Array.from(document.querySelectorAll('.page-banner h2')).some(x=>x.textContent.trim()==='Mechanics Library');}
  function el(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;}
  function tip(text){const n=el('span','ei3-tip','i');n.tabIndex=0;n.dataset.tip=text;n.setAttribute('aria-label',text);return n;}

  async function fetchModel(force=false){
    const id=encounterId();if(!id||inFlight)return cachedModel;const now=Date.now();if(!force&&cachedEncounter===id&&cachedModel&&now-fetchAt<10000)return cachedModel;inFlight=true;
    try{const u=new URL('/api/wcl/corpus',location.origin);u.searchParams.set('encounter',String(id));u.searchParams.set('action','model');u.searchParams.set('_',String(now));const r=await fetch(u,{headers:{Accept:'application/json'}}),d=await r.json().catch(()=>({}));if(r.ok&&d?.ok&&d?.model){cachedModel=d.model;cachedEncounter=id;fetchAt=now;}}
    catch(error){console.warn('[AvoiD v3.7.3 encounter corpus]',error);}finally{inFlight=false;}return cachedModel;
  }

  async function corpusAction(action,button){
    const id=encounterId();if(!id)return;const old=button?.textContent||'';if(button){button.disabled=true;button.textContent=action==='improve'?'STARTING…':action==='recompile'?'COMPILING…':`${action.toUpperCase()}…`;}
    try{const r=await fetch('/api/wcl/corpus',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({action,encounterId:id,difficulty:Number(cachedModel?.difficulty||5),partition:Number(cachedModel?.resolvedPartition||cachedModel?.partition||0)})});const d=await r.json().catch(()=>({}));if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);cachedModel=d.model||cachedModel;fetchAt=0;setTimeout(()=>tick(true),700);}
    catch(error){console.warn(`[AvoiD corpus ${action}]`,error);if(button){button.title=String(error?.message||error);button.textContent='TRY AGAIN';setTimeout(()=>{button.disabled=false;button.textContent=old;},2500);}return;}
    if(button){button.disabled=false;button.textContent=old;}
  }

  function stateFromLegacy(panel){const texts=Array.from(panel.querySelectorAll('.corpus-actions button')).map(b=>b.textContent.trim());if(texts.includes('PAUSE'))return'running';if(texts.includes('RESUME'))return'paused';return'ready';}
  function simplifyLegacy(panel){
    panel.classList.add('ei3-active');const h=panel.querySelector('.panel-title h3'),p=panel.querySelector('.panel-title p');if(h)h.textContent='Encounter Corpus';if(p)p.textContent='Persistent WCL model · source-isolated validation';
  }

  function metric(label,value,help){const n=el('div','ei3-metric');n.append(el('span','',label),el('b','',value),tip(help));return n;}
  function failingGates(model){const checks=model?.validation?.publishChecks||{};return Object.entries(checks).filter(([k,v])=>v!==true&&k!=='manualReviewHold').map(([k])=>title(k));}
  function actionSummary(model){const rec=model?.learning?.enrichmentRecommendation||{};if(rec.mode==='targeted-deep')return`${fmt.format(num(rec.suggestedAdditionalDeepReports))} Deep reports · ~${fmt.format(num(rec.suggestedAdditionalDeepPulls))} pulls · ${fmt.format(num(rec.estimatedExistingWideReportsAvailableForDeep))} Wide ready`;if(rec.mode==='reports-first')return`${fmt.format(num(rec.suggestedAdditionalWideReports))} reports · ${fmt.format(num(rec.suggestedAdditionalDeepReports))} Deep`;if(rec.mode==='diversity-first')return`${fmt.format(num(rec.suggestedAdditionalIndependentSources))} new sources`;return rec.reason||'Review current evidence';}

  function render(model){
    if(!mechanicsPage())return;const panel=document.querySelector('.corpus-workbench');if(!panel||!model)return;simplifyLegacy(panel);
    const signature=`${model.generatedAt||0}:${model.learning?.scorePct||0}:${model.validation?.acceptedMechanics||0}:${model.engineVersion||''}:${model.learning?.originEvidence?.abilitiesWithEvidence||0}`;let root=panel.querySelector('.encounter-intelligence-v373');if(root?.dataset.signature===signature)return;root?.remove();
    const score=num(model?.learning?.scorePct),grade=model?.learning?.grade||'DISCOVERY',c=model?.learning?.components||{},rec=model?.learning?.enrichmentRecommendation||{},state=stateFromLegacy(panel),deepReports=num(model?.corpus?.deepReports),deepTarget=num(model?.validation?.thresholds?.minDeepReports)||50,holdout=num(model?.corpus?.validationReports),holdoutTarget=num(model?.validation?.thresholds?.minValidationReports)||50;
    root=el('section','encounter-intelligence-v373');root.dataset.signature=signature;

    const top=el('div','ei3-top'),identity=el('div','ei3-identity'),scoreBox=el('div','ei3-score');identity.append(el('span','ei3-kicker','ENCOUNTER MODEL'),el('h3','',model?.pack?.name||`Encounter ${model.encounterId||''}`));const scoreLine=el('div','ei3-score-line');scoreLine.append(el('b','',`${Math.round(score)}%`),el('em','',grade),tip('Boss Learned is model maturity, not literal boss completion. It combines discovered signals, understood relationships, unseen-log validation, data depth and source diversity.'));scoreBox.append(scoreLine);top.append(identity,scoreBox);root.append(top);
    const meter=el('i','ei3-meter'),fill=el('em');fill.style.width=`${Math.max(0,Math.min(100,score))}%`;meter.append(fill);root.append(meter);

    const metrics=el('div','ei3-metrics');metrics.append(
      metric('RELATIONS',pct(c.relationUnderstandingPct),'How much of the important mechanic/state structure is connected by validated relationships. This is the main semantic confidence metric.'),
      metric('DEEP REPORTS',`${fmt.format(deepReports)} / ${fmt.format(deepTarget)}`,'Reports with event-level Deep profiling. Deep data is needed for state alignment, temporal relations and origin evidence.'),
      metric('HOLDOUT',`${fmt.format(holdout)} / ${fmt.format(holdoutTarget)}`,'Reports reserved for source-isolated validation. Raid groups in holdout are not used to train the model.')
    );root.append(metrics);

    const next=el('div','ei3-next'),nextCopy=el('div','ei3-next-copy');nextCopy.append(el('span','ei3-kicker','NEXT'),el('b','',title(rec.mode||model?.learning?.actionBottleneck||'review')),el('p','',actionSummary(model)));next.append(nextCopy);
    const actions=el('div','ei3-actions');
    if(state==='running'){const pause=el('button','ei3-btn secondary','PAUSE');pause.addEventListener('click',()=>corpusAction('pause',pause));actions.append(pause);}
    else if(state==='paused'){const resume=el('button','ei3-btn secondary','RESUME');resume.addEventListener('click',()=>corpusAction('resume',resume));actions.append(resume);}
    else{const recompile=el('button','ei3-btn secondary','RECOMPILE · 0 WCL'),improve=el('button','ei3-btn','IMPROVE MODEL');recompile.addEventListener('click',()=>corpusAction('recompile',recompile));improve.addEventListener('click',()=>corpusAction('improve',improve));actions.append(recompile,improve);}
    next.append(actions);root.append(next);

    const details=el('details','ei3-details'),summary=el('summary','','MODEL DETAILS');details.append(summary);const body=el('div','ei3-details-body');
    const metricsDetail=el('div','ei3-detail-grid');metricsDetail.append(
      metric('SIGNALS',pct(c.signalDiscoveryPct),'Important encounter signals classified after origin filtering.'),
      metric('VALIDATION',pct(c.validationConfidencePct),'Confidence on source-isolated unseen reports.'),
      metric('DATA',pct(c.dataDepthPct),'Depth across Wide/Deep pulls and distinct reports.'),
      metric('DIVERSITY',pct(c.sourceDiversityPct),'Representation across independent raid groups.')
    );body.append(metricsDetail);
    const diag=el('div','ei3-diagnostics'),gates=failingGates(model),origin=model?.learning?.originEvidence||{},focus=model?.learning?.enrichmentFocusAbilityIds||[];
    diag.append(el('p','',`Accepted ${num(model?.validation?.acceptedMechanics)} · Rejected ${num(model?.validation?.rejectedMechanics)} · ${gates.length} publication gates open.`));
    diag.append(el('p','',`Lowest dimension: ${title(model?.learning?.lowestDimension||'—')} · Action bottleneck: ${title(model?.learning?.actionBottleneck||'—')}.`));
    diag.append(el('p','',`Origin evidence: ${num(origin.abilitiesWithEvidence)} abilities classified from Deep event sources. Focus queue: ${focus.length} abilities.`));
    const needs=(model?.learning?.needsEvidence||[]).slice(0,4);if(needs.length){const list=el('ul','ei3-needs');for(const r of needs){const li=el('li');li.append(el('b','',r.title),document.createTextNode(` — ${r.detail}`));list.append(li);}diag.append(list);}body.append(diag);details.append(body);root.append(details);

    const titleBlock=panel.querySelector('.panel-title');if(titleBlock)titleBlock.insertAdjacentElement('afterend',root);else panel.prepend(root);
  }

  async function tick(force=false){if(!mechanicsPage())return;const m=await fetchModel(force);if(m)render(m);}
  document.addEventListener('click',event=>{if(event.target?.closest?.('nav button'))setTimeout(()=>tick(true),120);},true);
  setInterval(()=>tick(false),2200);window.addEventListener('DOMContentLoaded',()=>tick(true));if(document.readyState!=='loading')tick(true);
  console.info(`[AvoiD Raid Ops] Encounter Corpus UI ${VERSION}`);
})();
