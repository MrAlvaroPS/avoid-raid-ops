(()=>{
'use strict';
const RELEASE='3.9.13.14';
if(window.__AVOID_LOOT_V391314_OVERLAY__)return;
window.__AVOID_LOOT_V391314_OVERLAY__=true;

const STYLE_ID='avoid-loot-v391314-overlay-style';
const TOOLTIP_SRC='https://wow.zamimg.com/js/tooltips.js';
const q=(s,r=document)=>r?.querySelector(s)||null;
const qa=(s,r=document)=>r?[...r.querySelectorAll(s)]:[];
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
  .avoid-loot-root .loot-wowhead-icon-wrap{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;width:34px;height:34px;position:relative;overflow:visible}
  .avoid-loot-root .loot-wowhead-icon-link{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;min-width:34px;min-height:34px;width:34px;height:34px;border:1px solid #33434a;border-radius:5px;background:#081014;text-decoration:none!important;overflow:visible;position:relative;pointer-events:none}
  .avoid-loot-root .loot-wowhead-icon-wrap:hover .loot-wowhead-icon-link{border-color:#69e8b1;box-shadow:0 0 0 1px rgba(105,232,177,.16)}
  .avoid-loot-root .loot-wowhead-icon-link .iconsmall,.avoid-loot-root .loot-wowhead-icon-link .iconmedium,.avoid-loot-root .loot-wowhead-icon-link img{margin:0!important;vertical-align:middle!important}
  .avoid-loot-root .loot-wowhead-icon-link:has(.iconsmall)>.loot-wowhead-fallback,.avoid-loot-root .loot-wowhead-icon-link:has(.iconmedium)>.loot-wowhead-fallback,.avoid-loot-root .loot-wowhead-icon-link:has(img)>.loot-wowhead-fallback{display:none}
  .avoid-loot-root .loot-wowhead-fallback{display:flex;align-items:center;justify-content:center;width:30px;height:30px;font:800 9px/1 system-ui;color:#7f9aa6;background:linear-gradient(135deg,#101b20,#071014)}
  .avoid-loot-root .loot-wowhead-tooltip-hitbox{position:absolute!important;inset:0!important;z-index:8!important;display:block!important;width:34px!important;height:34px!important;min-width:34px!important;min-height:34px!important;margin:0!important;padding:0!important;overflow:hidden!important;white-space:nowrap!important;cursor:pointer!important;background:transparent!important;border:0!important;color:transparent!important;text-decoration:none!important;font-size:0!important;line-height:0!important}
  .avoid-loot-root .loot-wowhead-tooltip-hitbox>*{visibility:hidden!important;pointer-events:none!important}
  .avoid-loot-root .loot-selected h3.loot-selected-icon-row{display:flex;align-items:center;gap:10px;margin-top:7px;margin-bottom:6px;min-height:36px}
  .avoid-loot-root .loot-selected-sim-ilvl{display:inline-flex;align-items:center;height:23px;padding:0 8px;border:1px solid #315746;border-radius:999px;color:#78f0b9;background:#0d1b16;font:800 10px/1 system-ui;letter-spacing:.04em;white-space:nowrap}
  .avoid-loot-root .loot-current{min-width:150px}
  .avoid-loot-root .loot-current .loot-wowhead-icon-wrap{margin-bottom:4px}
  .avoid-loot-root .loot-current small{display:block;max-width:190px;line-height:1.35}
  `;document.head.append(style);
}

function ensureWowhead(){
  if(q('script[src*="wow.zamimg.com/js/tooltips.js"]'))return;
  const script=document.createElement('script');script.src=TOOLTIP_SRC;script.async=true;script.dataset.avoidLootWowhead='1';script.addEventListener('load',refreshWowhead,{once:true});document.head.append(script);
}
function refreshWowhead(){
  try{window.$WowheadPower?.refreshLinks?.();}catch{}
  try{window.WH?.Tooltips?.refreshLinks?.();}catch{}
}
function requestWowheadRefresh(){queueMicrotask(refreshWowhead);setTimeout(refreshWowhead,75);setTimeout(refreshWowhead,250);}

function parseItem(href=''){
  const text=String(href||''),id=Number(text.match(/item(?:=|\/)(\d+)/i)?.[1]);
  let ilvl=null;try{const url=new URL(text,location.href),raw=url.searchParams.get('ilvl');if(finite(raw))ilvl=Number(raw);}catch{}
  return{itemId:Number.isInteger(id)&&id>0?id:null,itemLevel:ilvl};
}
function manualIlvl(root){const value=q('[data-loot-ilvl]',root)?.value;return finite(value)&&Number(value)>0?Number(value):null;}
function wowheadHref(itemId,itemLevel=null){return`https://www.wowhead.com/item=${Number(itemId)}${finite(itemLevel)?`?ilvl=${Number(itemLevel)}`:''}`;}
function configureVisualAnchor(a,{itemId,itemLevel=null,label='World of Warcraft item'}={}){
  a.href=wowheadHref(itemId,itemLevel);a.title=label;a.setAttribute('aria-label',label);a.setAttribute('data-wowhead',`item=${Number(itemId)}${finite(itemLevel)?`&ilvl=${Number(itemLevel)}`:''}`);return a;
}
function iconAnchor({itemId,itemLevel=null,label='World of Warcraft item'}={}){
  if(!(Number(itemId)>0))return null;
  const a=document.createElement('a');a.className='loot-wowhead-icon-link';a.target='_blank';a.rel='noreferrer';a.dataset.lootVisual='1';a.setAttribute('data-wh-iconize-link','true');a.setAttribute('data-wh-icon-size','small');a.setAttribute('data-wh-rename-link','false');configureVisualAnchor(a,{itemId,itemLevel,label});
  const fallback=document.createElement('span');fallback.className='loot-wowhead-fallback';fallback.textContent='ITEM';a.append(fallback);return a;
}
function iconWithOriginalTooltip({source,itemId,itemLevel=null,label='World of Warcraft item'}={}){
  if(!source||!(Number(itemId)>0))return null;
  const wrap=document.createElement('span');wrap.className='loot-wowhead-icon-wrap';wrap.dataset.lootIconized='1';
  const visual=iconAnchor({itemId,itemLevel,label});if(!visual)return null;
  // Keep the original text-era Wowhead anchor as a real 34x34 hover target. Its geometry remains
  // visible to the tooltip engine; only the anchor's text/children are visually suppressed.
  source.classList.add('loot-wowhead-tooltip-hitbox');source.dataset.lootTooltipHitbox='1';source.removeAttribute('title');
  wrap.append(visual,source);return wrap;
}

function ensureSimBadge(root,heading){
  const ilvl=manualIlvl(root);let badge=q('.loot-selected-sim-ilvl',heading);
  if(ilvl){if(!badge){badge=document.createElement('span');badge.className='loot-selected-sim-ilvl';heading.append(badge);}badge.textContent=`SIM ILVL ${ilvl}`;badge.setAttribute('aria-label',`Simulation item level ${ilvl}`);}else badge?.remove();
}
function decorateSelected(root){
  const selected=q('.loot-selected',root),heading=q('h3',selected);if(!selected||!heading)return;
  if(heading.dataset.lootIconized==='1'){ensureSimBadge(root,heading);return;}
  const source=qa('a[href*="wowhead.com/item"]',selected).find(a=>!heading.contains(a)&&a.dataset.lootVisual!=='1');if(!source)return;
  const parsed=parseItem(source.href);if(!parsed.itemId)return;
  const label=heading.textContent?.trim()||source.textContent?.trim()||`Item ${parsed.itemId}`;
  const wrap=iconWithOriginalTooltip({source,itemId:parsed.itemId,itemLevel:manualIlvl(root),label});if(!wrap)return;
  heading.textContent='';heading.classList.add('loot-selected-icon-row');heading.dataset.lootIconized='1';heading.append(wrap);ensureSimBadge(root,heading);
}
function decorateCurrent(root){
  for(const cell of qa('.loot-current',root)){
    const links=qa('a[href*="wowhead.com/item"]',cell).filter(link=>link.dataset.lootVisual!=='1'&&link.dataset.lootTooltipHitbox!=='1');
    for(const link of links){
      const parsed=parseItem(link.href);if(!parsed.itemId)continue;
      const label=link.textContent?.trim()||`Current item ${parsed.itemId}`;
      const parent=link.parentNode,marker=document.createComment('loot-wowhead-icon');parent.insertBefore(marker,link);
      const wrap=iconWithOriginalTooltip({source:link,itemId:parsed.itemId,itemLevel:parsed.itemLevel,label});if(!wrap){marker.remove();continue;}
      marker.replaceWith(wrap);
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
