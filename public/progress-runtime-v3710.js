(() => {
  const RELEASE='3.7.10';
  const state={range:'all',dataSignature:null};
  const qsa=(sel,root=document)=>root?[...root.querySelectorAll(sel)]:[];
  const qs=(sel,root=document)=>root?.querySelector(sel)||null;
  const finite=v=>Number.isFinite(Number(v));
  const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));
  const pctValue=p=>p?.kill?0:(finite(p?.fightPercentage)?Number(p.fightPercentage):null);

  window.__AVOID_PROGRESS_V3710__=Object.freeze({
    release:RELEASE,
    scope:'encounter-history',
    extraWclRequests:0,
    interactionPolicy:'explicit-controls-only'
  });

  function active(){return qsa('.page-banner h2').some(x=>x.textContent.trim()==='Are we actually getting better?');}
  function panelByTitle(...titles){return qsa('.panel').find(panel=>titles.includes(qs('.panel-title h3',panel)?.textContent.trim()))||null;}
  function fmtPct(v,digits=1){return finite(v)?`${Number(v).toFixed(digits)}%`:'—';}
  function fmtPpSigned(v){if(!finite(v))return'—';const n=Number(v);return `${n>0?'+':n<0?'−':''}${Math.abs(n).toFixed(1)}pp`;}
  function fmtNumber(v,digits=1){return finite(v)?Number(v).toFixed(digits):'—';}
  function fmtDate(ms){if(!finite(ms))return'—';try{return new Date(Number(ms)).toLocaleDateString(undefined,{day:'2-digit',month:'short'});}catch{return'—';}}
  function fmtMinutes(v){if(!finite(v))return'—';const n=Math.max(0,Number(v));if(n<60)return`${Math.round(n)} min`;const h=Math.floor(n/60),m=Math.round(n%60);return `${h}h ${m}m`;}
  function median(values){const a=values.filter(finite).map(Number).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
  function rate(n,d){return d?100*n/d:null;}

  function fallbackPulls(){
    const core=window.__AVOID_WCL__;
    return (core?.progression||[]).map((p,i)=>({
      pullNumber:finite(p.pullNumber)?Number(p.pullNumber):i+1,
      globalPullNumber:finite(p.pullNumber)?Number(p.pullNumber):i+1,
      fightId:Number(p.fightId),
      fightPercentage:finite(p.fightPercentage)?Number(p.fightPercentage):null,
      bossPercentage:finite(p.bossPercentage)?Number(p.bossPercentage):null,
      durationMs:finite(p.durationMs)?Number(p.durationMs):null,
      stageCount:finite(p.stageCount??p.maxPhase)?Number(p.stageCount??p.maxPhase):1,
      kill:Boolean(p.kill),
      absoluteStartTime:null,
      absoluteEndTime:null,
      sessionId:'current-report',
      sessionIndex:1,
      sessionPullNumber:i+1
    }));
  }

  function historyPulls(){
    const history=window.__AVOID_WCL_HISTORY__;
    const rows=Array.isArray(history?.progressionPulls)?history.progressionPulls:[];
    if(!rows.length)return fallbackPulls();
    return rows.map((p,i)=>({
      ...p,
      pullNumber:finite(p.globalPullNumber??p.pullNumber)?Number(p.globalPullNumber??p.pullNumber):i+1,
      globalPullNumber:finite(p.globalPullNumber??p.pullNumber)?Number(p.globalPullNumber??p.pullNumber):i+1,
      fightPercentage:finite(p.fightPercentage)?Number(p.fightPercentage):null,
      bossPercentage:finite(p.bossPercentage)?Number(p.bossPercentage):null,
      durationMs:finite(p.durationMs)?Number(p.durationMs):null,
      stageCount:finite(p.stageCount)?Math.max(1,Number(p.stageCount)):1,
      kill:Boolean(p.kill),
      sessionIndex:finite(p.sessionIndex)?Number(p.sessionIndex):1
    })).sort((a,b)=>Number(a.absoluteStartTime||a.pullNumber)-Number(b.absoluteStartTime||b.pullNumber));
  }

  function visiblePulls(pulls){
    if(state.range==='25')return pulls.slice(-25);
    if(state.range==='50')return pulls.slice(-50);
    if(state.range==='100')return pulls.slice(-100);
    return pulls;
  }

  function bestPull(pulls){return pulls.filter(p=>finite(pctValue(p))).slice().sort((a,b)=>Number(pctValue(a))-Number(pctValue(b)))[0]||null;}
  function rollingMedian(pulls,size){return pulls.map((_,i)=>median(pulls.slice(Math.max(0,i-size+1),i+1).map(p=>pctValue(p))));}
  function maxStage(pulls){return Math.max(1,...pulls.map(p=>Number(p.stageCount)||1));}

  function personalBests(pulls){
    const out=new Set();let best=Infinity;
    for(const p of pulls){
      const value=pctValue(p);if(!finite(value))continue;
      if(Number(value)<best-1e-9){best=Number(value);out.add(p.pullNumber);}
    }
    return out;
  }

  function sessionGroups(pulls){
    const map=new Map();
    for(const p of pulls){
      const key=p.sessionId||`session-${p.sessionIndex||1}`;
      if(!map.has(key))map.set(key,[]);
      map.get(key).push(p);
    }
    return [...map.entries()].map(([sessionId,rows])=>({sessionId,rows:rows.slice().sort((a,b)=>Number(a.absoluteStartTime||a.pullNumber)-Number(b.absoluteStartTime||b.pullNumber))}));
  }

  function blockMetrics(pulls){
    const best=bestPull(pulls);
    const bestPct=pctValue(best);
    const current=pulls.slice(-20).filter(p=>finite(pctValue(p)));
    const previous=pulls.slice(-40,-20).filter(p=>finite(pctValue(p)));
    const deepThreshold=finite(bestPct)?Math.min(100,Number(bestPct)+10):null;
    const deepRate=block=>finite(deepThreshold)&&block.length?rate(block.filter(p=>Number(pctValue(p))<=Number(deepThreshold)).length,block.length):null;
    const currentDeep=deepRate(current),previousDeep=deepRate(previous);
    const currentMedian=median(current.map(p=>pctValue(p)));
    const historicalBefore=pulls.slice(0,Math.max(0,pulls.length-current.length));
    const bestBefore=bestPull(historicalBefore);
    const bestBeforePct=finite(pctValue(bestBefore))?Number(pctValue(bestBefore)):bestPct;
    const previousMedian=median(previous.map(p=>pctValue(p)));
    const gap=finite(currentMedian)&&finite(bestPct)?Math.max(0,Number(currentMedian)-Number(bestPct)):null;
    const previousGap=finite(previousMedian)&&finite(bestBeforePct)?Math.max(0,Number(previousMedian)-Number(bestBeforePct)):null;
    const deepest=maxStage(pulls);
    const stageRate=block=>block.length?rate(block.filter(p=>Number(p.stageCount)>=deepest).length,block.length):null;
    const currentStage=stageRate(current),previousStage=stageRate(previous);
    return {
      best,bestPct,current,previous,deepThreshold,
      currentDeep,previousDeep,deepDelta:finite(currentDeep)&&finite(previousDeep)?Number(currentDeep)-Number(previousDeep):null,
      currentMedian,previousMedian,gap,previousGap,gapImprovement:finite(gap)&&finite(previousGap)?Number(previousGap)-Number(gap):null,
      deepest,currentStage,previousStage,stageDelta:finite(currentStage)&&finite(previousStage)?Number(currentStage)-Number(previousStage):null
    };
  }

  function breakthroughMetrics(pulls){
    if(!pulls.length)return {latest:null,pullsSince:null,nightsSince:null,count:0};
    let meaningfulBest=finite(pctValue(pulls[0]))?Number(pctValue(pulls[0])):100;
    let deepest=Number(pulls[0].stageCount)||1;
    const events=[];
    for(let i=1;i<pulls.length;i++){
      const p=pulls[i],value=pctValue(p),stage=Number(p.stageCount)||1;
      const reasons=[];
      if(p.kill)reasons.push('kill');
      if(stage>deepest)reasons.push(`stage ${stage}`);
      if(finite(value)&&Number(value)<=meaningfulBest-2)reasons.push(`${(meaningfulBest-Number(value)).toFixed(1)}pp depth`);
      if(reasons.length){
        events.push({pull:p,index:i,reasons});
        if(finite(value))meaningfulBest=Number(value);
      }
      if(stage>deepest)deepest=stage;
    }
    const latest=events.at(-1)||null;
    if(!latest)return {latest:null,pullsSince:pulls.length-1,nightsSince:Math.max(0,Number(pulls.at(-1)?.sessionIndex||1)-Number(pulls[0]?.sessionIndex||1)),count:0};
    return {
      latest,
      pullsSince:Math.max(0,pulls.length-1-latest.index),
      nightsSince:Math.max(0,Number(pulls.at(-1)?.sessionIndex||1)-Number(latest.pull.sessionIndex||1)),
      count:events.length
    };
  }

  function retentionMetrics(pulls){
    const groups=sessionGroups(pulls).filter(g=>g.rows.some(p=>finite(p.absoluteStartTime)));
    if(groups.length<2)return {available:false};
    const previous=groups.at(-2).rows.filter(p=>finite(pctValue(p)));
    const current=groups.at(-1).rows.filter(p=>finite(pctValue(p)));
    if(!previous.length||!current.length)return {available:false};
    const closing=median(previous.slice(-5).map(p=>pctValue(p)));
    if(!finite(closing))return {available:false};
    const threshold=Number(closing)+2;
    let recoveryIndex=null;
    for(let i=2;i<current.length;i++){
      const m=median(current.slice(i-2,i+1).map(p=>pctValue(p)));
      if(finite(m)&&Number(m)<=threshold){recoveryIndex=i;break;}
    }
    if(recoveryIndex===null)return {available:true,recovered:false,previousClosing:closing,threshold,currentPulls:current.length};
    const first=current[0],recovery=current[recoveryIndex];
    const minutes=finite(first.absoluteStartTime)&&finite(recovery.absoluteEndTime)?Math.max(0,(Number(recovery.absoluteEndTime)-Number(first.absoluteStartTime))/60000):null;
    return {available:true,recovered:true,pullsToRecover:recoveryIndex+1,minutes,previousClosing:closing,threshold};
  }

  function throughputMetrics(pulls){
    const groups=sessionGroups(pulls).filter(g=>g.rows.length>=2&&g.rows.every(p=>finite(p.absoluteStartTime)||finite(p.absoluteEndTime)));
    function one(rows){
      const timed=rows.filter(p=>finite(p.absoluteStartTime)&&finite(p.absoluteEndTime));
      if(timed.length<2)return null;
      const minutes=Math.max(1,(Number(timed.at(-1).absoluteEndTime)-Number(timed[0].absoluteStartTime))/60000);
      const pph=timed.length/(minutes/60);
      const gaps=[];
      for(let i=1;i<timed.length;i++){
        const gap=(Number(timed[i].absoluteStartTime)-Number(timed[i-1].absoluteEndTime))/60000;
        if(finite(gap)&&gap>=0&&gap<30)gaps.push(gap);
      }
      return {pulls:timed.length,minutes,pph,medianDowntime:median(gaps)};
    }
    if(!groups.length)return {available:false};
    const current=one(groups.at(-1).rows),previous=groups.length>1?one(groups.at(-2).rows):null;
    if(!current)return {available:false};
    return {available:true,current,previous,delta:previous&&finite(previous.pph)?current.pph-previous.pph:null};
  }

  function progressionState(pulls,block,breakthrough){
    if(pulls.some(p=>p.kill))return {label:'CLEARED',detail:'Kill recorded in loaded encounter history',tone:'good'};
    const recentBreakthrough=finite(breakthrough.pullsSince)&&breakthrough.pullsSince<=5;
    if(recentBreakthrough&&finite(block.deepDelta)&&block.deepDelta>=10)return {label:'BREAKTHROUGH',detail:`Deep-pull rate ${fmtPpSigned(block.deepDelta)} vs prior 20`,tone:'good'};
    if((finite(breakthrough.pullsSince)&&breakthrough.pullsSince>=40)||(finite(breakthrough.nightsSince)&&breakthrough.nightsSince>=2))return {label:'PLATEAU',detail:`${breakthrough.pullsSince??'—'} pulls · ${breakthrough.nightsSince??'—'} nights since meaningful breakthrough`,tone:'warn'};
    if(finite(block.currentStage)&&block.currentStage>=70)return {label:`STABILIZING S${block.deepest}`,detail:`${fmtPct(block.currentStage,0)} of last ${block.current.length} reach the deepest observed stage`,tone:'good'};
    if(finite(block.currentStage)&&block.currentStage>=40)return {label:`CONVERTING S${block.deepest}`,detail:`${fmtPct(block.currentStage,0)} deepest-stage conversion in the latest block`,tone:''};
    return {label:`LEARNING S${block.deepest}`,detail:`${fmtPct(block.currentDeep,0)} deep-pull rate in the latest block`,tone:''};
  }

  function dataSignature(pulls){
    const h=window.__AVOID_WCL_HISTORY__,first=pulls[0],last=pulls.at(-1);
    return [h?.generatedAt,pulls.length,first?.absoluteStartTime,first?.fightPercentage,last?.absoluteStartTime,last?.fightPercentage,h?.nights?.length].join('|');
  }

  function statCards(){return qsa('.stats-row .stat');}
  function writeStat(card,label,value,delta,meta,tone=''){
    if(!card)return;
    card.dataset.progressIndicator='1';
    card.setAttribute('aria-disabled','true');
    const l=qs(':scope > label',card);if(l)l.textContent=label;
    const b=qs('div > b',card);if(b)b.textContent=value;
    const em=qs('div > em',card);if(em){em.textContent=delta;em.className=tone;}
    const small=qs(':scope > small',card);if(small)small.textContent=meta;
  }

  function renderBannerAndStats(pulls){
    const history=window.__AVOID_WCL_HISTORY__;
    const nights=history?.nights||[];
    const block=blockMetrics(pulls),breakthrough=breakthroughMetrics(pulls),prog=progressionState(pulls,block,breakthrough);
    const banner=qs('.page-banner');
    if(banner){
      banner.dataset.progressIndicator='1';
      const badge=qs('.badge',banner);if(badge)badge.textContent='PROGRESSION HISTORY';
      const copy=qs('p',banner);if(copy)copy.textContent='Long-horizon encounter progress: depth, repeatability, phase conversion, retention and raid-time efficiency. Live owns the current raid night.';
      const bs=qs('.banner-stat',banner);
      if(bs){
        const label=qs('label',bs),value=qs('b',bs),small=qs('small',bs);
        if(label)label.textContent='PROGRESSION STATE';
        if(value){value.textContent=prog.label;value.className=`progress-state-value ${prog.tone||''}`;}
        if(small)small.textContent=prog.detail;
      }
    }

    const cards=statCards();
    const best=block.best;
    const windowLabel=history?.historyWindow?.daysBefore?`${history.historyWindow.daysBefore}-day loaded history`:'loaded encounter history';
    const deepDelta=finite(block.deepDelta)?fmtPpSigned(block.deepDelta):'BASELINE';
    const gapDelta=finite(block.gapImprovement)?`${Number(block.gapImprovement)>=0?'↓':'↑'} ${Math.abs(Number(block.gapImprovement)).toFixed(1)}pp`:'BASELINE';
    const lastBreak=breakthrough.latest;

    writeStat(cards[0],'TOTAL PROG PULLS',String(pulls.length),`${nights.length} NIGHTS`,`${windowLabel} · deduplicated analytical pulls`,'good');
    writeStat(cards[1],'BEST PULL',fmtPct(block.bestPct),best?.kill?'KILL':'PB',best?`Global pull ${best.pullNumber}${best.absoluteStartTime?` · ${fmtDate(best.absoluteStartTime)}`:''}`:'No scored pull','good');
    writeStat(cards[2],'DEEP PULL RATE',fmtPct(block.currentDeep,0),deepDelta,finite(block.deepThreshold)?`Last ${block.current.length} within 10pp of PB · ≤ ${fmtPct(block.deepThreshold)}`:'Need scored pulls',finite(block.deepDelta)&&block.deepDelta>0?'good':'');
    writeStat(cards[3],'CONSISTENCY GAP',finite(block.gap)?`${block.gap.toFixed(1)}pp`:'—',gapDelta,finite(block.currentMedian)&&finite(block.bestPct)?`Latest median ${fmtPct(block.currentMedian)} vs PB ${fmtPct(block.bestPct)} · lower gap is better`:'Need more history',finite(block.gapImprovement)&&block.gapImprovement>0?'good':'');
    writeStat(cards[4],'LAST BREAKTHROUGH',finite(breakthrough.pullsSince)?`${breakthrough.pullsSince} PULLS`:'—',finite(breakthrough.nightsSince)?`${breakthrough.nightsSince} NIGHT${breakthrough.nightsSince===1?'':'S'}`:'—',lastBreak?`Global pull ${lastBreak.pull.pullNumber} · ${lastBreak.reasons.join(' + ')}`:'No ≥2pp / new-stage breakthrough after baseline');
  }

  function point(p,i,length){
    const x=length===1?50:3+i/(length-1)*94;
    const y=6+clamp(pctValue(p))/100*74;
    return{x,y};
  }

  function renderChart(pulls){
    const panel=panelByTitle('All-pull progression');if(!panel)return;
    panel.dataset.progressStaticPanel='chart';
    const title=qs('.panel-title',panel);
    if(title){
      const sub=qs('p',title);if(sub)sub.textContent='Encounter-wide boss HP · rolling median · meaningful PBs · raid-night boundaries';
      let bar=qs('.progress-commandbar',panel);
      if(!bar){bar=document.createElement('div');bar.className='progress-commandbar';title.insertAdjacentElement('afterend',bar);}
      const ranges=[['all','ALL'],['100','LAST 100'],['50','LAST 50'],['25','LAST 25']];
      bar.innerHTML=`<span>RANGE</span>${ranges.map(([k,l])=>{const limit=k==='all'?Infinity:Number(k);const disabled=limit>=pulls.length&&k!=='all';return `<button type="button" data-progress-range="${k}" class="${state.range===k?'active':''}" ${disabled?'disabled':''}>${l}</button>`;}).join('')}<em>${visiblePulls(pulls).length} / ${pulls.length} pulls · ${sessionGroups(pulls).length} raid nights</em>`;
      qsa('[data-progress-range]',bar).forEach(btn=>btn.addEventListener('click',e=>{
        e.preventDefault();e.stopPropagation();
        if(btn.disabled)return;
        state.range=btn.dataset.progressRange;
        renderChart(pulls);
      }));
    }

    const visible=visiblePulls(pulls).filter(p=>finite(pctValue(p)));
    const curve=qs('.pullcurve',panel);if(!curve)return;
    const medSize=visible.length>=20?10:5;
    const meds=rollingMedian(visible,medSize);
    const pbs=personalBests(pulls);
    const pts=visible.map((p,i)=>point(p,i,visible.length));
    const line=pts.map(p=>`${p.x},${p.y}`).join(' ');
    const mline=meds.map((v,i)=>point({fightPercentage:v},i,meds.length)).map(p=>`${p.x},${p.y}`).join(' ');
    const separators=[];
    for(let i=1;i<visible.length;i++)if(visible[i].sessionId&&visible[i-1].sessionId&&visible[i].sessionId!==visible[i-1].sessionId){const x=(pts[i-1].x+pts[i].x)/2;separators.push(`<line class="progress-night-separator" x1="${x}" y1="5" x2="${x}" y2="80"><title>Raid-night boundary</title></line>`);}
    curve.dataset.progressRuntime=RELEASE;
    if(!visible.length){curve.innerHTML='<div class="progress-empty">No analytical pulls in this range.</div>';return;}
    curve.innerHTML=`<div class="axis"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div><svg viewBox="0 0 100 86" preserveAspectRatio="none" role="img" aria-label="Encounter-wide boss progress by global pull">${[6,24.5,43,61.5,80].map(y=>`<line x1="3" y1="${y}" x2="97" y2="${y}"></line>`).join('')}<polygon points="3,80 ${line} 97,80"></polygon>${separators.join('')}<polyline class="progress-main-line" points="${line}"></polyline><polyline class="progress-median-line" points="${mline}"></polyline>${visible.map((p,i)=>{const pt=pts[i],pb=pbs.has(p.pullNumber);return `<circle class="progress-point${pb?' pb':''}" cx="${pt.x}" cy="${pt.y}" r="${pb?1.12:.58}"><title>Global pull ${p.pullNumber} · ${fmtPct(pctValue(p))} · Stage ${p.stageCount}${p.absoluteStartTime?` · ${fmtDate(p.absoluteStartTime)}`:''}</title></circle>`;}).join('')}</svg><div class="pull-labels"><span>GLOBAL ${visible[0]?.pullNumber??'—'}</span><span>GLOBAL ${visible[Math.floor((visible.length-1)/2)]?.pullNumber??'—'}</span><span>GLOBAL ${visible.at(-1)?.pullNumber??'—'}</span></div>`;
    const legend=qs('.legend-row',panel);if(legend){legend.dataset.progressIndicator='1';legend.innerHTML=`<span><i class="good"></i>Boss HP remaining</span><span><i class="info"></i>${medSize}-pull median</span><span><i class="warn"></i>New personal best</span><span><i class="progress-night-key"></i>Raid-night boundary</span>`;}
    qs('.progress-pull-inspector',panel)?.remove();
  }

  function nightDeepRate(rows,threshold){
    const scored=rows.filter(p=>finite(pctValue(p)));if(!scored.length||!finite(threshold))return null;
    return rate(scored.filter(p=>Number(pctValue(p))<=Number(threshold)).length,scored.length);
  }

  function renderNights(pulls){
    const history=window.__AVOID_WCL_HISTORY__;
    const panel=panelByTitle('Night-over-night');if(!panel)return;
    panel.dataset.progressIndicator='1';panel.dataset.progressStaticPanel='nights';
    const nights=history?.nights||[];
    const block=blockMetrics(pulls);
    const title=qs('.panel-title p',panel);if(title)title.textContent='Interday progression · best depth, median depth and deep-pull repeatability';
    const table=qs('.night-table',panel);
    if(table){
      const groups=sessionGroups(pulls);
      const byId=new Map(groups.map(g=>[g.sessionId,g.rows]));
      const show=nights.slice(-4);
      table.innerHTML=show.length?show.map((n,idx)=>{
        const rows=byId.get(n.sessionId)||[];
        const dr=nightDeepRate(rows,block.deepThreshold);
        const prior=nights[nights.findIndex(x=>x.sessionId===n.sessionId)-1]||null;
        const delta=prior&&finite(prior.medianFightPercentage)&&finite(n.medianFightPercentage)?Number(prior.medianFightPercentage)-Number(n.medianFightPercentage):null;
        return `<div class="${idx===show.length-1?'active':''}" data-progress-indicator="1"><span>${fmtDate(n.startTime).toUpperCase()} · ${n.pulls} PULLS<small>Best ${fmtPct(n.bestFightPercentage)} · ${finite(dr)?`${fmtPct(dr,0)} deep pulls`:'deep rate unavailable'}</small></span><b>Median ${fmtPct(n.medianFightPercentage)}</b><em>${finite(delta)?`${Number(delta)>=0?'↓':'↑'} ${Math.abs(Number(delta)).toFixed(1)}pp vs prior`:'First loaded night'}</em></div>`;
      }).join(''):'<div data-progress-indicator="1"><span>NO RAID-NIGHT HISTORY</span><b>—</b><em>—</em></div>';
    }
    const badge=qs('.insight-box .badge',panel);if(badge)badge.textContent='INTERDAY READ';
    const insight=qs('.insight-box p',panel);
    if(insight){
      const latest=nights.at(-1),prior=nights.at(-2);
      if(latest&&prior&&finite(latest.medianFightPercentage)&&finite(prior.medianFightPercentage)){
        const gain=Number(prior.medianFightPercentage)-Number(latest.medianFightPercentage);
        insight.textContent=Math.abs(gain)<.5?`Latest night held a similar median depth (${fmtPct(latest.medianFightPercentage)}). Look to deep-pull repeatability and phase conversion for real movement.`:gain>0?`Latest night improved median depth by ${Math.abs(gain).toFixed(1)}pp versus the previous raid night.`:`Latest night was ${Math.abs(gain).toFixed(1)}pp shallower on median than the previous raid night.`;
      }else insight.textContent='More than one loaded raid night is required for an interday comparison.';
    }
  }

  function stageClass(pct){if(pct>=80)return'full';if(pct>=60)return'high';if(pct>=35)return'mid';if(pct>0)return'low';return'none';}

  function renderMatrix(pulls){
    const panel=panelByTitle('Phase progression matrix','Stage consistency matrix');if(!panel)return;
    panel.dataset.progressIndicator='1';panel.dataset.progressStaticPanel='matrix';
    const h3=qs('.panel-title h3',panel);if(h3)h3.textContent='Stage consistency matrix';
    const sub=qs('.panel-title p',panel);if(sub)sub.textContent='20-pull windows · percentage reaching each absolute stage · independent from chart range';
    const matrix=qs('.matrix',panel);if(!matrix)return;
    matrix.classList.add('progress-window-matrix');
    const deepest=maxStage(pulls);
    const source=pulls.slice(-160);
    const windows=[];
    for(let i=0;i<source.length;i+=20)windows.push(source.slice(i,i+20));
    matrix.style.gridTemplateColumns=`minmax(86px,1.1fr) repeat(${deepest},minmax(58px,1fr))`;
    const header=['<label></label>',...Array.from({length:deepest},(_,i)=>`<label>STAGE ${i+1}</label>`)].join('');
    const body=windows.map(win=>{
      const first=win[0]?.pullNumber,last=win.at(-1)?.pullNumber;
      const cells=Array.from({length:deepest},(_,i)=>{
        const stage=i+1,hit=win.filter(p=>Number(p.stageCount)>=stage).length,pct=rate(hit,win.length)||0;
        return `<i class="progress-window-cell ${stageClass(pct)}" data-progress-indicator="1"><span>${Math.round(pct)}%</span><title>${hit}/${win.length} pulls reached Stage ${stage}</title></i>`;
      }).join('');
      return `<b>PULLS ${first}–${last}</b>${cells}`;
    }).join('');
    matrix.innerHTML=header+body;
  }

  function ensureHealthPanel(){
    let panel=qs('.progress-health-panel');if(panel)return panel;
    const matrix=panelByTitle('Phase progression matrix','Stage consistency matrix');if(!matrix)return null;
    panel=document.createElement('article');
    panel.className='panel progress-health-panel';
    panel.innerHTML=`<div class="panel-title"><div><i>04</i><span><h3>Progression health</h3><p>Strategic signals that explain whether progress is becoming repeatable and raid time is being converted efficiently.</p></span></div></div><div class="progress-health-grid"><div class="progress-health-card" data-health="phase"><label>PHASE CONVERSION</label><b>—</b><em>—</em><small>Deepest observed stage</small></div><div class="progress-health-card" data-health="retention"><label>NIGHT RETENTION</label><b>—</b><em>—</em><small>Recovery of previous closing level</small></div><div class="progress-health-card" data-health="throughput"><label>RAID THROUGHPUT</label><b>—</b><em>—</em><small>Useful pulls per active hour</small></div></div>`;
    matrix.insertAdjacentElement('afterend',panel);
    return panel;
  }

  function writeHealth(card,value,delta,meta,tone=''){
    if(!card)return;card.dataset.progressIndicator='1';
    const b=qs('b',card);if(b)b.textContent=value;
    const em=qs('em',card);if(em){em.textContent=delta;em.className=tone;}
    const small=qs('small',card);if(small)small.textContent=meta;
  }

  function renderHealth(pulls){
    const panel=ensureHealthPanel();if(!panel)return;panel.dataset.progressIndicator='1';
    const block=blockMetrics(pulls),retention=retentionMetrics(pulls),throughput=throughputMetrics(pulls);
    const phase=qs('[data-health="phase"]',panel),ret=qs('[data-health="retention"]',panel),thr=qs('[data-health="throughput"]',panel);
    writeHealth(phase,fmtPct(block.currentStage,0),finite(block.stageDelta)?fmtPpSigned(block.stageDelta):'BASELINE',`${block.current.filter(p=>Number(p.stageCount)>=block.deepest).length}/${block.current.length} of latest pulls reached Stage ${block.deepest}`,finite(block.stageDelta)&&block.stageDelta>0?'good':'');
    if(!retention.available)writeHealth(ret,'—','NEED 2 NIGHTS','Requires two timestamped raid sessions');
    else if(!retention.recovered)writeHealth(ret,'NOT YET',`${retention.currentPulls} PULLS`,`Previous closing level ${fmtPct(retention.previousClosing)} has not been re-established on a 3-pull median`,'warn');
    else writeHealth(ret,`${retention.pullsToRecover} PULLS`,fmtMinutes(retention.minutes),`3-pull median recovered previous-night closing level (${fmtPct(retention.previousClosing)} ±2pp)`,'good');
    if(!throughput.available)writeHealth(thr,'—','NO TIMESTAMPS','Needs timestamped pulls from raid-night history');
    else writeHealth(thr,`${fmtNumber(throughput.current.pph)} / H`,finite(throughput.delta)?`${throughput.delta>=0?'↑':'↓'} ${Math.abs(throughput.delta).toFixed(1)}/h vs prior`:'LATEST NIGHT',`Median downtime ${fmtMinutes(throughput.current.medianDowntime)} · ${throughput.current.pulls} pulls across ${fmtMinutes(throughput.current.minutes)}`,finite(throughput.delta)&&throughput.delta>0?'good':'');
  }

  function blockIndicatorInteraction(event){
    if(!active())return;
    if(event.target?.closest?.('[data-progress-range]'))return;
    const blocked=event.target?.closest?.('[data-progress-indicator="1"],.stats-row .stat,.night-table,.progress-window-matrix,.progress-health-panel,.page-banner .banner-stat,.legend-row');
    if(!blocked)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
  }

  function renderFull(force=false){
    if(!active())return;
    const pulls=historyPulls();if(!pulls.length)return;
    const sig=dataSignature(pulls);
    if(!force&&sig===state.dataSignature)return;
    state.dataSignature=sig;
    renderBannerAndStats(pulls);
    renderChart(pulls);
    renderNights(pulls);
    renderMatrix(pulls);
    renderHealth(pulls);
  }

  document.addEventListener('click',blockIndicatorInteraction,true);
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>renderFull(true),80),{once:true});
  document.addEventListener('click',e=>{if(e.target?.closest?.('nav button'))setTimeout(()=>renderFull(true),180);},true);
  window.addEventListener('popstate',()=>setTimeout(()=>renderFull(true),120));
  setInterval(()=>renderFull(false),1000);
})();
