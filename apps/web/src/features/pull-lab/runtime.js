(() => {
  'use strict';

  const qsa=(selector,root=document)=>root?[...root.querySelectorAll(selector)]:[];
  const text=(node,value)=>{
    if(!node||value===undefined||value===null)return;
    const next=String(value);
    if(node.textContent!==next)node.textContent=next;
  };
  const fmtPct=(value,digits=1)=>{
    const n=Number(value);
    return Number.isFinite(n)?`${n.toFixed(digits)}%`:'—';
  };
  const fmtCompact=value=>{
    const n=Number(value);
    if(!Number.isFinite(n))return '—';
    if(Math.abs(n)>=1_000_000)return `${(n/1_000_000).toFixed(n>=10_000_000?1:2)}M`;
    if(Math.abs(n)>=1_000)return `${(n/1_000).toFixed(1)}K`;
    return Math.round(n).toString();
  };
  const fmtDuration=ms=>{
    const n=Number(ms);
    if(!Number.isFinite(n))return '—';
    const total=Math.max(0,Math.round(n/1000));
    const min=Math.floor(total/60);
    const sec=String(total%60).padStart(2,'0');
    return `${min}:${sec}`;
  };
  const panelByTitle=(title,root=document)=>qsa('.panel',root).find(panel=>qsa('.panel-title h3',panel).some(h=>h.textContent.trim()===title))||null;
  const setCompareCell=(row,colIndex,value)=>{
    const children=[...row.children];
    if(children[colIndex])text(children[colIndex],value);
  };
  const pullSignalDelta=signal=>{
    if(!signal||signal.delta==null)return '—';
    const d=Number(signal.delta);
    if(!Number.isFinite(d))return '—';
    if(signal.key==='progress')return `${d<=0?'+':''}${(-d).toFixed(1)}pp deeper`;
    if(signal.key==='firstDeath')return `${d>=0?'+':''}${(d/1000).toFixed(1)}s`;
    if(signal.key==='meaningfulDeaths')return `${d>0?'+':''}${d.toFixed(0)}`;
    if(signal.key==='stage')return `${d>=0?'+':''}${d.toFixed(0)}`;
    if(signal.key==='raidDps'||signal.key==='raidHps'){
      const base=Number(signal.baseline);
      return base?`${(d/base*100)>=0?'+':''}${(d/base*100).toFixed(1)}%`:'—';
    }
    return String(d);
  };
  const describePullSignal=signal=>{
    if(!signal)return 'No comparable data.';
    if(signal.key==='progress')return `WCL fightPercentage ${fmtPct(signal.current)} vs ${fmtPct(signal.baseline)}. Lower means deeper encounter progress.`;
    if(signal.key==='firstDeath')return `First friendly death ${fmtDuration(signal.current)} vs ${fmtDuration(signal.baseline)}.`;
    if(signal.key==='meaningfulDeaths')return `${signal.current} deaths before WCL wipe cutoff vs ${signal.baseline}.`;
    if(signal.key==='stage')return `Reached stage ${signal.current} vs stage ${signal.baseline}.`;
    if(signal.key==='raidDps')return signal.status==='observed'?`Raid DPS ${fmtCompact(signal.current)} vs ${fmtCompact(signal.baseline)}; not scored because stage reach differs.`:`Same-stage raid DPS ${fmtCompact(signal.current)} vs ${fmtCompact(signal.baseline)}.`;
    if(signal.key==='raidHps')return `Raid HPS ${fmtCompact(signal.current)} vs ${fmtCompact(signal.baseline)}; shown as demand context, not as better/worse.`;
    return signal.evidence||'WCL observation.';
  };

  function applyPullLabToRoot(root=document,telemetry=window.__AVOID_WCL_TELEMETRY__){
    const heading=qsa('.page-banner h2',root).find(x=>x.textContent.trim()==='Pull Lab');
    if(!heading)return false;
    const pi=telemetry?.pullIntelligence;
    const a=pi?.latest;
    const b=pi?.previous;
    if(!a||!b){
      const title=panelByTitle('Why pull 25 was better',root)?.querySelector('.panel-title h3');
      if(title)text(title,'Pull delta · insufficient data');
      return true;
    }

    const select=root.querySelector('.pull-select');
    const picks=qsa('b',select);
    if(picks[0])text(picks[0],`#${a.pullNumber} · ${fmtPct(a.fightPercentage)}`);
    if(picks[1])text(picks[1],`#${b.pullNumber} · ${fmtPct(b.fightPercentage)}`);

    const sync=root.querySelector('.sync-timeline');
    if(sync){
      const labels=qsa(':scope > label',sync);
      if(labels[0])text(labels[0],`#${a.pullNumber}`);
      if(labels[1])text(labels[1],`#${b.pullNumber}`);
      const tracks=qsa(':scope > div',sync);
      [a,b].forEach((pull,idx)=>{
        const tr=tracks[idx];
        if(!tr)return;
        const bars=qsa('i',tr);
        bars.forEach((bar,j)=>{
          const st=pull.stages?.[j];
          if(!st){bar.style.display='none';return;}
          bar.style.display='';
          const dur=Math.max(1,pull.durationMs);
          const left=Math.max(0,Number(st.startTime??0)-Number(pull.stages?.[0]?.startTime??0));
          const end=Math.max(left,Number(st.endTime??left)-Number(pull.stages?.[0]?.startTime??0));
          bar.style.left=`${100*left/dur}%`;
          bar.style.width=`${100*(end-left)/dur}%`;
        });
        qsa('u.death',tr).forEach((death,k)=>{
          if(k>0||pull.firstDeathMs==null){
            death.style.display='none';
          }else{
            death.style.display='';
            death.style.left=`${Math.min(99,100*pull.firstDeathMs/Math.max(1,pull.durationMs))}%`;
          }
        });
      });
      const footer=qsa(':scope > small span',sync);
      if(footer.length>=4){
        text(footer[0],'0:00');
        text(footer[1],a.stages?.[1]?.startTime!=null?`S2 · ${fmtDuration(Number(a.stages[1].startTime)-Number(a.stages[0].startTime))}`:'S2 · —');
        text(footer[2],a.stages?.[2]?.startTime!=null?`S3 · ${fmtDuration(Number(a.stages[2].startTime)-Number(a.stages[0].startTime))}`:'S3 · —');
        text(footer[3],fmtDuration(a.durationMs));
      }
    }

    const deltaPanel=qsa('article.panel',root).find(panel=>panel.querySelector('.delta-list'));
    if(deltaPanel){
      text(deltaPanel.querySelector('.panel-title h3'),`Pull ${a.pullNumber} vs Pull ${b.pullNumber}`);
      text(deltaPanel.querySelector('.panel-title p'),'Real WCL delta analysis · no root-cause claims');
      const rows=qsa('.delta-list p',deltaPanel);
      const signals=[...(pi.currentVsPrevious?.improvements||[]).slice(0,2),...(pi.currentVsPrevious?.regressions||[]).slice(0,2)];
      rows.forEach((row,idx)=>{
        const sig=signals[idx];
        text(row.querySelector('.badge'),sig?pullSignalDelta(sig):'—');
        text(row.querySelector('span > b'),sig?.label||'No additional classified signal');
        text(row.querySelector('span > small'),sig?describePullSignal(sig):'Awaiting mechanic/defensive rule packs for deeper causality.');
        row.classList.toggle('pending',!sig);
      });
    }

    const table=panelByTitle('Pull metrics comparator',root)?.querySelector('.compare-table');
    if(table){
      const head=table.querySelector('.ct-head');
      const h=head?[...head.children]:[];
      if(h[1])text(h[1],`#${a.pullNumber} · ${fmtPct(a.fightPercentage)}`);
      if(h[2])text(h[2],`#${b.pullNumber} · ${fmtPct(b.fightPercentage)}`);
      if(h[4])text(h[4],'LAST 5 MEDIAN');
      const base=pi.baselines?.last5||{};
      for(const row of qsa(':scope > div:not(.ct-head)',table)){
        const metric=row.children[0]?.textContent.trim();
        if(metric==='Duration'){
          setCompareCell(row,1,fmtDuration(a.durationMs));
          setCompareCell(row,2,fmtDuration(b.durationMs));
          setCompareCell(row,3,`${((a.durationMs-b.durationMs)/1000)>=0?'+':''}${((a.durationMs-b.durationMs)/1000).toFixed(0)}s`);
          setCompareCell(row,4,'—');
        }else if(metric==='Raid DPS'){
          setCompareCell(row,1,fmtCompact(a.raidDps));
          setCompareCell(row,2,fmtCompact(b.raidDps));
          const pc=Number(a.raidDps)&&Number(b.raidDps)?(Number(a.raidDps)/Number(b.raidDps)-1)*100:null;
          setCompareCell(row,3,Number.isFinite(pc)?`${pc>=0?'+':''}${pc.toFixed(1)}%`:'—');
          setCompareCell(row,4,fmtCompact(base.raidDps));
        }else if(metric==='Raid HPS'){
          setCompareCell(row,1,fmtCompact(a.raidHps));
          setCompareCell(row,2,fmtCompact(b.raidHps));
          setCompareCell(row,3,'OBSERVED');
          setCompareCell(row,4,fmtCompact(base.raidHps));
        }else if(metric==='First death'){
          setCompareCell(row,1,fmtDuration(a.firstDeathMs));
          setCompareCell(row,2,fmtDuration(b.firstDeathMs));
          setCompareCell(row,3,a.firstDeathMs!=null&&b.firstDeathMs!=null?`${((a.firstDeathMs-b.firstDeathMs)/1000)>=0?'+':''}${((a.firstDeathMs-b.firstDeathMs)/1000).toFixed(0)}s`:'—');
          setCompareCell(row,4,fmtDuration(base.firstDeathMs));
        }else if(metric==='Avoidable damage'){
          text(row.children[0],'Meaningful deaths');
          setCompareCell(row,1,String(a.meaningfulDeaths??'—'));
          setCompareCell(row,2,String(b.meaningfulDeaths??'—'));
          setCompareCell(row,3,Number.isFinite(Number(a.meaningfulDeaths))&&Number.isFinite(Number(b.meaningfulDeaths))?String(Number(a.meaningfulDeaths)-Number(b.meaningfulDeaths)):'—');
          setCompareCell(row,4,base.meaningfulDeaths==null?'—':String(base.meaningfulDeaths));
        }else{
          setCompareCell(row,1,'—');
          setCompareCell(row,2,'—');
          setCompareCell(row,3,'PENDING');
          setCompareCell(row,4,'—');
        }
      }
    }
    return true;
  }

  function snapshot(root=document){
    const heading=qsa('.page-banner h2',root).find(x=>x.textContent.trim()==='Pull Lab');
    if(!heading)return null;
    const deltaPanel=qsa('article.panel',root).find(panel=>panel.querySelector('.delta-list'));
    const comparator=panelByTitle('Pull metrics comparator',root);
    const select=root.querySelector('.pull-select');
    const sync=root.querySelector('.sync-timeline');
    return JSON.stringify({
      pullSelect:select?.outerHTML||null,
      timeline:sync?.outerHTML||null,
      delta:deltaPanel?.outerHTML||null,
      comparator:comparator?.outerHTML||null,
    });
  }

  function resetDynamicFields(root){
    const heading=qsa('.page-banner h2',root).find(x=>x.textContent.trim()==='Pull Lab');
    if(!heading)return false;
    qsa('.pull-select b',root).forEach(node=>text(node,'__PULL__'));
    const sync=root.querySelector('.sync-timeline');
    if(sync){
      qsa(':scope > label',sync).forEach(node=>text(node,'__PULL__'));
      qsa(':scope > div i',sync).forEach(node=>{node.style.display='';node.style.left='';node.style.width='';});
      qsa(':scope > div u.death',sync).forEach(node=>{node.style.display='';node.style.left='0%';});
      qsa(':scope > small span',sync).forEach(node=>text(node,'__TIME__'));
    }
    const deltaPanel=qsa('article.panel',root).find(panel=>panel.querySelector('.delta-list'));
    if(deltaPanel){
      text(deltaPanel.querySelector('.panel-title h3'),'Why pull 25 was better');
      text(deltaPanel.querySelector('.panel-title p'),'Automated delta analysis');
      qsa('.delta-list p',deltaPanel).forEach(row=>{
        text(row.querySelector('.badge'),'__DELTA__');
        text(row.querySelector('span > b'),'__LABEL__');
        text(row.querySelector('span > small'),'__DETAIL__');
        row.classList.remove('pending');
      });
    }
    const table=panelByTitle('Pull metrics comparator',root)?.querySelector('.compare-table');
    if(table){
      const head=table.querySelector('.ct-head');
      const h=head?[...head.children]:[];
      [1,2,4].forEach(index=>{if(h[index])text(h[index],'__HEAD__');});
      qsa(':scope > div:not(.ct-head)',table).forEach(row=>{
        for(let index=1;index<=4;index++)if(row.children[index])text(row.children[index],'__VALUE__');
      });
    }
    return true;
  }

  const state={
    mode:'parity-shadow',
    checks:0,
    mismatches:0,
    lastMismatch:null,
    directRequests:0,
    timers:0,
    observers:0,
  };

  function shadowAgainstLegacy(){
    const legacy=snapshot(document);
    if(legacy==null)return {...state,skipped:'pull-lab-not-visible'};
    const clone=document.body.cloneNode(true);
    resetDynamicFields(clone);
    applyPullLabToRoot(clone,window.__AVOID_WCL_TELEMETRY__);
    const source=snapshot(clone);
    state.checks+=1;
    if(source!==legacy){
      state.mismatches+=1;
      state.lastMismatch={legacy,source};
    }else{
      state.lastMismatch=null;
    }
    return {...state};
  }

  window.applyPullLabSource=()=>applyPullLabToRoot(document,window.__AVOID_WCL_TELEMETRY__);
  window.__AVOID_PULL_LAB_SOURCE_RUNTIME_STATE__=state;
  window.__AVOID_PULL_LAB_SOURCE_RUNTIME__=Object.freeze({
    version:'4.0.0-migration7-shadow1',
    sourceOwner:'apps/web/src/features/pull-lab/runtime.js',
    transport:'public/pull-lab-runtime.js',
    mode:'parity-shadow',
    writerPolicy:'legacy-authoritative-source-shadow-only',
    sources:Object.freeze(['window.__AVOID_WCL_TELEMETRY__']),
    shadows:Object.freeze(['applyPullLab']),
    directRequests:0,
    timers:0,
    observers:0,
    shadowAgainstLegacy,
  });
})();
