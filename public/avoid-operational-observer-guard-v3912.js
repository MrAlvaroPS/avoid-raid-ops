(()=>{
'use strict';
const NativeMutationObserver=window.MutationObserver;
if(typeof NativeMutationObserver!=='function')return;
let armed=true;
function isOperationalMutation(record){
  const target=record?.target;
  return target instanceof Element&&Boolean(target.closest?.('.avoid-operational-root'));
}
function GuardedMutationObserver(callback){
  if(!armed)return new NativeMutationObserver(callback);
  armed=false;
  window.MutationObserver=NativeMutationObserver;
  return new NativeMutationObserver((records,observer)=>{
    const external=(records||[]).filter(record=>!isOperationalMutation(record));
    if(external.length)callback(external,observer);
  });
}
GuardedMutationObserver.prototype=NativeMutationObserver.prototype;
window.MutationObserver=GuardedMutationObserver;
window.__AVOID_OPERATIONAL_OBSERVER_GUARD__=Object.freeze({version:'operational-observer-guard-v1',release:'3.9.12.1',scope:'next MutationObserver only',ignores:'.avoid-operational-root'});
})();
