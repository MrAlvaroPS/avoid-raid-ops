(() => {
  const RELEASE='3.7.12';
  const REQUIRED_MODEL='progress-model-v2';
  const state={range:'all',signature:null};
  const qsa=(sel,root=document)=>root?[...root.querySelectorAll(sel)]:[];
  const qs=(sel,root=document)=>root?.querySelector(sel)||null;
  const finite=v=>Number.isFinite(Number(v));
  const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));
  const value=p=>p?.kill?0:(finite(p?.fightPercentage)?Number(p.fightPercentage):null);
  const median=values=>{const a=(values||[]).filter(finite).map(Number).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};

  window.__AVOID_PROGRESS_V3712__=Object.freeze({
    release:RELEASE,
    scope:'encounter-history',
    dataOwner:'history.progressModel',
    requiredModel:REQUIRED_MODEL,
    extraWclRequests:0,
    interactionPolicy:'explicit-controls-only',
    writerPolicy:'single-progress-writer',
    metricPopulation:'progressMetricEligible'
  });

  function active(){return qsa('.page-banner h2').some(x=>x.textContent.trim()==='Are we actually getting better?');}
  function panelByTitle(...titles){return qsa('.panel').find(panel=>titles.includes(qs('.panel-title h3',panel)?.textContent.trim()))||null;}
  function history(){return window.__AVOID_WCL_HISTORY__||null;}
  function model(){const m=history()?.progressModel;return m?.modelVersion===REQUIRED_MODEL?m:null;}
  function rawPulls(){return Array.isArray(history()?.progressionPulls)?history().progressionPulls:[];}
  function eligiblePulls(){return rawPulls().filter(p=>p?.progressMetricEligible===true);}
  function fmtPct(v,d=1){return finite(v)?`${Number(v).toFixed(d)}%`:'—';}
  function fmtPp(v){if(!finite(v))return'—';const n=Number(v);return `${n>0?'+':n<0?'−':''}${Math.abs(n).toFixed(1)}pp`;}
  function fmtNum(v,d=1){return finite(v)?Number(v).toFixed(d):'—';}
  function fmtDate(ms){if(!finite(ms))return'—';try{return new Date(Number(ms)).toLocaleDateString(undefined,{weekday:'short',day:'2-digit'}).toUpperCase();}catch{return'—';}}
  function fmtMinutes(v){if(!finite(v))return'—';const n=Math.max(0,Number(v));if(n<60)return`${Math.round(n)} min`;const h=Math.floor(n/60),m=Math.round(n%60);return`${h}h ${m}m`;}
  function esc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}

  function visibleEligible(pulls){
    if(state.range==='25')return pulls.slice(-25);
    if(state.range==='50')return pulls.slice(-50);
    if(state.range==='100')return pulls.slice(-100);
    return pulls;
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
    window.__AVOID_PROGRESS_LEGACY_WRAPPED__=RELEASE;
  }

  function dataSignature(){
    const h=history(),m=model(),r=rawPulls(),e=eligiblePulls(),last=r.at(-1);
    return [h?.generatedAt,m?.metricsVersion,m?.totals?.rawPulls,m?.totals?.metricEligiblePulls,m?.dataQuality?.grade,last?.absoluteStartTime,last?.fightPercentage,e.length].join('|');
  }

  function writeStat(card,label,val,delta,meta,tone=''){
    if(!card)return;
    card.dataset.progressIndicator='1';card.setAttribute('aria-disabled','true');
    const l=qs(':scope > label',card);if(l)l.textContent=label;
    const b=qs('div > b',card);if(b)b.textContent=val;
    const em=qs('div > em',card);if(em){em.textContent=delta||'';em.className=tone;}
    const small=qs(':scope > small',card);if(small)small.textContent=meta||'';
  }

  function renderPending(reason='Waiting for canonical Progress model v2 from History endpoint'){
    const banner=qs('.page-banner');
    if(banner){const bs=qs('.banner-stat',banner);if(bs){const l=qs('label',bs),b=qs('b',bs),s=qs('small',bs);if(l)l.textContent='PROGRESSION STATE';if(b)b.textContent='SYNCING';if(s)s.textContent=reason;}}
    qsa('.stats-row .stat').forEach((card,i)=>writeStat(card,['TOTAL PROG PULLS','BEST PULL','DEEP PULL RATE','CONSISTENCY GAP','LAST BREAKTHROUGH'][i]||'PROGRESS','—','MODEL V2',reason));
  }

  function renderBannerAndStats(m){
    const banner=qs('.page-banner');
    if(banner){
      banner.dataset.progressIndicator='1';
      const badge=qs('.badge',banner);if(badge)badge.textContent='PROGRESSION HISTORY';
      const copy=qs('p',banner);if(copy)copy.textContent='Long-horizon encounter progress from one audited canonical pull series. Live owns the current raid night.';
      const bs=qs('.banner-stat',banner);
      if(bs){
        const l=qs('label',bs),b=qs('b',bs),s=qs('small',bs);
        if(l)l.textContent='PROGRESSION STATE';
        if(b){b.textContent=m.state?.label||'—';b.className=`progress-state-value ${m.state?.tone||''}`;}
        if(s)s.textContent=m.state?.detail||'No state available';
      }
    }

    const cards=qsa('.stats-row .stat'),block=m.block||{},br=m.breakthrough||{},best=m.bestPull,dq=m.dataQuality||{};
    writeStat(cards[0],'TOTAL PROG PULLS',String(m.totals?.rawPulls??0),`${m.totals?.metricEligiblePulls??0} ELIGIBLE`,`${m.totals?.nights??0} nights · ${m.totals?.metricExcludedPulls??0} excluded from strategic metrics`,dq.grade==='GOOD'?'good':'');
    writeStat(cards[1],'BEST PULL',fmtPct(best?.fightPercentage),best?.kill?'KILL':'WCL',best?`Global pull ${best.pullNumber}${best.absoluteStartTime?` · ${fmtDate(best.absoluteStartTime)}`:''} · metric-eligible`:'No eligible progress pull','good');
    writeStat(cards[2],'DEEP PULL RATE',fmtPct(block.currentDeepRatePct,0),fmtPp(block.deepDeltaPp),finite(block.deepThreshold)?`CURRENT FORM · ${block.currentBlock?.metricEligiblePulls??0}/${m.policy?.currentFormPulls??20} eligible · within ${m.policy?.deepPullMarginPp??10}pp of PB`:'Need eligible pulls',finite(block.deepDeltaPp)&&block.deepDeltaPp>0?'good':'');
    writeStat(cards[3],'CONSISTENCY GAP',finite(block.consistencyGapPp)?`${Number(block.consistencyGapPp).toFixed(1)}pp`:'—',fmtPp(block.consistencyGapImprovementPp),finite(block.currentMedianPct)?`CURRENT FORM · median ${fmtPct(block.currentMedianPct)} vs PB ${fmtPct(block.bestPct)} · lower is better`:'Need eligible pulls',finite(block.consistencyGapImprovementPp)&&block.consistencyGapImprovementPp>0?'good':'');
    writeStat(cards[4],'LAST BREAKTHROUGH',finite(br.pullsSince)?`${br.pullsSince} PULLS`:'—',finite(br.nightsSince)?`${br.nightsSince} NIGHT${br.nightsSince===1?'':'S'}`:'—',br.latest?`Metric-eligible pull · Global ${br.latest.pullNumber} · ${(br.latest.reasons||[]).join(' + ')}`:`No ≥${m.policy?.breakthroughDepthPp??2}pp / new-stage breakthrough after baseline`);
  }

  function rollingMedian(pulls,size){return pulls.map((_,i)=>median(pulls.slice(Math.max(0,i-size+1),i+1).map(value)));}
  function point(v,i,length){const x=length===1?50:3+i/(length-1)*94;const y=6+clamp(v)/100*74;return{x,y};}

  function renderChart(raw,eligible,m){
    const panel=panelByTitle('All-pull progression');if(!panel)return;
    const title=qs('.panel-title',panel);
    if(title){
      const sub=qs('p',title);if(sub)sub.textContent='Metric-eligible WCL fight progress · rolling median · PBs · raw history remains auditable';
      let bar=qs('.progress-commandbar',panel);if(!bar){bar=document.createElement('div');bar.className='progress-commandbar';title.insertAdjacentElement('afterend',bar);}
      const ranges=[['all','ALL'],['100','LAST 100'],['50','LAST 50'],['25','LAST 25']];
      const shown=visibleEligible(eligible);
      bar.innerHTML=`<span>ELIGIBLE RANGE</span>${ranges.map(([k,l])=>{const limit=k==='all'?Infinity:Number(k);const disabled=k!=='all'&&limit>=eligible.length;return `<button type="button" data-progress-range="${k}" class="${state.range===k?'active':''}" ${disabled?'disabled':''}>${l}</button>`;}).join('')}<em>${shown.length} / ${eligible.length} eligible · ${raw.length} raw · ${m.totals?.nights??0} nights</em>`;
      qsa('[data-progress-range]',bar).forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(btn.disabled)return;state.range=btn.dataset.progressRange;renderChart(raw,eligible,m);}));
    }

    const visible=visibleEligible(eligible).filter(p=>value(p)!=null),curve=qs('.pullcurve',panel);if(!curve)return;
    curve.dataset.progressRuntime=RELEASE;
    if(!visible.length){curve.innerHTML='<div class="progress-empty">No metric-eligible WCL progress values in this range.</div>';return;}
    const medSize=visible.length>=20?10:5,meds=rollingMedian(visible,medSize);
    let runningBest=Infinity;const pbSet=new Set();
    for(const p of eligible){const v=value(p);if(v!=null&&v<runningBest){runningBest=v;pbSet.add(p.pullNumber);}}
    const pts=visible.map((p,i)=>point(value(p),i,visible.length)),line=pts.map(p=>`${p.x},${p.y}`).join(' ');
    const medPts=meds.map((v,i)=>point(v,i,meds.length)),mline=medPts.map(p=>`${p.x},${p.y}`).join(' '),separators=[];
    for(let i=1;i<visible.length;i++)if(visible[i].sessionId&&visible[i-1].sessionId&&visible[i].sessionId!==visible[i-1].sessionId){const x=(pts[i-1].x+pts[i].x)/2;separators.push(`<line class="progress-night-separator" x1="${x}" y1="5" x2="${x}" y2="80"></line>`);}
    curve.innerHTML=`<div class="axis"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div><svg viewBox="0 0 100 86" preserveAspectRatio="none" role="img" aria-label="Metric-eligible encounter progress by global pull">${[6,24.5,43,61.5,80].map(y=>`<line x1="3" y1="${y}" x2="97" y2="${y}"></line>`).join('')}<polygon points="3,80 ${line} 97,80"></polygon>${separators.join('')}<polyline class="progress-main-line" points="${line}"></polyline><polyline class="progress-median-line" points="${mline}"></polyline>${visible.map((p,i)=>{const pt=pts[i],pb=pbSet.has(p.pullNumber),review=(p.progressMetricFlags||[]).length;return `<circle class="progress-point${pb?' pb':''}${review?' review':''}" cx="${pt.x}" cy="${pt.y}" r="${pb?1.12:.58}"><title>Global ${p.pullNumber} · ${fmtPct(value(p))} · Stage ${p.stageCount}${review?` · ${p.progressMetricFlags.join(', ')}`:''}</title></circle>`;}).join('')}</svg><div class="pull-labels"><span>GLOBAL ${visible[0]?.pullNumber??'—'}</span><span>GLOBAL ${visible[Math.floor((visible.length-1)/2)]?.pullNumber??'—'}</span><span>GLOBAL ${visible.at(-1)?.pullNumber??'—'}</span></div>`;
    const legend=qs('.legend-row',panel);if(legend){legend.dataset.progressIndicator='1';legend.innerHTML=`<span><i class="good"></i>Metric-eligible progress</span><span><i class="info"></i>${medSize}-pull display median</span><span><i class="warn"></i>New PB</span><span><i class="progress-night-key"></i>Raid-night boundary</span>`;}
  }

  function renderNights(m){
    const panel=panelByTitle('Night-over-night');if(!panel)return;panel.dataset.progressIndicator='1';
    const title=qs('.panel-title p',panel);if(title)title.textContent='Raw night size + same metric-eligible subset used by strategic Progress metrics';
    const nights=Array.isArray(m.nights)?m.nights:[],table=qs('.night-table',panel);
    if(table){const show=nights.slice(-4);table.innerHTML=show.length?show.map((n,idx)=>`<div class="${idx===show.length-1?'active':''}" data-progress-indicator="1"><span>${fmtDate(n.startTime)} · ${n.pulls} RAW PULLS<small>Global ${n.firstGlobalPull}–${n.lastGlobalPull} · ${n.metricEligiblePulls}/${n.pulls} eligible · Best ${fmtPct(n.bestFightPercentage)} · ${fmtPct(n.deepPullRatePct,0)} deep</small></span><b>Median ${fmtPct(n.medianFightPercentage)}</b><em>${finite(n.medianDeltaPp)?`${fmtPp(n.medianDeltaPp)} vs prior`:'First loaded night'} · eligible median</em></div>`).join(''):'<div data-progress-indicator="1"><span>NO RAID-NIGHT HISTORY</span><b>—</b><em>—</em></div>';}
    const badge=qs('.insight-box .badge',panel);if(badge)badge.textContent='INTERDAY READ';
    const insight=qs('.insight-box p',panel),latest=nights.at(-1);
    if(insight){
      if(!latest)insight.textContent='No comparable raid-night history is loaded.';
      else if(!finite(latest.medianDeltaPp))insight.textContent='This is the first comparable raid night in the loaded history.';
      else if(Math.abs(latest.medianDeltaPp)<.5)insight.textContent=`Latest eligible median held near ${fmtPct(latest.medianFightPercentage)}. Use CURRENT FORM deep-pull rate and stage conversion for movement.`;
      else if(latest.medianDeltaPp>0)insight.textContent=`Latest night improved metric-eligible median depth by ${Math.abs(latest.medianDeltaPp).toFixed(1)}pp versus the previous night.`;
      else insight.textContent=`Latest night was ${Math.abs(latest.medianDeltaPp).toFixed(1)}pp shallower on metric-eligible median than the previous night.`;
    }
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

  function renderDataQuality(panel,m){
    const dq=m.dataQuality||{},details=qs('.progress-data-quality',panel),body=qs('.progress-data-quality-body',panel);if(!details||!body)return;
    details.className=`progress-data-quality grade-${String(dq.grade||'unknown').toLowerCase()}`;
    const summary=qs('summary',details);if(summary)summary.textContent=`DATA QUALITY · ${dq.grade||'UNKNOWN'} · ${dq.metricEligiblePulls??0}/${dq.rawPulls??0} ELIGIBLE`;
    const rows=Array.isArray(dq.auditRows)?dq.auditRows:[];
    body.innerHTML=`<div class="progress-quality-kpis"><span><b>${dq.rawPulls??0}</b>RAW</span><span><b>${dq.metricEligiblePulls??0}</b>ELIGIBLE</span><span><b>${dq.metricExcludedPulls??0}</b>EXCLUDED</span><span><b>${dq.exactHundredPulls??0}</b>EXACT 100%</span></div>${(dq.notes||[]).length?`<div class="progress-quality-notes">${dq.notes.map(n=>`<p>${esc(n)}</p>`).join('')}</div>`:''}${rows.length?`<div class="progress-quality-audit"><div class="head"><span>PULL</span><span>WCL</span><span>BOSS</span><span>STAGE</span><span>DURATION</span><span>STATUS / SOURCE</span></div>${rows.map(r=>`<div><span>#${r.globalPullNumber}</span><span>${fmtPct(r.fightPercentage)}</span><span>${fmtPct(r.bossPercentage)}</span><span>S${r.stageCount}</span><span>${fmtMinutes((r.durationMs||0)/60000)}</span><span>${r.metricEligible?'REVIEW':'EXCLUDED'} · ${esc(r.reason)}<small>${esc((r.flags||[]).join(' · '))}${r.reportCodes?.length?` · report ${esc(r.reportCodes.join(','))}`:''}${r.fightIds?.length?` · fight ${esc(r.fightIds.join(','))}`:''}</small></span></div>`).join('')}</div>`:'<p>No flagged pulls in the loaded canonical history.</p>'}`;
  }

  function renderHealth(m){
    const panel=ensureHealthPanel();if(!panel)return;panel.dataset.progressIndicator='1';
    const h=m.health||{},block=m.block||{},ret=h.retention||{},thr=h.throughput||{};
    writeHealth(qs('[data-health="phase"]',panel),fmtPct(h.phaseConversionPct,0),fmtPp(h.phaseConversionDeltaPp),`CURRENT FORM · ${block.currentBlock?.metricEligiblePulls??0}/${m.policy?.currentFormPulls??20} eligible · Stage ${block.deepestStage}`,finite(h.phaseConversionDeltaPp)&&h.phaseConversionDeltaPp>0?'good':'');
    const retCard=qs('[data-health="retention"]',panel);
    if(!ret.available){const reason=ret.reason==='weak-closing-baseline'?`Previous eligible closing median ${fmtPct(ret.previousClosingPct)} is too shallow`:ret.reason==='insufficient-eligible-pulls'?'Not enough metric-eligible pulls in both nights':'Needs two comparable timestamped nights';writeHealth(retCard,'—','NO VALID BASELINE',reason);}
    else if(!ret.recovered)writeHealth(retCard,'NOT YET',`${ret.currentEligiblePulls??0} ELIGIBLE`,`Previous eligible closing level ${fmtPct(ret.previousClosingPct)} has not been recovered`,'warn');
    else writeHealth(retCard,`${ret.pullsToRecover} PULLS`,fmtMinutes(ret.minutes),`Recovered previous eligible closing ${fmtPct(ret.previousClosingPct)} within ±${m.policy?.retentionTolerancePp??2}pp`,'good');
    const thrCard=qs('[data-health="throughput"]',panel);
    if(!thr.available)writeHealth(thrCard,'—','NO TIMESTAMPS','Needs timestamped raw analytical pulls');
    else writeHealth(thrCard,`${fmtNum(thr.current?.pullsPerHour)} / H`,finite(thr.deltaPullsPerHour)?`${thr.deltaPullsPerHour>=0?'↑':'↓'} ${Math.abs(thr.deltaPullsPerHour).toFixed(1)}/h vs prior`:'LATEST NIGHT',`RAW NIGHT SCOPE · median downtime ${fmtMinutes(thr.current?.medianDowntimeMinutes)} · ${thr.current?.pulls??0} pulls across ${fmtMinutes(thr.current?.activeMinutes)}`,finite(thr.deltaPullsPerHour)&&thr.deltaPullsPerHour>0?'good':'');
    const sub=qs('.panel-title p',panel),d=m.diagnostics||{};
    if(sub)sub.textContent=`Model ${m.metricsVersion||'v2'} · ${m.totals?.rawPulls??0} raw · ${m.totals?.metricEligiblePulls??0} eligible · ${m.totals?.nights??0} nights · ${Object.values(d.invariants||{}).every(Boolean)?'invariants OK':'DATA INVARIANT WARNING'}`;
    renderDataQuality(panel,m);
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
    renderBannerAndStats(m);renderChart(raw,eligible,m);renderNights(m);renderMatrix(m);renderHealth(m);
  }

  takeProgressOwnership();
  document.addEventListener('click',blockIndicatorInteraction,true);
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>renderFull(true),100),{once:true});
  document.addEventListener('click',e=>{if(e.target?.closest?.('nav button'))setTimeout(()=>renderFull(true),190);},true);
  window.addEventListener('popstate',()=>setTimeout(()=>renderFull(true),120));
  setInterval(()=>renderFull(false),750);
})();
