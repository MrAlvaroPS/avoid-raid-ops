(()=>{
'use strict';
const RELEASE='3.9.13.11';
if(window.__AVOID_LOOT_V391311_OVERLAY__)return;
window.__AVOID_LOOT_V391311_OVERLAY__=true;

const STYLE_ID='avoid-loot-v391311-overlay-style';
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

function refreshWowhead(attempt=0){
  const power=window.$WowheadPower;
  if(power&&typeof power.refreshLinks==='function'){
    try{power.refreshLinks();return true;}catch{}
  }
  if(attempt<20)setTimeout(()=>refreshWowhead(attempt+1),100);
  return false;
}
function requestWowheadRefresh(){
  refreshWowhead(0);
  setTimeout(()=>refreshWowhead(0),75);
  setTimeout(()=>refreshWowhead(0),300);
}
function ensureWowhead(){
  window.whTooltips={...(window.whTooltips||{}),colorLinks:true,iconizeLinks:true,renameLinks:false,iconSize:'small'};
  const existing=q('script[src*="wow.zamimg.com/js/tooltips.js"]');
  if(existing){requestWowheadRefresh();return;}
  const script=document.createElement('script');script.src=TOOLTIP_SRC;script.async=true;script.dataset.avoidLootWowhead='1';script.addEventListener('load',requestWowheadRefresh,{once:true});document.head.append(script);
}

function parseItem(href=''){
  const text=String(href||'');const id=Number(text.match(/item(?:=|\/)(\d+)/i)?.[1]);
  let ilvl=null;try{const url=new URL(text,location.href),raw=url.searchParams.get('ilvl');if(finite(raw))ilvl=Number(raw);}catch{}
  return{itemId:Number.isInteger(id)&&id>0?id:null,itemLevel:ilvl};
}
function optionPairsFromHref(href=''){
  const text=String(href||''),at=text.indexOf('?');if(at<0)return[];
  return text.slice(at+1).split('#')[0].split('&').map(v=>v.trim()).filter(Boolean);
}
function wowheadOptions(sourceHref='',itemLevel=null){
  const options=optionPairsFromHref(sourceHref).filter(pair=>!/^ilvl=/i.test(pair));
  if(finite(itemLevel))options.push(`ilvl=${Number(itemLevel)}`);
  return options.join('&');
}
function manualIlvl(root){const value=q('[data-loot-ilvl]',root)?.value;return finite(value)&&Number(value)>0?Number(value):null;}
function wowheadHref(itemId){return`https://www.wowhead.com/item=${Number(itemId)}`;}
function configureAnchor(a,{itemId,itemLevel=null,label='World of Warcraft item',sourceHref=null}={}){
  const href=sourceHref||wowheadHref(itemId);a.href=href;
  // Never let the browser's native title replace/mask the full Wowhead tooltip.
  a.removeAttribute('title');a.setAttribute('aria-label',label);
  const options=wowheadOptions(href,itemLevel);if(options)a.setAttribute('data-wowhead',options);else a.removeAttribute('data-wowhead');
  a.setAttribute('data-wh-icon-size','small');a.setAttribute('data-wh-rename-link','false');
  return a;
}
function iconAnchor({itemId,itemLevel=null,label='World of Warcraft item',sourceHref=null}={}){
  if(!(Number(itemId)>0))return null;
  const a=document.createElement('a');a.className='loot-wowhead-icon-link';a.target='_blank';a.rel='noreferrer';configureAnchor(a,{itemId,itemLevel,label,sourceHref});
  const fallback=document.createElement('span');fallback.className='loot-wowhead-fallback';fallback.textContent='ITEM';a.append(fallback);return a;
}

function syncSelectedIlvl(root,heading,itemId,label){
  const ilvl=manualIlvl(root),anchor=q('.loot-wowhead-icon-link',heading);if(anchor)configureAnchor(anchor,{itemId,itemLevel:ilvl,label});
  let badge=q('.loot-selected-sim-ilvl',heading);if(ilvl){if(!badge){badge=document.createElement('span');badge.className='loot-selected-sim-ilvl';heading.append(badge);}badge.textContent=`SIM ILVL ${ilvl}`;badge.setAttribute('aria-label',`Simulation item level ${ilvl}`);}else badge?.remove();
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

function visibleItemLevel(cell){const match=String(cell?.textContent||'').match(/\bilvl\s*(\d+)/i);return match?Number(match[1]):null;}
function decorateCurrent(root){
  for(const cell of qa('.loot-current',root)){
    const links=qa('a[href*="wowhead.com/item"]',cell);for(const link of links){if(link.dataset.lootIconized==='1')continue;
      const sourceHref=link.href,parsed=parseItem(sourceHref),itemId=parsed.itemId;if(!itemId)continue;
      const itemLevel=parsed.itemLevel??visibleItemLevel(cell),label=link.textContent?.trim()||`Current item ${itemId}`,anchor=iconAnchor({itemId,itemLevel,label,sourceHref});if(!anchor)continue;
      // Preserve the exact WCL Wowhead URL so bonus IDs/gems/enchants survive into the tooltip.
      link.replaceWith(anchor);anchor.dataset.lootIconized='1';
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
