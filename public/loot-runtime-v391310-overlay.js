(()=>{
'use strict';
const RELEASE='3.9.13.10';
if(window.__AVOID_LOOT_V391310_OVERLAY__)return;
window.__AVOID_LOOT_V391310_OVERLAY__=true;

const STYLE_ID='avoid-loot-v391310-overlay-style';
const TOOLTIP_SRC='https://wow.zamimg.com/js/tooltips.js';
const q=(s,r=document)=>r?.querySelector(s)||null;
const qa=(s,r=document)=>r?[...r.querySelectorAll(s)]:[];
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
  .avoid-loot-root .loot-wowhead-icon-link{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;min-width:34px;min-height:34px;width:34px;height:34px;border:1px solid #33434a;border-radius:5px;background:#081014;text-decoration:none!important;overflow:visible;position:relative}
  .avoid-loot-root .loot-wowhead-icon-link:hover{border-color:#69e8b1;box-shadow:0 0 0 1px rgba(105,232,177,.16)}
  .avoid-loot-root .loot-wowhead-icon-link .iconsmall,.avoid-loot-root .loot-wowhead-icon-link .iconmedium,.avoid-loot-root .loot-wowhead-icon-link img{margin:0!important;vertical-align:middle!important}
  .avoid-loot-root .loot-wowhead-icon-link:has(.iconsmall)>.loot-wowhead-fallback,.avoid-loot-root .loot-wowhead-icon-link:has(.iconmedium)>.loot-wowhead-fallback,.avoid-loot-root .loot-wowhead-icon-link:has(img)>.loot-wowhead-fallback{display:none}
  .avoid-loot-root .loot-wowhead-fallback{display:flex;align-items:center;justify-content:center;width:30px;height:30px;font:800 9px/1 system-ui;color:#7f9aa6;background:linear-gradient(135deg,#101b20,#071014)}
  .avoid-loot-root .loot-selected h3.loot-selected-icon-row{display:flex;align-items:center;gap:10px;margin-top:7px;margin-bottom:6px;min-height:36px}
  .avoid-loot-root .loot-selected-sim-ilvl{display:inline-flex;align-items:center;height:23px;padding:0 8px;border:1px solid #315746;border-radius:999px;color:#78f0b9;background:#0d1b16;font:800 10px/1 system-ui;letter-spacing:.04em;white-space:nowrap}
  .avoid-loot-root .loot-current{min-width:150px}
  .avoid-loot-root .loot-current .loot-wowhead-icon-link{margin-bottom:4px}
  .avoid-loot-root .loot-current small{display:block;max-width:190px;line-height:1.35}
  `;document.head.append(style);
}

function ensureWowhead(){
  window.whTooltips={...(window.whTooltips||{}),colorLinks:true,iconizeLinks:true,renameLinks:false};
  if(q('script[src*="wow.zamimg.com/js/tooltips.js"]'))return;
  const script=document.createElement('script');script.src=TOOLTIP_SRC;script.async=true;script.dataset.avoidLootWowhead='1';script.addEventListener('load',refreshWowhead,{once:true});document.head.append(script);
}

function refreshWowhead(){
  try{window.$WowheadPower?.refreshLinks?.();}catch{}
  try{window.WH?.Tooltips?.refreshLinks?.();}catch{}
}

function parseItem(href=''){
  const text=String(href||'');const id=Number(text.match(/item(?:=|\/)(\d+)/i)?.[1]);
  let ilvl=null;try{const url=new URL(text,location.href),raw=url.searchParams.get('ilvl');if(finite(raw))ilvl=Number(raw);}catch{}
  return{itemId:Number.isInteger(id)&&id>0?id:null,itemLevel:ilvl};
}

function manualIlvl(root){const value=q('[data-loot-ilvl]',root)?.value;return finite(value)&&Number(value)>0?Number(value):null;}
function wowheadHref(itemId,itemLevel=null){return`https://www.wowhead.com/item=${Number(itemId)}${finite(itemLevel)?`?ilvl=${Number(itemLevel)}`:''}`;}
function configureAnchor(a,{itemId,itemLevel=null,label='World of Warcraft item'}={}){a.href=wowheadHref(itemId,itemLevel);a.title=label;a.setAttribute('aria-label',label);a.setAttribute('data-wowhead',`item=${Number(itemId)}${finite(itemLevel)?`&ilvl=${Number(itemLevel)}`:''}`);return a;}
function iconAnchor({itemId,itemLevel=null,label='World of Warcraft item'}={}){
  if(!(Number(itemId)>0))return null;
  const a=document.createElement('a');a.className='loot-wowhead-icon-link';a.target='_blank';a.rel='noreferrer';a.setAttribute('data-wh-iconize-link','true');a.setAttribute('data-wh-icon-size','small');a.setAttribute('data-wh-rename-link','false');configureAnchor(a,{itemId,itemLevel,label});
  const fallback=document.createElement('span');fallback.className='loot-wowhead-fallback';fallback.textContent='ITEM';a.append(fallback);return a;
}

function syncSelectedIlvl(root,heading,itemId,label){
  const ilvl=manualIlvl(root),anchor=q('.loot-wowhead-icon-link',heading);if(anchor)configureAnchor(anchor,{itemId,itemLevel:ilvl,label});
  let badge=q('.loot-selected-sim-ilvl',heading);if(ilvl){if(!badge){badge=document.createElement('span');badge.className='loot-selected-sim-ilvl';heading.append(badge);}badge.textContent=`SIM ILVL ${ilvl}`;badge.title='Exact item level sent to SimulationCraft for both ST and MT5';}else badge?.remove();
}

function decorateSelected(root){
  const selected=q('.loot-selected',root);if(!selected)return;
  const source=q('a[href*="wowhead.com/item"]',selected),sourceParsed=parseItem(source?.href||''),heading=q('h3',selected);if(!heading)return;
  const current=q('.loot-wowhead-icon-link',heading),parsed=current?parseItem(current.href):sourceParsed,itemId=parsed.itemId;if(!itemId)return;
  const label=heading.dataset.lootItemLabel||heading.textContent?.trim()||source?.textContent?.trim()||`Item ${itemId}`;heading.dataset.lootItemLabel=label;
  if(heading.dataset.lootIconized!=='1'){
    const anchor=iconAnchor({itemId,itemLevel:manualIlvl(root),label});if(!anchor)return;heading.textContent='';heading.classList.add('loot-selected-icon-row');heading.dataset.lootIconized='1';heading.append(anchor);
  }
  syncSelectedIlvl(root,heading,itemId,label);
}

function decorateCurrent(root){
  for(const cell of qa('.loot-current',root)){
    const links=qa('a[href*="wowhead.com/item"]',cell);for(const link of links){if(link.dataset.lootIconized==='1')continue;const parsed=parseItem(link.href),itemId=parsed.itemId;if(!itemId)continue;const label=link.textContent?.trim()||`Current item ${itemId}`,anchor=iconAnchor({itemId,itemLevel:parsed.itemLevel,label});if(!anchor)continue;link.replaceWith(anchor);anchor.dataset.lootIconized='1';}
  }
}

function updateRelease(root){for(const node of qa('.loot-kicker',root)){if(/IRIS\s*\/\s*RAID LOOT OPERATIONS/i.test(node.textContent||''))node.textContent=`IRIS / RAID LOOT OPERATIONS · v${RELEASE}`;}}
function decorate(){const root=q('.avoid-loot-root');if(!root||root.hidden)return;ensureStyle();ensureWowhead();updateRelease(root);decorateSelected(root);decorateCurrent(root);queueMicrotask(refreshWowhead);}

let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;decorate();});};
const observer=new MutationObserver(schedule);observer.observe(document.documentElement,{subtree:true,childList:true});
document.addEventListener('input',event=>{if(event.target?.matches?.('[data-loot-ilvl]'))schedule();},true);
document.addEventListener('change',event=>{if(event.target?.matches?.('[data-loot-ilvl]'))schedule();},true);
window.addEventListener('avoid:home-history-ready',schedule);
schedule();
})();
