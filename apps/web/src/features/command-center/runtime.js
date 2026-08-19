(() => {
  'use strict';

  const qsa=(selector,root=document)=>root?[...root.querySelectorAll(selector)]:[];
  const text=(node,value)=>{
    if(!node||value===undefined||value===null)return;
    const next=String(value);
    if(node.textContent!==next)node.textContent=next;
  };
  const ownText=node=>node?[...node.childNodes].filter(child=>child.nodeType===Node.TEXT_NODE).map(child=>child.textContent||'').join('').trim():'';
  const findOwnText=value=>qsa('*').find(node=>ownText(node)===value)||null;
  const panelByTitle=title=>qsa('.panel').find(panel=>qsa('.panel-title h3',panel).some(h=>h.textContent.trim()===title))||null;
  const fmtDeltaPctPoints=value=>{
    const n=Number(value);
    return Number.isFinite(n)?`${n>=0?'+':''}${n.toFixed(1)}pp`:'—';
  };

  function applyCommandCenterProgressCurve(){
    if(!findOwnText('Command Center'))return;
    const report=window.__AVOID_WCL__;
    const curve=document.querySelector('.pullcurve');
    if(!curve||!Array.isArray(report?.progression)||!report.progression.length)return;
    const values=report.progression.map(p=>Number(p.fightPercentage)).filter(Number.isFinite);
    if(!values.length)return;

    const svg=curve.querySelector('svg');
    if(!svg)return;
    const points=values.map((value,index)=>{
      const x=values.length===1?50:3+index/(values.length-1)*94;
      const y=6+Math.max(0,Math.min(100,value))/100*74;
      return `${x},${y}`;
    }).join(' ');
    const polyline=svg.querySelector('polyline');
    const polygon=svg.querySelector('polygon');
    if(polyline)polyline.setAttribute('points',points);
    if(polygon)polygon.setAttribute('points',`3,80 ${points} 97,80`);

    qsa('circle',svg).forEach(circle=>circle.remove());
    values.forEach((value,index)=>{
      const x=values.length===1?50:3+index/(values.length-1)*94;
      const y=6+Math.max(0,Math.min(100,value))/100*74;
      const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');
      circle.setAttribute('cx',String(x));
      circle.setAttribute('cy',String(y));
      circle.setAttribute('r',index===values.length-1?'1.5':'.6');
      svg.appendChild(circle);
    });

    const labels=qsa('.pull-labels span',curve);
    if(labels[0])text(labels[0],'PULL 1');
    if(labels[1])text(labels[1],`PULL ${Math.max(1,Math.ceil(values.length/2))}`);
    if(labels[2])text(labels[2],`PULL ${values.length}`);
  }

  function applyCommandCenterHistory(){
    const history=window.__AVOID_WCL_HISTORY__;
    if(!history?.ok||!findOwnText('Command Center'))return;

    const what=panelByTitle('What changed?');
    if(!what||!history.delta)return;

    text(what.querySelector('.panel-title p'),'Latest deduplicated raid session vs previous session');
    const changes=qsa('.change',what);
    if(changes[0]){
      text(changes[0].querySelector('label'),'PROGRESSION DELTA');
      text(changes[0].querySelector('b'),`Median ${fmtDeltaPctPoints(history.delta.medianPctPoints)}`);
      text(changes[0].querySelector('p'),`Best pull changed ${fmtDeltaPctPoints(history.delta.bestPctPoints)}.`);
      text(changes[0].querySelector('strong'),fmtDeltaPctPoints(history.delta.medianPctPoints));
    }
    if(changes[1]){
      text(changes[1].querySelector('label'),'PULL VOLUME');
      text(changes[1].querySelector('b'),`${history.delta.pullDelta>=0?'+':''}${history.delta.pullDelta} pulls`);
      text(changes[1].querySelector('p'),'Observed report-to-report volume; not a performance verdict.');
      text(changes[1].querySelector('strong'),String(history.delta.pullDelta));
    }
    if(changes[2]){
      text(changes[2].querySelector('label'),'ROSTER EFFECT');
      text(changes[2].querySelector('b'),'Association model pending');
      text(changes[2].querySelector('p'),'Matched-pull roster analysis is deliberately not inferred from two report summaries.');
      text(changes[2].querySelector('strong'),'—');
    }
  }

  window.applyProgressCurve=applyCommandCenterProgressCurve;
  window.applyHistoryData=applyCommandCenterHistory;
  window.__AVOID_COMMAND_CENTER_SOURCE_RUNTIME__=Object.freeze({
    version:'4.0.0-migration6-owner1',
    sourceOwner:'apps/web/src/features/command-center/runtime.js',
    transport:'public/command-center-runtime.js',
    mode:'single-source-owner',
    writerPolicy:'single-command-center-progression-history-owner',
    sources:Object.freeze(['window.__AVOID_WCL__','window.__AVOID_WCL_HISTORY__']),
    owns:Object.freeze(['applyProgressCurve','applyHistoryData']),
    directRequests:0,
    timers:0,
    observers:0,
  });
})();
