(()=>{
'use strict';
const NativeMutationObserver=window.MutationObserver;
if(typeof NativeMutationObserver!=='function')return;
let armed=true;
function page(){return String(document.querySelector('.page-head h1')?.textContent||'').trim().toLowerCase();}
function isOperationalMutation(record){
  const target=record?.target;
  return target instanceof Element&&Boolean(target.closest?.('.avoid-operational-root'));
}
function GuardedMutationObserver(callback){
  if(!armed)return new NativeMutationObserver(callback);
  armed=false;
  window.MutationObserver=NativeMutationObserver;
  return new NativeMutationObserver((records,observer)=>{
    /* LIVE is driven by explicit execution-context/data events. The React prototype
       continues mutating its hidden/background live DOM; letting those mutations
       trigger the operational renderer creates competing writes and visible flicker. */
    if(page()==='live')return;
    const external=(records||[]).filter(record=>!isOperationalMutation(record));
    if(external.length)callback(external,observer);
  });
}
GuardedMutationObserver.prototype=NativeMutationObserver.prototype;
window.MutationObserver=GuardedMutationObserver;
window.__AVOID_OPERATIONAL_OBSERVER_GUARD__=Object.freeze({version:'operational-observer-guard-v2',release:'3.9.12.5',scope:'next MutationObserver only',ignores:'.avoid-operational-root + all background mutations while LIVE',liveUpdates:'explicit execution-context/data events only'});
})();
