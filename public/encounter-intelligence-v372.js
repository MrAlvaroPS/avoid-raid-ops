(() => {
  const VERSION='3.7.2';
  let cachedModel=null,cachedEncounter=null,fetchAt=0,inFlight=false;
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const fmt=new Intl.NumberFormat();
  const pct=v=>Number.isFinite(Number(v))?`${Math.round(Number(v))}%`:'—';
  const title=v=>String(v||'').replaceAll('-',' ').replace(/\b\w/g,m=>m.toUpperCase());

  function encounterId(){const q=Number(new URLSearchParams(location.search).get('encounter'));if(Number.isFinite(q)&&q>0)return q;const i=Number(window.__AVOID_WCL_INTELLIGENCE__?.encounter?.id);if(Number.isFinite(i)&&i>0)return i;const c=Number(window.__AVOID_WCL__?.encounter?.id);return Number.isFinite(c)&&c>0?c:null;}
  function mechanicsPage(){return Array.from(document.querySelectorAll('.page-banner h2')).some(x=>x.textContent.trim()==='Mechanics Library');}
  function el(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;}
  function tip(text,label='?'){const n=el('button','ei2-tip',label);n.type='button';n.tabIndex=0;n.dataset.tip=text;n.setAttribute('aria-label',text);return n;}

  async function fetchModel(force=false){
    const id=encounterId();if(!id||inFlight)return cachedModel;const now=Date.now();if(!force&&cachedEncounter===id&&cachedModel&&now-fetchAt<10000)return cachedModel;inFlight=true;
    try{const u=new URL('/api/wcl/corpus',location.origin);u.searchParams.set('encounter',String(id));u.searchParams.set('action','model');u.searchParams.set('_',String(now));const r=await fetch(u,{headers:{Accept:'application/json'}}),d=await r.json().catch(()=>({}));if(r.ok&&d?.ok&&d?.model){cachedModel=d.model;cachedEncounter=id;fetchAt=now;}}
    catch(error){console.warn('[AvoiD v3.7.2 encounter intelligence]',error);}finally{inFlight=false;}return cachedModel;
  }

  const componentMeta={
    signalDiscoveryPct:['SIGNALS','How much of the important encounter signal space is classified after non-encounter filtering.'],
    relationUnderstandingPct:['RELATIONS','How well state, completion and temporal relationships are actually understood. This is deliberately separate from simply finding abilities.'],
    validationConfidencePct:['VALIDATION','Confidence after source-isolated holdout, recalculated using only mechanics that survived the v3.7.2 policy.'],
    dataDepthPct:['DATA','Whether Wide pulls, Deep pulls and distinct report counts are deep enough for safe publication.'],
    sourceDiversityPct:['DIVERSITY','How broadly the corpus represents independent raid groups and isolated validation sources.'],
  };
  function metric(key,value){const [label,help]=componentMeta[key];const n=el('button','ei2-metric');n.type='button';n.dataset.tip=help;n.append(el('span','',label),el('b','',pct(value)));return n;}
  function bandCopy(grade){return grade==='VERIFIED'?'Verified encounter model':grade==='MATURE'?'Broadly understood':grade==='STRONG'?'Strong structure, targeted gaps remain':grade==='PARTIAL'?'Useful structure, material gaps remain':grade==='LEARNING'?'Repeatable patterns are emerging':'Mapping the encounter';}
  function compactLearned(model){const rows=model?.learning?.learnedHighlights||[];if(!rows.length)return'No validated encounter structure yet.';return rows.slice(0,3).map(r=>r.title).join(' · ');}
  function compactGap(model){const row=model?.learning?.needsEvidence?.[0];return row?`${row.title} — ${row.detail}`:'No major evidence gap exposed.';}
  function failingGates(model){const checks=model?.validation?.publishChecks||{};return Object.entries(checks).filter(([k,v])=>v!==true&&k!=='manualReviewHold').map(([k])=>title(k));}

  function actionChips(rec){const row=el('div','ei2-chips'),mode=rec?.mode;
    const add=(value,label,prefix='+')=>{if(!(num(value)>0))return;const c=el('span','ei2-chip');c.append(el('b','',`${prefix}${fmt.format(Math.round(num(value)))}`),document.createTextNode(` ${label}`));row.append(c);};
    if(mode==='targeted-deep'){
      add(rec?.suggestedAdditionalDeepReports,'Deep reports');add(rec?.suggestedAdditionalDeepPulls,'Deep pulls','~+');
      if(num(rec?.estimatedExistingWideReportsAvailableForDeep)>0){const c=el('span','ei2-chip muted',`${fmt.format(num(rec.estimatedExistingWideReportsAvailableForDeep))} existing Wide ready`);row.append(c);}
    }else{add(rec?.suggestedAdditionalWideReports,'reports');add(rec?.suggestedAdditionalWidePulls,'Wide pulls');add(rec?.suggestedAdditionalDeepReports,'Deep reports');}
    return row;
  }

  async function improve(button){
    const id=encounterId();if(!id)return;const old=button.textContent;button.disabled=true;button.textContent='STARTING…';
    try{const r=await fetch('/api/wcl/corpus',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({action:'improve',encounterId:id,difficulty:Number(cachedModel?.difficulty||5),partition:Number(cachedModel?.resolvedPartition||cachedModel?.partition||0)})});const d=await r.json().catch(()=>({}));if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);button.textContent='RUNNING';setTimeout(()=>location.reload(),900);}
    catch(error){console.warn('[AvoiD improve model]',error);button.textContent='TRY AGAIN';button.title=String(error?.message||error);button.disabled=false;setTimeout(()=>{if(!button.disabled)button.textContent=old;},3500);}
  }

  function isRunning(panel){return Array.from(panel.querySelectorAll('.corpus-actions button')).some(b=>b.textContent.trim()==='PAUSE');}
  function simplifyLegacy(panel){
    panel.classList.add('ei2-active');const h=panel.querySelector('.panel-title h3'),p=panel.querySelector('.panel-title p');if(h)h.textContent='Encounter Corpus';if(p)p.textContent='Persistent WCL research · background learning · source-isolated validation';
    for(const b of panel.querySelectorAll('.corpus-actions button'))if(/^ENRICH\b/.test(b.textContent.trim()))b.style.display='none';
  }

  function render(model){
    if(!mechanicsPage())return;const panel=document.querySelector('.corpus-workbench');if(!panel||!model)return;simplifyLegacy(panel);
    const signature=`${model.generatedAt||0}:${model.learning?.scorePct||0}:${model.validation?.acceptedMechanics||0}:${model.engineVersion||''}`;let root=panel.querySelector('.encounter-intelligence-v372');if(root?.dataset.signature===signature){simplifyLegacy(panel);return;}root?.remove();
    const score=num(model?.learning?.scorePct),grade=model?.learning?.grade||'DISCOVERY',c=model?.learning?.components||{},rec=model?.learning?.enrichmentRecommendation||{},running=isRunning(panel);
    root=el('section','encounter-intelligence-v372');root.dataset.signature=signature;

    const head=el('div','ei2-head'),copy=el('div','ei2-head-copy'),scoreBox=el('div','ei2-score');copy.append(el('span','ei2-kicker','ENCOUNTER MODEL'),el('h3','',model?.pack?.name||`Encounter ${model.encounterId||''}`),el('p','',bandCopy(grade)));
    const scoreLine=el('div','ei2-score-line');scoreLine.append(el('b','',`${Math.round(score)}%`),el('em','',grade),tip('Boss Learned is an evidence-weighted model maturity index, not a literal percentage of every mechanic. It combines signals, relationships, validation, data depth and source diversity.','i'));scoreBox.append(scoreLine);head.append(copy,scoreBox);root.append(head);
    const bar=el('i','ei2-main-meter'),fill=el('em');fill.style.width=`${Math.max(0,Math.min(100,score))}%`;bar.append(fill);root.append(bar);

    const metrics=el('div','ei2-metrics');for(const key of Object.keys(componentMeta))metrics.append(metric(key,c[key]));root.append(metrics);

    const brief=el('div','ei2-brief');const learned=el('div','ei2-brief-item'),gap=el('div','ei2-brief-item gap');learned.append(el('span','ei2-kicker','LEARNED'),el('p','',compactLearned(model)));gap.append(el('span','ei2-kicker','NEXT GAP'),el('p','',compactGap(model)));brief.append(learned,gap);root.append(brief);

    const action=el('div','ei2-action'),actionCopy=el('div','ei2-action-copy'),cta=el('button','ei2-action-button',running?'MODEL RUNNING':'IMPROVE MODEL');cta.type='button';cta.disabled=running;actionCopy.append(el('span','ei2-kicker','BEST NEXT ACTION'),el('b','',title(rec.mode||'review')),el('p','',rec.reason||'Review the current model before spending more WCL budget.'),actionChips(rec));if(!running)cta.addEventListener('click',()=>improve(cta));action.append(actionCopy,cta);root.append(action);

    const details=el('details','ei2-details'),summary=el('summary','','MODEL DETAILS');summary.append(tip('Technical diagnostics stay collapsed so the primary corpus view remains readable.','i'));details.append(summary);const body=el('div','ei2-details-body');
    const needs=el('div'),nh=el('span','ei2-kicker','EVIDENCE QUEUE');needs.append(nh);for(const r of (model?.learning?.needsEvidence||[]).slice(0,4)){const p=el('p');p.append(el('b','',r.title),document.createTextNode(` · ${r.detail}`));needs.append(p);}const gates=el('div'),gh=el('span','ei2-kicker','PUBLICATION');gates.append(gh);const failures=failingGates(model);gates.append(el('p','',failures.length?`${failures.length} automated gates still open · ${failures.slice(0,5).join(' · ')}`:'Automated gates passed; manual review hold remains.'));if(model?.filtered?.count)gates.append(el('p','',`${model.filtered.count} non-encounter signals excluded by encounter-origin-v2.`));body.append(needs,gates);details.append(body);root.append(details);

    const anchor=panel.querySelector('.corpus-grid');if(anchor)anchor.insertAdjacentElement('afterend',root);else panel.append(root);
  }

  async function tick(force=false){if(!mechanicsPage())return;const m=await fetchModel(force);if(m)render(m);}
  document.addEventListener('click',event=>{if(event.target?.closest?.('nav button'))setTimeout(()=>tick(true),120);if(event.target?.closest?.('.corpus-workbench .corpus-actions button'))setTimeout(()=>tick(true),900);},true);
  setInterval(()=>tick(false),2200);window.addEventListener('DOMContentLoaded',()=>tick(true));if(document.readyState!=='loading')tick(true);
  console.info(`[AvoiD Raid Ops] Encounter Intelligence UI ${VERSION}`);
})();
