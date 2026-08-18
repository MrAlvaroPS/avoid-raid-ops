(() => {
  const VERSION='progress-legacy-retirement-v1';
  const EXECUTION_RETIRED=Object.freeze(['applyProgressPage','applyRealProgressMatrix']);

  for(const name of EXECUTION_RETIRED){
    const legacy=window[name];
    if(typeof legacy!=='function'||legacy.__avoidExecutionRetired)continue;
    const retired=function(){};
    retired.__avoidExecutionRetired=true;
    retired.__irisProgressOwner=true;
    retired.__legacy=legacy;
    window[name]=retired;
  }

  window.__AVOID_PROGRESS_LEGACY_RETIREMENT__=Object.freeze({
    version:VERSION,
    executionRetired:EXECUTION_RETIRED,
    policy:'temporary-guard-until-physical-source-deletion'
  });
})();
