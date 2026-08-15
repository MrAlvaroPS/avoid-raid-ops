(() => {
  const RELEASE='3.7.9';
  const state={range:'all',signature:null};
  const qsa=(sel,root=document)=>root?[...root.querySelectorAll(sel)]:[];
  const qs=(sel,root=document)=>root?.querySelector(sel)||null;
  const finite=v=>Number.isFinite(Number(v));
  const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));

  window.__AVOID_PROGRESS_V379__=Object.freeze({release:RELEASE,scope:'encounter-history',extraWclRequests:0});

  function active(){return qsa('.page-banner h2').some(x=>x.textContent.trim()==='Are we actually getting better?');}
  function panelByTitle(...titles){return qsa('.panel').find(panel=>titles.includes(qs('.panel-title h3',panel)?.textContent.trim()))||null;}
  function fmtPct(v,digits=1){return finite(v)?`${Number(v).toFixed(digits)}%`:'—';}
  function fmtPp(v){return finite(v)?`${Math.abs(Number(v)).toFixed(1)}pp`:'—';}
  function fmtDate(ms){if(!finite(ms))return '—';try{return new Date(Number(ms)).toLocaleDateString(undefined,{day:'2-digit',month:'short'});}catch{return '—';}}
  function median(values){const a=values.filter(finite).map(Number).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}

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
      stageCount:finite(p.stageCount)?Number(p.stageCount):1,
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

  function personalBests(pulls){
    const out=new Set();let best=Infinity;
    for(const p of pulls){
      if(!finite(p.fightPercentage))continue;
      const value=p.kill?0:Number(p.fightPercentage);
      if(value<best-1e-9){best=value;out.add(p.pullNumber);}
    }
    return out;
  }

  function bestPull(pulls){return pulls.filter(p=>finite(p.fightPercentage)).slice().sort((a,b)=>Number(a.fightPercentage)-Number(b.fightPercentage))[0]||null;}
  function rollingMedian(pulls,size){return pulls.map((_,i)=>median(pulls.slice(Math.max(0,i-size+1),i+1).map(p=>p.fightPercentage)));}
  function maxStage(pulls){return Math.max(1,...pulls.map(p=>Number(p.stageCount)||1));}

  function trend(pulls){
    const n=pulls.length;
    const size=n>=40?20:n>=20?10:n>=10?5:0;
    if(!size)return {size:0,current:null,previous:null,gain:null};
    const current=median(pulls.slice(-size).map(p=>p.fightPercentage));
    const previous=median(pulls.slice(-size*2,-size).map(p=>p.fightPercentage));
    const gain=finite(current)&&finite(previous)?Number(previous)-Number(current):null;
    return {size,current,previous,gain};
  }

  function signature(pulls){
    const history=window.__AVOID_WCL_HISTORY__;
    const first=pulls[0],last=pulls.at(-1);
    return [history?.generatedAt,pulls.length,first?.absoluteStartTime,first?.fightPercentage,last?.absoluteStartTime,last?.fightPercentage,state.range].join('|');
  }

  function statCards(){return qsa('.stats-row .stat');}
  function writeStat(card,label,value,delta,meta,tone=''){
    if(!card)return;
    const l=qs(':scope > label',card);if(l)l.textContent=label;
    const b=qs('div > b',card);if(b)b.textContent=value;
    const em=qs('div > em',card);if(em){em.textContent=delta;em.className=tone;}
    const small=qs(':scope > small',card);if(small)small.textContent=meta;
  }

  function renderBannerAndStats(pulls){
    const history=window.__AVOID_WCL_HISTORY__;
    const nights=history?.nights||[];
    const banner=qs('.page-banner');
    const t=trend(pulls);
    if(banner){
      const badge=qs('.badge',banner);if(badge)badge.textContent='PROGRESSION HISTORY';
      const copy=qs('p',banner);if(copy)copy.textContent='Encounter-wide progression across reports and raid nights. Use this page for long-horizon depth, consistency and breakthrough trends; Live owns the current raid night.';
      const bs=qs('.banner-stat',banner);
      if(bs){
        const label=qs('label',bs),value=qs('b',bs),small=qs('small',bs);
        if(label)label.textContent=t.size?`${t.size}-PULL TREND`:'PROGRESSION DEPTH';
        if(t.size&&finite(t.gain)){
          const improved=Number(t.gain)>0.05,regressed=Number(t.gain)<-0.05;
          if(value){value.textContent=fmtPp(t.gain);value.className=improved?'good-text':regressed?'bad-text':'';}
          if(small)small.textContent=improved?`deeper median vs previous ${t.size}`:regressed?`shallower median vs previous ${t.size}`:`stable median vs previous ${t.size}`;
        }else{
          const best=bestPull(pulls);
          if(value){value.textContent=fmtPct(best?.fightPercentage);value.className='';}
          if(small)small.textContent='best observed boss HP · more pulls needed for a trend window';
        }
      }
    }

    const cards=statCards();
    const best=bestPull(pulls);
    const last20=pulls.slice(-20);
    const last20Median=median(last20.map(p=>p.fightPercentage));
    const deepest=maxStage(pulls);
    const reached=last20.filter(p=>Number(p.stageCount)>=deepest).length;
    const reachPct=last20.length?100*reached/last20.length:null;
    const pb=personalBests(pulls);
    const lastPb=[...pb].at(-1);
    const sincePb=finite(lastPb)?Math.max(0,Number(pulls.at(-1)?.pullNumber||0)-Number(lastPb)):null;
    const windowLabel=history?.historyWindow?.daysBefore?`${history.historyWindow.daysBefore}-day encounter history`:'loaded encounter history';

    writeStat(cards[0],'TOTAL PROG PULLS',String(pulls.length),`${nights.length} NIGHTS`,`${windowLabel} · deduplicated analytical pulls`,'good');
    writeStat(cards[1],'BEST PULL',fmtPct(best?.fightPercentage),best?.kill?'KILL':'PB',best?`Global pull ${best.pullNumber}${best.absoluteStartTime?` · ${fmtDate(best.absoluteStartTime)}`:''}`:'No scored pull','good');
    writeStat(cards[2],'LAST 20 MEDIAN',fmtPct(last20Median),`${last20.length} PULLS`,'Median remaining boss HP in the latest progression block');
    writeStat(cards[3],'DEEPEST STAGE REACH',finite(reachPct)?fmtPct(reachPct,0):'—','LAST 20',`${reached}/${last20.length||0} reached Stage ${deepest}`,'good');
    writeStat(cards[4],'PULLS SINCE PB',finite(sincePb)?String(sincePb):'—','GLOBAL',finite(lastPb)?`Last new personal best was global pull ${lastPb}`:'No personal best history');
  }

  function point(p,i,length){
    const x=length===1?50:3+i/(length-1)*94;
    const y=6+clamp(p.fightPercentage)/100*74;
    return {x,y};
  }

  function queueRender(){
    requestAnimationFrame(()=>render(true));
    setTimeout(()=>render(true),90);
    setTimeout(()=>render(true),240);
  }

  function renderChart(pulls){
    const panel=panelByTitle('All-pull progression');
    if(!panel)return;
    const title=qs('.panel-title',panel);
    if(title){
      const sub=qs('p',title);if(sub)sub.textContent='Encounter-wide WCL boss HP · rolling trend · personal bests · raid-night boundaries';
      let bar=qs('.progress-commandbar',panel);
      if(!bar){bar=document.createElement('div');bar.className='progress-commandbar';title.insertAdjacentElement('afterend',bar);}
      const ranges=[['all','ALL'],['100','LAST 100'],['50','LAST 50'],['25','LAST 25']];
      bar.innerHTML=`<span>RANGE</span>${ranges.map(([k,l])=>{const limit=k==='all'?Infinity:Number(k);const disabled=limit>=pulls.length&&k!=='all';return `<button type="button" data-progress-range="${k}" class="${state.range===k?'active':''}" ${disabled?'disabled':''}>${l}</button>`;}).join('')}<em>${visiblePulls(pulls).length} / ${pulls.length} pulls · ${new Set(pulls.map(p=>p.sessionId).filter(Boolean)).size||1} raid nights</em>`;
      qsa('[data-progress-range]',bar).forEach(btn=>btn.addEventListener('click',e=>{
        e.preventDefault();
        if(btn.disabled)return;
        state.range=btn.dataset.progressRange;
        queueRender();
      }));
    }

    const visible=visiblePulls(pulls).filter(p=>finite(p.fightPercentage));
    const curve=qs('.pullcurve',panel);if(!curve)return;
    const medSize=visible.length>=20?10:5;
    const meds=rollingMedian(visible,medSize);
    const pbs=personalBests(pulls);
    const pts=visible.map((p,i)=>point(p,i,visible.length));
    const line=pts.map(p=>`${p.x},${p.y}`).join(' ');
    const mline=meds.map((v,i)=>point({fightPercentage:v},i,meds.length)).map(p=>`${p.x},${p.y}`).join(' ');
    const separators=[];
    for(let i=1;i<visible.length;i++){
      if(visible[i].sessionId&&visible[i-1].sessionId&&visible[i].sessionId!==visible[i-1].sessionId){
        const x=(pts[i-1].x+pts[i].x)/2;
        separators.push(`<line class="progress-night-separator" x1="${x}" y1="5" x2="${x}" y2="80"><title>Raid-night boundary</title></line>`);
      }
    }
    curve.dataset.progressRuntime=RELEASE;
    curve.innerHTML=`<div class="axis"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div><svg viewBox="0 0 100 86" preserveAspectRatio="none" role="img" aria-label="Encounter-wide boss progress by global pull">${[6,24.5,43,61.5,80].map(y=>`<line x1="3" y1="${y}" x2="97" y2="${y}"></line>`).join('')}<polygon points="3,80 ${line} 97,80"></polygon>${separators.join('')}<polyline class="progress-main-line" points="${line}"></polyline><polyline class="progress-median-line" points="${mline}"></polyline>${visible.map((p,i)=>{const pt=pts[i];const pb=pbs.has(p.pullNumber);return `<circle class="progress-point${pb?' pb':''}" cx="${pt.x}" cy="${pt.y}" r="${pb?1.12:.58}"><title>Global pull ${p.pullNumber} · ${fmtPct(p.fightPercentage)} · Stage ${p.stageCount}${p.absoluteStartTime?` · ${fmtDate(p.absoluteStartTime)}`:''}</title></circle>`;}).join('')}</svg><div class="pull-labels"><span>GLOBAL ${visible[0]?.pullNumber??'—'}</span><span>GLOBAL ${visible[Math.floor((visible.length-1)/2)]?.pullNumber??'—'}</span><span>GLOBAL ${visible.at(-1)?.pullNumber??'—'}</span></div>`;
    const legend=qs('.legend-row',panel);
    if(legend)legend.innerHTML=`<span><i class="good"></i>Boss HP remaining</span><span><i class="info"></i>${medSize}-pull median</span><span><i class="warn"></i>New personal best</span><span><i class="progress-night-key"></i>Raid-night boundary</span>`;
    qs('.progress-pull-inspector',panel)?.remove();
  }

  function renderNights(){
    const history=window.__AVOID_WCL_HISTORY__;
    const panel=panelByTitle('Night-over-night');if(!panel)return;
    const nights=history?.nights||[];
    const title=qs('.panel-title p',panel);if(title)title.textContent='Latest raid nights · pulls, best depth and median depth';
    const rows=qsa('.night-table > div',panel);
    const show=nights.slice(-3);
    rows.forEach((row,idx)=>{
      const n=show[idx];
      row.classList.toggle('active',Boolean(n&&idx===show.length-1));
      if(!n){const span=qs('span',row);if(span)span.textContent='NO ADDITIONAL RAID NIGHT';const b=qs('b',row);if(b)b.textContent='—';const em=qs('em',row);if(em)em.textContent='—';return;}
      const prior=nights[nights.findIndex(x=>x.sessionId===n.sessionId)-1]||null;
      const delta=prior&&finite(prior.medianFightPercentage)&&finite(n.medianFightPercentage)?Number(prior.medianFightPercentage)-Number(n.medianFightPercentage):null;
      const span=qs('span',row);if(span)span.innerHTML=`${fmtDate(n.startTime).toUpperCase()} · ${n.pulls} PULLS<small>Best ${fmtPct(n.bestFightPercentage)} · ${n.sourceReports||1} report${Number(n.sourceReports)===1?'':'s'}</small>`;
      const b=qs('b',row);if(b)b.textContent=`Median ${fmtPct(n.medianFightPercentage)}`;
      const em=qs('em',row);if(em)em.textContent=finite(delta)?`${Number(delta)>=0?'↓':'↑'} ${fmtPp(delta)} vs prior`:'First loaded night';
    });
    const insight=qs('.insight-box p',panel);
    if(insight){
      const first=nights[0],last=nights.at(-1);
      if(first&&last&&first!==last&&finite(first.medianFightPercentage)&&finite(last.medianFightPercentage)){
        const gain=Number(first.medianFightPercentage)-Number(last.medianFightPercentage);
        insight.textContent=gain>0?`Across ${nights.length} loaded raid nights, median boss HP moved ${fmtPp(gain)} deeper from the first recorded night to the latest.`:gain<0?`Across ${nights.length} loaded raid nights, the latest median is ${fmtPp(gain)} shallower than the first recorded night.`:`Across ${nights.length} loaded raid nights, median depth is broadly flat; look at stage consistency for stabilization.`;
      }else insight.textContent='One raid night is loaded. Cross-night progression will appear as more encounter history is available.';
    }
  }

  function stageClass(pct){if(pct>=80)return'full';if(pct>=60)return'high';if(pct>=35)return'mid';if(pct>0)return'low';return'none';}

  function renderMatrix(pulls){
    const panel=panelByTitle('Phase progression matrix','Stage consistency matrix');if(!panel)return;
    const h3=qs('.panel-title h3',panel);if(h3)h3.textContent='Stage consistency matrix';
    const sub=qs('.panel-title p',panel);if(sub)sub.textContent='20-pull windows · percentage reaching each absolute stage · latest 160 pulls when history is longer';
    const matrix=qs('.matrix',panel);if(!matrix)return;
    const deepest=maxStage(pulls);
    const blocks=[];
    for(let i=0;i<pulls.length;i+=20)blocks.push(pulls.slice(i,i+20));
    const shown=blocks.slice(-8);
    const startBlock=Math.max(0,blocks.length-shown.length);
    matrix.classList.add('progress-window-matrix');
    matrix.style.gridTemplateColumns=`92px repeat(${deepest},minmax(58px,1fr))`;
    const header=['<label></label>',...Array.from({length:deepest},(_,i)=>`<label>STAGE ${i+1}</label>`)].join('');
    const body=shown.map((block,localIndex)=>{
      const globalBlock=startBlock+localIndex;
      const first=block[0]?.pullNumber??globalBlock*20+1;
      const last=block.at(-1)?.pullNumber??first;
      const label=`PULLS ${first}–${last}`;
      const cells=Array.from({length:deepest},(_,s)=>{
        const stage=s+1;
        const count=block.filter(p=>Number(p.stageCount)>=stage).length;
        const pct=block.length?100*count/block.length:0;
        return `<i class="progress-window-cell ${stageClass(pct)}" title="${count}/${block.length} pulls reached Stage ${stage}"><span>${Math.round(pct)}%</span></i>`;
      }).join('');
      return `<b>${label}</b>${cells}`;
    }).join('');
    matrix.innerHTML=header+body;
  }

  function cleanupMisplacedLiveUi(){
    qs('.progress-rl-panel')?.remove();
    qsa('.progress-pull-inspector').forEach(el=>el.remove());
  }

  function render(force=false){
    if(!active())return;
    const pulls=historyPulls();if(!pulls.length)return;
    const sig=signature(pulls);
    if(!force&&state.signature===sig)return;
    state.signature=sig;
    cleanupMisplacedLiveUi();
    renderBannerAndStats(pulls);
    renderChart(pulls);
    renderNights();
    renderMatrix(pulls);
  }

  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>render(true),80),{once:true});
  document.addEventListener('click',e=>{if(e.target?.closest?.('nav button'))setTimeout(()=>render(true),180);},true);
  window.addEventListener('popstate',()=>setTimeout(()=>render(true),120));
  setInterval(()=>render(false),1000);
})();
