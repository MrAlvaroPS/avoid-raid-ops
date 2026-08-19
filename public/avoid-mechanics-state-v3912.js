(()=>{
'use strict';
const RELEASE='3.9.12.2';
let mechanicsExecution=null,restoring=false;
const page=()=>String(document.querySelector('.page-head h1')?.textContent||'').trim().toLowerCase();
function mark(){const canvas=document.querySelector('.canvas');if(!canvas)return;if(page()!=='mechanics'||!mechanicsExecution){delete canvas.dataset.irisMechanicsClassified;delete canvas.dataset.irisMechanicsPulls;return;}const mechanics=mechanicsExecution?.mechanics||[],pulls=Number(mechanicsExecution?.population?.pulls||0);canvas.dataset.irisMechanicsClassified=mechanics.length?'1':'0';canvas.dataset.irisMechanicsPulls=pulls>0?'1':'0';}
function capture(event){if(page()!=='mechanics'||!event?.detail)return;mechanicsExecution=event.detail;window.__AVOID_MECHANICS_RAID_EXECUTION__=mechanicsExecution;window.__AVOID_RAID_EXECUTION__=mechanicsExecution;mark();}
function restore(){if(page()!=='mechanics'){mark();return;}if(!mechanicsExecution||restoring){mark();return;}window.__AVOID_MECHANICS_RAID_EXECUTION__=mechanicsExecution;mark();if(window.__AVOID_RAID_EXECUTION__===mechanicsExecution)return;restoring=true;window.__AVOID_RAID_EXECUTION__=mechanicsExecution;queueMicrotask(()=>{window.dispatchEvent(new CustomEvent('avoid:raid-execution',{detail:mechanicsExecution}));restoring=false;mark();});}
window.addEventListener('avoid:raid-execution',capture);
window.addEventListener('avoid:execution-context',restore);
window.addEventListener('avoid:active-report-data',restore);
window.addEventListener('popstate',restore);
window.addEventListener('hashchange',restore);
setInterval(restore,1000);
window.__AVOID_MECHANICS_STATE__=Object.freeze({release:RELEASE,get execution(){return mechanicsExecution;}});
})();