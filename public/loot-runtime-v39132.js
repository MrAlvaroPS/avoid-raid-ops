(()=>{
'use strict';
if(window.__AVOID_LOOT_V391310_LOADER__)return;
window.__AVOID_LOOT_V391310_LOADER__=true;
const script=document.createElement('script');
script.src='/loot-runtime-v39137.js?v=3.9.13.10';
script.async=false;
script.dataset.avoidLootRuntime='3.9.13.10';
script.addEventListener('load',()=>{
  if(document.querySelector('script[data-avoid-loot-overlay="3.9.13.10"]'))return;
  const overlay=document.createElement('script');overlay.src='/loot-runtime-v391310-overlay.js?v=3.9.13.10';overlay.async=false;overlay.dataset.avoidLootOverlay='3.9.13.10';document.head.append(overlay);
},{once:true});
document.head.append(script);
})();
