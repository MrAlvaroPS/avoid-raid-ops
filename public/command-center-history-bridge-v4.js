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

  // Transitional v4 ownership bridge. The legacy runtime still declares the
  // historical mixed writer, but this assignment replaces its global binding
  // before the canonical Progress runtime installs its active-screen guard.
  // No timer, observer or network request is introduced here.
  window.applyHistoryData=applyCommandCenterHistory;
  window.__AVOID_COMMAND_CENTER_HISTORY_V4__=Object.freeze({
    version:'command-center-history-bridge-v4',
    owner:'command-center',
    source:'window.__AVOID_WCL_HISTORY__',
    polling:false,
    observers:false,
  });
})();
