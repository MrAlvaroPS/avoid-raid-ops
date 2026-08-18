(() => {
  const RELEASE='3.7.13';
  const REQUIRED_MODEL='progress-model-v2';
  const state={range:'all',signature:null};
  const qsa=(sel,root=document)=>root?[...root.querySelectorAll(sel)]:[];
  const qs=(sel,root=document)=>root?.querySelector(sel)||null;
  const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));
  const value=p=>p?.kill?0:(finite(p?.fightPercentage)?Number(p.fightPercentage):null);
  const median=values=>{const a=(values||[]).filter(finite).map(Number).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};

  window.__AVOID_PROGRESS_V3713__=Object.freeze({
    release:RELEASE,
    scope:'encounter-history',
    dataOwner:'history.progressModel',
    requiredModel:REQUIRED_MODEL,
    extraWclRequests:0,
    interactionPolicy:'explicit-controls-only',
    writerPolicy:'single-progress-writer',
    presentationPolicy:'signal-first-quality-second',
    chartPolicy:'measured-depth-best-so-far',
    missingHistoryPolicy:'canonical-progress-owner'
  });

  function active(){return qsa('.page-banner h2').some(x=>x.textContent.trim()==='Are we actually getting better?');}
  function panelByTitle(...titles){return qsa('.panel').find(panel=>titles.includes(qs('.panel-title h3',panel)?.textContent.trim()))||null;}
  function history(){return window.__AVOID_WCL_HISTORY__||null;}
  function model(){const m=history()?.progressModel;return m?.modelVersion===REQUIRED_MODEL?m:null;}
  function rawPulls(){return Array.isArray(history()?.progressionPulls)?history().progressionPulls:[];}
  function eligiblePulls(){return rawPulls().filter(p=>p?.progressMetricEligible===true);}
  function isDepthMeasured(p){const v=value(p);return p?.progressMetricEligible===true&&v!=null&&(p?.kill||v<99.999);}
  function measuredPulls(raw=rawPulls()){return raw.filter(isDepthMeasured);}
  function fmtPct(v,d=1){return finite(v)?`${Number(v).toFixed(d)}%`:'—';}
  function fmtPp(v){if(!finite(v))return'—';const n=Number(v);return `${n>0?'+':n<0?'−':''}${Math.abs(n).toFixed(1)}pp`;}
  function fmtNum(v,d=1){return finite(v)?Number(v).toFixed(d):'—';}
  function fmtDate(ms){if(!finite(ms))return'—';try{return new Date(Number(ms)).toLocaleDateString(undefined,{weekday:'short',day:'2-digit'}).toUpperCase();}catch{return'—';}}
  function fmtMinutes(v){if(!finite(v))return'—';const n=Math.max(0,Number(v));if(n<60)return`${Math.round(n)} min`;const h=Math.floor(n/60),m=Math.round(n%60);return`${h}h ${m}m`;}
  function esc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function signedInt(v){if(!finite(v))return'—';const n=Math.round(Number(v));return `${n>0?'+':''}${n}pp`;}

  function visibleRaw(pulls){
    if(state.range==='25')return pulls.slice(-25);
    if(state.range==='50')return pulls.slice(-50);
    if(state.range==='100')return pulls.slice(-100);
    return pulls;
  }

  function depthSummary(raw,m){
    const measured=measuredPulls(raw);
    const eligible=raw.filter(p=>p?.progressMetricEligible===true);
    const unmeasuredEligible=eligible.filter(p=>!isDepthMeasured(p));
    const coverage=raw.length?100*measured.length/raw.length:null;
    const grade=String(m?.dataQuality?.grade||'UNKNOWN').toUpperCase();
    const limited=grade==='REVIEW'||grade==='BLOCKED'||(coverage!=null&&coverage<65);
    return {measured,eligible,unmeasuredEligible,coverage,grade,limited};
  }

  function takeProgressOwnership(){
    if(window.__AVOID_PROGRESS_LEGACY_WRAPPED__===RELEASE)return;
    const wrap=name=>{
      const legacy=window[name];
      if(typeof legacy!=='function'||legacy.__irisProgressOwner)return;
      const wrapped=function(...args){if(active())return;return legacy.apply(this,args);};
      wrapped.__irisProgressOwner=true;wrapped.__legacy=legacy;window[name]=wrapped;
    };
    for(const fn of ['applyProgressPage','applyProgressCurve','applyHistoryData','applyRealProgressMatrix'])wrap(fn);
    wrap('neutralizeMissingHistory');
    window.__AVOID_PROGRESS_LEGACY_WRAPPED__=RELEASE;
  }

  function dataSignature(){
    const h=history(),m=model(),r=rawPulls(),last=r.at(-1),ds=depthSummary(r,m);
    return [h?.generatedAt,m?.metricsVersion,m?.totals?.rawPulls,m?.totals?.metricEligiblePulls,m?.dataQuality?.grade,ds.measured.length,last?.absoluteStartTime,last?.fightPercentage].join('|');
  }

  function writeStat(card,label,val,delta,meta,tone=''){
    if(!card)return;
    card.dataset.progressIndicator='1';card.setAttribute('aria-disabled','true');
    const l=qs(':scope > label',card);if(l)l.textContent=label;
    const b=qs('div > b',card);if(b)b.textContent=val;
    const em=qs('div > em',card);if(em){em.textContent=delta||'';em.className=tone;}
    const small=qs(':scope > small',card);if(small)small.textContent=meta||'';
  }

  function signalFor(m,ds){
    const c=m.candidateState||m.state||{},block=m.block||{},stage=Number(block.deepestStage)||1;
    const stageRate=block.currentStageConversionPct,stageDelta=block.stageConversionDeltaPp;
    const map={
      cleared:['BOSS CLEARED','Kill recorded in progression history','good'],
      breakthrough:['YES — RECENT BREAKTHROUGH','Recent progress moved both depth/stage evidence forward','good'],
      stabilizing:[`YES — S${stage} IS STABILIZING`,`${Math.round(stageRate||0)}% of CURRENT FORM reaches S${stage}`,'good'],
      converting:[`YES — S${stage} IS BECOMING MORE REPEATABLE`,`${Math.round(stageRate||0)}% of CURRENT FORM reaches S${stage} · ${signedInt(stageDelta)} vs previous 20`,'good'],
      improving:['YES — CURRENT FORM IS IMPROVING','Repeatability/depth signals improved versus the previous form window','good'],
      plateau:['PROGRESS HAS PLATEAUED',c.detail||'No recent meaningful breakthrough','warn'],
      regressing:['CURRENT FORM IS REGRESSING',c.detail||'Recent form is shallower than the comparison window','warn'],
      learning:[`S${stage} IS STILL BEING LEARNED`,`${Math.round(stageRate||0)}% of CURRENT FORM reaches S${stage}`,''],
      baseline:['BUILDING A BASELINE',c.detail||'More pulls are needed before a strategic trend is stable','']
    };
    const picked=map[c.key]||[c.label||'PROGRESS SIGNAL',c.detail||'No strategic signal available',c.tone||''];
    let qualityLabel='DATA QUALITY GOOD',qualityDetail=`${ds.measured.length}/${m.totals?.rawPulls??0} pulls have measurable WCL depth`;
    if(ds.grade==='BLOCKED'){qualityLabel='DATA INTEGRITY BLOCKED';qualityDetail='Canonical invariants failed; use audit details before trusting depth metrics.';}
    else if(ds.limited){qualityLabel='DEPTH DATA LIMITED';qualityDetail=`${ds.measured.length}/${m.totals?.rawPulls??0} pulls have measurable WCL completion · stage/reach signals remain readable`;}
    else if(ds.grade==='PARTIAL'){qualityLabel='PARTIAL DEPTH DATA';qualityDetail=`${ds.measured.length}/${m.totals?.rawPulls??0} pulls have measurable WCL depth`;}
    return {label:picked[0],detail:picked[1],tone:picked[2],qualityLabel,qualityDetail};
  }

  function renderMissingHistory(){
    if(history()?.ok)return;
    const panel=panelByTitle('Night-over-night');if(!panel)return;
    const sub=qs('.panel-title p',panel);if(sub)sub.textContent='Raid-session history unavailable · no Golden fallback';
    qsa('.night-table > div',panel).forEach(row=>{
      const span=qs('span',row);if(span)span.textContent='HISTORY UNAVAILABLE';
      const b=qs('b',row);if(b)b.textContent='—';
      const em=qs('em',row);if(em)em.textContent='—';
    });
    const insight=qs('.insight-box p',panel);
    if(insight)insight.textContent='Current-report progression remains real. Cross-session comparisons require the History endpoint.';
  }

  function renderPending(reason='Waiting for canonical Progress model v2 from History endpoint'){
    renderMissingHistory();
    const banner=qs('.page-banner');
    if(banner){const bs=qs('.banner-stat',banner);if(bs){bs.innerHTML=`<label>PROGRESSION SIGNAL</label><b>SYNCING</b><small>${esc(reason)}</small>`;}}
    qsa('.stats-row .stat').forEach((card,i)=>writeStat(card,['TOTAL PROG PULLS','BEST PULL','STAGE CONVERSION','DEPTH COVERAGE','LAST BREAKTHROUGH'][i]||'PROGRESS','—','MODEL V2',reason));
  }

  function renderBannerAndStats(m,raw,ds){
    const banner=qs('.page-banner'),signal=signalFor(m,ds);
    if(banner){
      banner.dataset.progressIndicator='1';
      const badge=qs('.badge',banner);if(badge)badge.textContent='PROGRESSION HISTORY';
      const copy=qs('p',banner);if(copy)copy.textContent='Long-horizon boss progress: repeatability, stage conversion, breakthroughs and raid-night efficiency. Live owns the current raid night.';
      const bs=qs('.banner-stat',banner);
      if(bs){bs.innerHTML=`<label>PROGRESSION SIGNAL</label><b class="progress-signal ${signal.tone||''}">${esc(signal.label)}</b><small>${esc(signal.detail)}</small><span class="progress-quality-chip ${ds.limited?'limited':'good'}">${esc(signal.qualityLabel)}<i>${esc(signal.qualityDetail)}</i></span>`;}
    }

    const cards=qsa('.stats-row .stat'),block=m.block||{},br=m.breakthrough||{},bestMeasured=ds.measured.slice().sort((a,b)=>value(a)-value(b))[0]||null;
    writeStat(cards[0],'TOTAL PROG PULLS',String(m.totals?.rawPulls??raw.length),`${m.totals?.nights??0} NIGHTS`,`${ds.measured.length} measurable WCL depth · ${ds.unmeasuredEligible.length} WCL-unscored`,'good');
    writeStat(cards[1],ds.limited?'BEST MEASURED PULL':'BEST PULL',fmtPct(value(bestMeasured)),bestMeasured?.kill?'KILL':'WCL',bestMeasured?`Global pull ${bestMeasured.pullNumber}${bestMeasured.absoluteStartTime?` · ${fmtDate(bestMeasured.absoluteStartTime)}`:''}`:'No measurable WCL depth pull','good');
    if(ds.limited){
      writeStat(cards[2],`S${block.deepestStage||1} CONVERSION`,fmtPct(block.currentStageConversionPct,0),fmtPp(block.stageConversionDeltaPp),`CURRENT FORM · latest ${block.currentBlock?.metricEligiblePulls??0} metric-eligible pulls`,finite(block.stageConversionDeltaPp)&&block.stageConversionDeltaPp>0?'good':'');
      writeStat(cards[3],'DEPTH COVERAGE',fmtPct(ds.coverage,0),`${ds.measured.length}/${raw.length} MEASURED`,`${ds.unmeasuredEligible.length} pulls have no measurable WCL fight completion; not drawn as 100% depth`,'warn');
    }else{
      writeStat(cards[2],'DEEP PULL RATE',fmtPct(block.currentDeepRatePct,0),fmtPp(block.deepDeltaPp),finite(block.deepThreshold)?`CURRENT FORM · within ${m.policy?.deepPullMarginPp??10}pp of PB`:'Need eligible pulls',finite(block.deepDeltaPp)&&block.deepDeltaPp>0?'good':'');
      writeStat(cards[3],'CONSISTENCY GAP',finite(block.consistencyGapPp)?`${Number(block.consistencyGapPp).toFixed(1)}pp`:'—',fmtPp(block.consistencyGapImprovementPp),finite(block.currentMedianPct)?`CURRENT FORM · median ${fmtPct(block.currentMedianPct)} vs PB ${fmtPct(block.bestPct)} · lower is better`:'Need eligible pulls',finite(block.consistencyGapImprovementPp)&&block.consistencyGapImprovementPp>0?'good':'');
    }
    writeStat(cards[4],'LAST BREAKTHROUGH',finite(br.pullsSince)?`${br.pullsSince} PULLS`:'—',finite(br.nightsSince)?`${br.nightsSince} NIGHT${br.nightsSince===1?'':'S'}`:'—',br.latest?`Global ${br.latest.pullNumber} · ${(br.latest.reasons||[]).join(' + ')}`:`No ≥${m.policy?.breakthroughDepthPp??2}pp / new-stage breakthrough after baseline`);
  }

  function chartPoint(v,rawIndex,rawLength){const x=rawLength===1?50:3+rawIndex/(rawLength-1)*94;const y=6+clamp(v)/100*72;return{x,y};}

  function renderChart(raw,m,ds){
    const panel=panelByTitle('All-pull progression');if(!panel)return;
    const title=qs('.panel-title',panel);
    const visible=visibleRaw(raw),visibleMeasured=visible.filter(isDepthMeasured),visibleUnmeasured=visible.filter(p=>p?.progressMetricEligible===true&&!isDepthMeasured(p));
    if(title){
      const sub=qs('p',title);if(sub)sub.textContent='Best-so-far + measured form · missing WCL depth is shown as missing, never as fake 100% progression';
      let bar=qs('.progress-commandbar',panel);if(!bar){bar=document.createElement('div');bar.className='progress-commandbar';title.insertAdjacentElement('afterend',bar);}
      const ranges=[['all','ALL'],['100','LAST 100'],['50','LAST 50'],['25','LAST 25']];
      bar.innerHTML=`<span>RAW RANGE</span>${ranges.map(([k,l])=>{const limit=k==='all'?Infinity:Number(k);const disabled=k!=='all'&&limit>=raw.length;return `<button type="button" data-progress-range="${k}" class="${state.range===k?'active':''}" ${disabled?'disabled':''}>${l}</button>`;}).join('')}<em>${visible.length} pulls · ${visibleMeasured.length} measured depth · ${visibleUnmeasured.length} WCL-unscored</em>`;
      qsa('[data-progress-range]',bar).forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(btn.disabled)return;state.range=btn.dataset.progressRange;renderChart(raw,m,ds);}));
    }

    const curve=qs('.pullcurve',panel);if(!curve)return;curve.dataset.progressRuntime=RELEASE;
    if(!visible.length){curve.innerHTML='<div class="progress-empty">No pulls in this range.</div>';return;}
    const rawIndex=new Map(visible.map((p,i)=>[p.pullNumber,i]));
    const beforeStart=raw.filter(p=>p.pullNumber<(visible[0]?.pullNumber??1)&&isDepthMeasured(p));
    let runningBest=beforeStart.length?Math.min(...beforeStart.map(value)):Infinity;
    const bestPts=[],pbSet=new Set();
    for(let i=0;i<visible.length;i++){
      const p=visible[i],v=isDepthMeasured(p)?value(p):null;
      if(v!=null&&v<runningBest){runningBest=v;pbSet.add(p.pullNumber);}
      if(Number.isFinite(runningBest))bestPts.push(chartPoint(runningBest,i,visible.length));
    }
    const bestLine=bestPts.map(p=>`${p.x},${p.y}`).join(' ');
    const medWindow=5,formPts=[];const measuredHistory=beforeStart.slice(-medWindow).map(value);
    for(let i=0;i<visible.length;i++){
      const p=visible[i];if(!isDepthMeasured(p))continue;
      measuredHistory.push(value(p));while(measuredHistory.length>medWindow)measuredHistory.shift();
      formPts.push(chartPoint(median(measuredHistory),i,visible.length));
    }
    const formLine=formPts.map(p=>`${p.x},${p.y}`).join(' '),separators=[];
    for(let i=1;i<visible.length;i++)if(visible[i].sessionId&&visible[i-1].sessionId&&visible[i].sessionId!==visible[i-1].sessionId){const x=chartPoint(0,i-.5,visible.length).x;separators.push(`<line class="progress-night-separator" x1="${x}" y1="5" x2="${x}" y2="80"></line>`);}
    const measuredDots=visibleMeasured.map(p=>{const i=rawIndex.get(p.pullNumber),pt=chartPoint(value(p),i,visible.length),pb=pbSet.has(p.pullNumber);return `<circle class="progress-measured-point${pb?' pb':''}" cx="${pt.x}" cy="${pt.y}" r="${pb?1.15:.55}"><title>Global ${p.pullNumber} · measured WCL ${fmtPct(value(p))} · Stage ${p.stageCount}</title></circle>`;}).join('');
    const unmeasuredTicks=visibleUnmeasured.map(p=>{const i=rawIndex.get(p.pullNumber),x=chartPoint(100,i,visible.length).x;return `<line class="progress-unmeasured-tick" x1="${x}" y1="81.5" x2="${x}" y2="84"><title>Global ${p.pullNumber} · WCL fight progress unavailable/non-measurable · Stage ${p.stageCount}</title></line>`;}).join('');
    curve.innerHTML=`<div class="axis"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div><svg viewBox="0 0 100 88" preserveAspectRatio="none" role="img" aria-label="Measured WCL depth trend with best-so-far and unmeasured pulls shown separately">${[6,24,42,60,78].map(y=>`<line class="progress-gridline" x1="3" y1="${y}" x2="97" y2="${y}"></line>`).join('')}${separators.join('')}${bestLine?`<polyline class="progress-best-line" points="${bestLine}"></polyline>`:''}${formLine?`<polyline class="progress-form-line" points="${formLine}"></polyline>`:''}${measuredDots}${unmeasuredTicks}</svg><div class="progress-unmeasured-label">WCL DEPTH UNAVAILABLE · ${visibleUnmeasured.length}</div><div class="pull-labels"><span>GLOBAL ${visible[0]?.pullNumber??'—'}</span><span>GLOBAL ${visible[Math.floor((visible.length-1)/2)]?.pullNumber??'—'}</span><span>GLOBAL ${visible.at(-1)?.pullNumber??'—'}</span></div>`;
    const legend=qs('.legend-row',panel);if(legend){legend.dataset.progressIndicator='1';legend.innerHTML=`<span><i class="good"></i>Best-so-far measured depth</span><span><i class="info"></i>5-measured-pull form median</span><span><i class="warn"></i>New measured PB</span><span><i class="progress-unmeasured-key"></i>WCL depth unavailable</span><span><i class="progress-night-key"></i>Raid-night boundary</span>`;}
  }

  function stageRateForNight(raw,sessionId,deepest){const rows=raw.filter(p=>p.sessionId===sessionId&&p.progressMetricEligible===true);return rows.length?100*rows.filter(p=>Number(p.stageCount)>=deepest).length/rows.length:null;}
  function measuredBestForNight(raw,sessionId){const rows=raw.filter(p=>p.sessionId===sessionId&&isDepthMeasured(p));return rows.length?Math.min(...rows.map(value)):null;}
  function measuredCountForNight(raw,sessionId){return raw.filter(p=>p.sessionId===sessionId&&isDepthMeasured(p)).length;}

  function renderNights(m,raw,ds){
    const panel=panelByTitle('Night-over-night');if(!panel)return;panel.dataset.progressIndicator='1';
    const title=qs('.panel-title p',panel);if(title)title.textContent=ds.limited?'Interday stage repeatability + measured best depth; avoids misleading 100% WCL medians':'Raw night size + metric-eligible depth progression';
    const nights=Array.isArray(m.nights)?m.nights:[],table=qs('.night-table',panel),deepest=Number(m.block?.deepestStage)||1;
    const withStage=nights.map(n=>({...n,stageRate:stageRateForNight(raw,n.sessionId,deepest),measuredBest:measuredBestForNight(raw,n.sessionId),measuredCount:measuredCountForNight(raw,n.sessionId)}));
    if(table){const show=withStage.slice(-4);table.innerHTML=show.length?show.map((n,idx)=>{
      if(ds.limited)return `<div class="${idx===show.length-1?'active':''}" data-progress-indicator="1"><span>${fmtDate(n.startTime)} · ${n.pulls} PULLS<small>Global ${n.firstGlobalPull}–${n.lastGlobalPull} · ${n.measuredCount}/${n.pulls} measured depth · Best measured ${fmtPct(n.measuredBest)}</small></span><b>S${deepest} REACH ${fmtPct(n.stageRate,0)}</b><em>stage repeatability</em></div>`;
      return `<div class="${idx===show.length-1?'active':''}" data-progress-indicator="1"><span>${fmtDate(n.startTime)} · ${n.pulls} RAW PULLS<small>Global ${n.firstGlobalPull}–${n.lastGlobalPull} · ${n.metricEligiblePulls}/${n.pulls} eligible · Best ${fmtPct(n.bestFightPercentage)}</small></span><b>Median ${fmtPct(n.medianFightPercentage)}</b><em>${finite(n.medianDeltaPp)?`${fmtPp(n.medianDeltaPp)} vs prior`:'First loaded night'} · eligible median</em></div>`;
    }).join(''):'<div data-progress-indicator="1"><span>NO RAID-NIGHT HISTORY</span><b>—</b><em>—</em></div>';}
    const badge=qs('.insight-box .badge',panel);if(badge)badge.textContent='INTERDAY READ';
    const insight=qs('.insight-box p',panel),latest=withStage.at(-1),previous=withStage.at(-2);
    if(!insight)return;
    if(!latest)insight.textContent='No comparable raid-night history is loaded.';
    else if(ds.limited){
      if(!previous||!finite(latest.stageRate)||!finite(previous.stageRate))insight.textContent=`Latest night: ${fmtPct(latest.stageRate,0)} of pulls reached S${deepest}. More comparable nights are needed for an interday direction.`;
      else{const delta=latest.stageRate-previous.stageRate;insight.textContent=`Latest night reached S${deepest} on ${Math.round(latest.stageRate)}% of pulls (${signedInt(delta)} vs previous night). Measured-depth coverage remains limited.`;}
    }else if(!finite(latest.medianDeltaPp))insight.textContent='This is the first comparable raid night in the loaded history.';
    else if(Math.abs(latest.medianDeltaPp)<.5)insight.textContent=`Latest eligible median held near ${fmtPct(latest.medianFightPercentage)}. Use CURRENT FORM repeatability for movement.`;
    else if(latest.medianDeltaPp>0)insight.textContent=`Latest night improved metric-eligible median depth by ${Math.abs(latest.medianDeltaPp).toFixed(1)}pp versus the previous night.`;
    else insight.textContent=`Latest night was ${Math.abs(latest.medianDeltaPp).toFixed(1)}pp shallower on metric-eligible median than the previous night.`;
  }

  function stageClass(pct){if(pct>=80)return'full';if(pct>=60)return'high';if(pct>=35)return'mid';if(pct>0)return'low';return'none';}
  function renderMatrix(m){
    const panel=panelByTitle('Phase progression matrix','Stage consistency matrix');if(!panel)return;panel.dataset.progressIndicator='1';
    const h3=qs('.panel-title h3',panel);if(h3)h3.textContent='Stage consistency matrix';
    const sub=qs('.panel-title p',panel);if(sub)sub.textContent=`${m.matrix?.windowSize??20} metric-eligible pull windows · independent from chart range`;
    const matrix=qs('.matrix',panel);if(!matrix)return;matrix.classList.add('progress-window-matrix');
    const deepest=Math.max(1,Number(m.matrix?.deepestStage)||1),windows=m.matrix?.windows||[];
    matrix.style.gridTemplateColumns=`minmax(130px,1.1fr) repeat(${deepest},minmax(58px,1fr))`;
    const header=['<label></label>',...Array.from({length:deepest},(_,i)=>`<label>STAGE ${i+1}</label>`)].join('');
    const body=windows.map(w=>`<b>ELIGIBLE ${w.eligibleFirst}–${w.eligibleLast}<small>GLOBAL ${w.firstGlobalPull}–${w.lastGlobalPull}${w.complete?'':' · PARTIAL'}</small></b>${(w.stages||[]).map(s=>`<i class="progress-window-cell ${stageClass(s.ratePct||0)}" data-progress-indicator="1"><span>${Math.round(s.ratePct||0)}%</span><title>${s.hit}/${s.pulls} metric-eligible pulls reached Stage ${s.stage}</title></i>`).join('')}`).join('');
    matrix.innerHTML=header+body;
  }

  function ensureHealthPanel(){
    let panel=qs('.progress-health-panel');if(panel)return panel;
    const matrix=panelByTitle('Phase progression matrix','Stage consistency matrix');if(!matrix)return null;
    panel=document.createElement('article');panel.className='panel progress-health-panel';
    panel.innerHTML=`<div class="panel-title"><div><i>04</i><span><h3>Progression health</h3><p>Strategic signals from the shared CURRENT FORM population.</p></span></div></div><div class="progress-health-grid"><div class="progress-health-card" data-health="phase"><label>PHASE CONVERSION</label><b>—</b><em>—</em><small>Deepest observed stage</small></div><div class="progress-health-card" data-health="retention"><label>NIGHT RETENTION</label><b>—</b><em>—</em><small>Recovery of previous closing level</small></div><div class="progress-health-card" data-health="throughput"><label>RAID THROUGHPUT</label><b>—</b><em>—</em><small>Raw analytical pulls per active hour</small></div></div><details class="progress-data-quality"><summary>DATA QUALITY</summary><div class="progress-data-quality-body"></div></details>`;
    matrix.insertAdjacentElement('afterend',panel);return panel;
  }
  function writeHealth(card,val,delta,meta,tone=''){if(!card)return;card.dataset.progressIndicator='1';const b=qs('b',card),e=qs('em',card),s=qs('small',card);if(b)b.textContent=val;if(e){e.textContent=delta;e.className=tone;}if(s)s.textContent=meta;}

  function renderDataQuality(panel,m,raw,ds){
    const dq=m.dataQuality||{},details=qs('.progress-data-quality',panel),body=qs('.progress-data-quality-body',panel);if(!details||!body)return;
    details.className=`progress-data-quality grade-${String(dq.grade||'unknown').toLowerCase()}`;
    const summary=qs('summary',details);if(summary)summary.textContent=`DEPTH DATA · ${ds.limited?'LIMITED':dq.grade||'UNKNOWN'} · ${ds.measured.length}/${raw.length} MEASURED`;
    const rows=Array.isArray(dq.auditRows)?dq.auditRows:[];
    body.innerHTML=`<div class="progress-quality-kpis"><span><b>${raw.length}</b>RAW</span><span><b>${ds.measured.length}</b>DEPTH MEASURED</span><span><b>${ds.unmeasuredEligible.length}</b>WCL UNSCORED</span><span><b>${dq.metricExcludedPulls??0}</b>EXCLUDED</span></div><div class="progress-quality-notes"><p>${ds.measured.length}/${raw.length} pulls expose measurable WCL fight completion. Exact 100% completion rows are kept raw and auditable but are not drawn as real 100% depth in the trend chart.</p>${(dq.notes||[]).map(n=>`<p>${esc(n)}</p>`).join('')}</div>${rows.length?`<div class="progress-quality-audit"><div class="head"><span>PULL</span><span>WCL</span><span>BOSS</span><span>STAGE</span><span>DURATION</span><span>STATUS / SOURCE</span></div>${rows.map(r=>`<div><span>#${r.globalPullNumber}</span><span>${fmtPct(r.fightPercentage)}</span><span>${fmtPct(r.bossPercentage)}</span><span>S${r.stageCount}</span><span>${fmtMinutes((r.durationMs||0)/60000)}</span><span>${r.metricEligible?'REVIEW':'EXCLUDED'} · ${esc(r.reason)}<small>${esc((r.flags||[]).join(' · '))}${r.reportCodes?.length?` · report ${esc(r.reportCodes.join(','))}`:''}${r.fightIds?.length?` · fight ${esc(r.fightIds.join(','))}`:''}</small></span></div>`).join('')}</div>`:'<p>No flagged pulls in the loaded canonical history.</p>'}`;
  }

  function renderHealth(m,raw,ds){
    const panel=ensureHealthPanel();if(!panel)return;panel.dataset.progressIndicator='1';
    const h=m.health||{},block=m.block||{},ret=h.retention||{},thr=h.throughput||{};
    writeHealth(qs('[data-health="phase"]',panel),fmtPct(h.phaseConversionPct,0),fmtPp(h.phaseConversionDeltaPp),`CURRENT FORM · ${block.currentBlock?.metricEligiblePulls??0}/${m.policy?.currentFormPulls??20} eligible · Stage ${block.deepestStage}`,finite(h.phaseConversionDeltaPp)&&h.phaseConversionDeltaPp>0?'good':'');
    const retCard=qs('[data-health="retention"]',panel);
    if(ds.limited)writeHealth(retCard,'—','DEPTH LIMITED','Retention needs comparable measured closing depth; WCL completion coverage is currently too sparse.','warn');
    else if(!ret.available){const reason=ret.reason==='weak-closing-baseline'?`Previous eligible closing median ${fmtPct(ret.previousClosingPct)} is too shallow`:ret.reason==='insufficient-eligible-pulls'?'Not enough metric-eligible pulls in both nights':'Needs two comparable timestamped nights';writeHealth(retCard,'—','NO VALID BASELINE',reason);}
    else if(!ret.recovered)writeHealth(retCard,'NOT YET',`${ret.currentEligiblePulls??0} ELIGIBLE`,`Previous eligible closing level ${fmtPct(ret.previousClosingPct)} has not been recovered`,'warn');
    else writeHealth(retCard,`${ret.pullsToRecover} PULLS`,fmtMinutes(ret.minutes),`Recovered previous eligible closing ${fmtPct(ret.previousClosingPct)} within ±${m.policy?.retentionTolerancePp??2}pp`,'good');
    const thrCard=qs('[data-health="throughput"]',panel);
    if(!thr.available)writeHealth(thrCard,'—','NO TIMESTAMPS','Needs timestamped raw analytical pulls');
    else writeHealth(thrCard,`${fmtNum(thr.current?.pullsPerHour)} / H`,finite(thr.deltaPullsPerHour)?`${thr.deltaPullsPerHour>=0?'↑':'↓'} ${Math.abs(thr.deltaPullsPerHour).toFixed(1)}/h vs prior`:'LATEST NIGHT',`RAW NIGHT SCOPE · median downtime ${fmtMinutes(thr.current?.medianDowntimeMinutes)} · ${thr.current?.pulls??0} pulls across ${fmtMinutes(thr.current?.activeMinutes)}`,finite(thr.deltaPullsPerHour)&&thr.deltaPullsPerHour>0?'good':'');
    const sub=qs('.panel-title p',panel),d=m.diagnostics||{};
    if(sub)sub.textContent=`Model ${m.metricsVersion||'v2'} · ${raw.length} raw · ${ds.measured.length} depth-measured · ${ds.unmeasuredEligible.length} WCL-unscored · ${m.totals?.nights??0} nights · ${Object.values(d.invariants||{}).every(Boolean)?'invariants OK':'DATA INVARIANT WARNING'}`;
    renderDataQuality(panel,m,raw,ds);
  }

  function blockIndicatorInteraction(event){
    if(!active())return;if(event.target?.closest?.('[data-progress-range],.progress-data-quality summary'))return;
    const blocked=event.target?.closest?.('[data-progress-indicator="1"],.stats-row .stat,.night-table,.progress-window-matrix,.progress-health-card,.page-banner .banner-stat,.legend-row');
    if(!blocked)return;event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
  }

  function renderFull(force=false){
    takeProgressOwnership();if(!active())return;
    const m=model();if(!m){renderPending();return;}
    const raw=rawPulls(),eligible=eligiblePulls();
    if(Number(m.totals?.rawPulls)!==raw.length||Number(m.totals?.metricEligiblePulls)!==eligible.length){renderPending(`Progress population mismatch: model ${m.totals?.rawPulls??'—'}/${m.totals?.metricEligiblePulls??'—'} vs series ${raw.length}/${eligible.length}`);return;}
    const sig=dataSignature();if(!force&&sig===state.signature)return;state.signature=sig;
    const ds=depthSummary(raw,m);
    renderBannerAndStats(m,raw,ds);renderChart(raw,m,ds);renderNights(m,raw,ds);renderMatrix(m);renderHealth(m,raw,ds);
  }

  takeProgressOwnership();
  document.addEventListener('click',blockIndicatorInteraction,true);
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>renderFull(true),100),{once:true});
  document.addEventListener('click',e=>{if(e.target?.closest?.('nav button'))setTimeout(()=>renderFull(true),190);},true);
  window.addEventListener('popstate',()=>setTimeout(()=>renderFull(true),120));
  setInterval(()=>renderFull(false),750);
})();