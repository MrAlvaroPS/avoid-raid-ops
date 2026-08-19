(()=>{
'use strict';
const RELEASE='3.9.12.1';
let mechanicsExecution=null,restoring=false;
const page=()=>String(document.querySelector('.page-head h1')?.textContent||'').trim().toLowerCase();
function capture(event){if(page()!=='mechanics'||!event?.detail)return;mechanicsExecution=event.detail;window.__AVOID_MECHANICS_RAID_EXECUTION__=mechanicsExecution;window.__AVOID_RAID_EXECUTION__=mechanicsExecution;}
function restore(){if(page()!=='mechanics'||!mechanicsExecution||restoring)return;window.__AVOID_MECHANICS_RAID_EXECUTION__=mechanicsExecution;if(window.__AVOID_RAID_EXECUTION__===mechanicsExecution)return;restoring=true;window.__AVOID_RAID_EXECUTION__=mechanicsExecution;queueMicrotask(()=>{window.dispatchEvent(new CustomEvent('avoid:raid-execution',{detail:mechanicsExecution}));restoring=false;});}
window.addEventListener('avoid:raid-execution',capture);
window.addEventListener('avoid:execution-context',restore);
window.addEventListener('avoid:active-report-data',restore);
window.addEventListener('popstate',restore);
window.addEventListener('hashchange',restore);
setInterval(restore,1000);
window.__AVOID_MECHANICS_STATE__=Object.freeze({release:RELEASE,get execution(){return mechanicsExecution;}});
})();