(()=>{
'use strict';
const RELEASE='3.9.13.12';
if(window.__AVOID_LOOT_V391312_OVERLAY__)return;
window.__AVOID_LOOT_V391312_OVERLAY__=true;

const STYLE_ID='avoid-loot-v391312-overlay-style';
const TOOLTIP_SRC='https://wow.zamimg.com/js/tooltips.js';
const q=(s,r=document)=>r?.querySelector(s)||null;
const qa=(s,r=document)=>r?[...r.querySelectorAll(s)]:[];
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
  .avoid-loot-root .loot-wowhead-icon-link{display:inline-flex!important;align-items:center;justify-content:center;vertical-align:middle;min-width:34px;min-height:34px;width:34px;height:34px;border:1px solid #33434a;border-radius:5px;background:#081014;text-decoration:none!important;overflow:visible;position:relative;font-size:0!important;line-height:0!important;color:transparent!important}
  .avoid-loot-root .loot-wowhead-icon-link:hover{border-color:#69e8b1;box-shadow:0 0 0 1px rgba(105,232,177,.16)}
  .avoid-loot-root .loot-wowhead-icon-link .iconsmall,.avoid-loot-root .loot-wowhead-icon-link .iconmedium,.avoid-loot-root .loot-wowhead-icon-link img{margin:0!important;vertical-align:middle!important;font-size:initial!important;line-height:initial!important;color:initial!important}
  .avoid-loot-root .loot-selected h3.loot-selected-icon-row{display:flex;align-items:center;gap:10px;margin-top:7px;margin-bottom:6px;min-height:36px}
  .avoid-loot-root .loot-selected-sim-ilvl{display:inline-flex;align-items:center;height:23px;padding:0 8px;border:1px solid #315746;border-radius:999px;color:#78f0b9;background:#0d1b16;font:800 10px/1 system-ui;letter-spacing:.04em;white-space:nowrap}
  .avoid-loot-root .loot-current{min-width:150px}
  .avoid-loot-root .loot-current .loot-wowhead-icon-link{margin-bottom:4px}
  .avoid-loot-root .loot-current small{display:block;max-width:190px;line-height:1.35}
  `;document.head.append(style);
}

function refreshWowhead(attempt=0){
  try{if(window.$WowheadPower?.refreshLinks){window.$WowheadPower.refreshLinks();return true;}}catch{}
  if(attempt<20)setTimeout(()=>refreshWowhead(attempt+1),100);
  return false;
}
function requestWowheadRefresh(){refreshWowhead(0);setTimeout(()=>refreshWowhead(0),100);setTimeout(()=>refreshWowhead(0),350);}
function ensureWowhead(){
  window.whTooltips={...(window.whTooltips||{}),colorLinks:true,iconizeLinks:true,renameLinks:false,iconSize:'small'};
  const existing=q('script[src*="wow.zamimg.com/js/tooltips.js"]');if(existing){requestWowheadRefresh();return;}
  const script=document.createElement('script');script.src=TOOLTIP_SRC;script.async=true;script.dataset.avoidLootWowhead='1';script.addEventListener('load',requestWowheadRefresh,{once:true});document.head.append(script);
}

function parseItem(href=''){
  const text=String(href||''),id=Number(text.match(/item(?:=|\/)(\d+)/i)?.[1]);
  let ilvl=null;try{const url=new URL(text,location.href),raw=url.searchParams.get('ilvl');if(finite(raw))ilvl=Number(raw);}catch{}
  return{itemId:Number.isInteger(id)&&id>0?id:null,itemLevel:ilvl};
}
function manualIlvl(root){const value=q('[data-loot-ilvl]',root)?.value;return finite(value)&&Number(value)>0?Number(value):null;}

function compactExistingAnchor(anchor,{label,itemLevel=null}={}){
  if(!anchor)return null;
  // Keep the exact original DOM node: Wowhead may already have attached tooltip state to it.
  anchor.classList.add('loot-wowhead-icon-link');
  anchor.target='_blank';anchor.rel='noreferrer';anchor.removeAttribute('title');
  if(label)anchor.setAttribute('aria-label',label);
  anchor.setAttribute('data-wh-icon-size','small');anchor.setAttribute('data-wh-rename-link','false');
  // href already identifies the item. data-wowhead is only for optional tooltip modifiers.
  if(finite(itemLevel))anchor.setAttribute('data-wowhead',`ilvl=${Number(itemLevel)}`);
  else if(anchor.getAttribute('data-wowhead')?.startsWith('item='))anchor.removeAttribute('data-wowhead');
  anchor.dataset.lootIconized='1';
  return anchor;
}

function ensureSimBadge(root,heading){
  const ilvl=manualIlvl(root);let badge=q('.loot-selected-sim-ilvl',heading);
  if(ilvl){if(!badge){badge=document.createElement('span');badge.className='loot-selected-sim-ilvl';heading.append(badge);}badge.textContent=`SIM ILVL ${ilvl}`;badge.setAttribute('aria-label',`Simulation item level ${ilvl}`);}else badge?.remove();
}

function decorateSelected(root){
  const selected=q('.loot-selected',root),heading=q('h3',selected);if(!selected||!heading)return;
  const all=qa('a[href*="wowhead.com/item"]',selected);
  const source=all.find(a=>!heading.contains(a))||all[0];if(!source)return;
  const parsed=parseItem(source.href);if(!parsed.itemId)return;
  const label=heading.dataset.lootItemLabel||heading.textContent?.trim()||source.textContent?.trim()||`Item ${parsed.itemId}`;heading.dataset.lootItemLabel=label;

  // If an older overlay fabricated an icon anchor, remove it. Move the ORIGINAL Wowhead anchor instead.
  for(const old of qa('.loot-wowhead-icon-link',heading))if(old!==source)old.remove();
  compactExistingAnchor(source,{label,itemLevel:manualIlvl(root)});
  if(source.parentElement!==heading){
    heading.textContent='';heading.classList.add('loot-selected-icon-row');heading.append(source);
  }
  heading.dataset.lootIconized='1';ensureSimBadge(root,heading);
}

function decorateCurrent(root){
  for(const cell of qa('.loot-current',root)){
    for(const link of qa('a[href*="wowhead.com/item"]',cell)){
      if(link.dataset.lootIconized==='1')continue;
      const parsed=parseItem(link.href);if(!parsed.itemId)continue;
      const label=link.textContent?.trim()||`Current item ${parsed.itemId}`;
      compactExistingAnchor(link,{label,itemLevel:null});
    }
  }
}

function updateRelease(root){for(const node of qa('.loot-kicker',root)){if(/IRIS\s*\/\s*RAID LOOT OPERATIONS/i.test(node.textContent||''))node.textContent=`IRIS / RAID LOOT OPERATIONS · v${RELEASE}`;}}
function decorate(){const root=q('.avoid-loot-root');if(!root||root.hidden)return;ensureStyle();ensureWowhead();updateRelease(root);decorateSelected(root);decorateCurrent(root);requestWowheadRefresh();}

let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;decorate();});};
const observer=new MutationObserver(schedule);observer.observe(document.documentElement,{subtree:true,childList:true});
document.addEventListener('input',event=>{if(event.target?.matches?.('[data-loot-ilvl]'))schedule();},true);
document.addEventListener('change',event=>{if(event.target?.matches?.('[data-loot-ilvl]'))schedule();},true);
window.addEventListener('avoid:home-history-ready',schedule);
schedule();
})();
