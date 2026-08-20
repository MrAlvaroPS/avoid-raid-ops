(()=>{
'use strict';
if(window.__AVOID_LOOT_V391310_PATCH__)return;
window.__AVOID_LOOT_V391310_PATCH__=true;
const RELEASE='3.9.13.10';
const norm=value=>String(value||'').trim().toLowerCase();
const finite=value=>value!==null&&value!==undefined&&Number.isFinite(Number(value));
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const iconUrl=icon=>icon?`https://wow.zamimg.com/images/wow/icons/small/${encodeURIComponent(String(icon).replace(/\.jpg$/i,''))}.jpg`:null;
const itemIdFromHref=href=>Number(String(href||'').match(/item=(\d+)/)?.[1])||null;
const itemLevelFromHref=href=>Number(String(href||'').match(/[?&]ilvl=(\d+)/)?.[1])||null;
function state(){try{return window.__AVOID_LOOT__?.getState?.()||null}catch{return null}}
function cachedProfile(rowName){const s=state(),key=norm(rowName),sim=s?.sim?.get?.(key)||null;if(sim)return sim;return null;}
function currentRowsFor(rowName){const sim=cachedProfile(rowName);return Array.isArray(sim?.currentSlot)?sim.currentSlot:[];}
function patchVersion(root){const kicker=root.querySelector('.loot-kicker');if(kicker&&/IRIS \/ RAID LOOT OPERATIONS/i.test(kicker.textContent||''))kicker.textContent=`IRIS / RAID LOOT OPERATIONS · v${RELEASE}`;}
function patchIdentity(row){const name=row.querySelector('.loot-player b')?.textContent?.trim();if(!name)return;const sim=cachedProfile(name),playerCell=row.querySelector('.loot-player'),meta=playerCell?.querySelector('small');if(!meta||!sim)return;const current=meta.textContent.split(' · '),className=current.at(-1)||'CLASS PENDING',spec=sim.importedSpecialization||null,role=sim.importedRole||null;if(spec||role)meta.textContent=`${spec||current[0]||'SPEC PENDING'} · ${String(role||current[1]||'UNKNOWN').toUpperCase()} · ${className}`;}
function patchCurrentSlot(row){const name=row.querySelector('.loot-player b')?.textContent?.trim(),cell=row.querySelector('.loot-current');if(!name||!cell)return;const cached=currentRowsFor(name),anchors=[...cell.querySelectorAll('a[href*="wowhead.com/item="]')];anchors.forEach((anchor,index)=>{if(anchor.dataset.lootIconized==='1')return;const href=anchor.href,id=itemIdFromHref(href),ilvl=itemLevelFromHref(href),gear=cached.find(item=>Number(item.id)===Number(id))||cached[index]||null,src=iconUrl(gear?.icon);anchor.dataset.lootIconized='1';anchor.classList.add('loot-current-icon');if(id)anchor.dataset.wowhead=`item=${id}${finite(ilvl)?`&ilvl=${ilvl}`:''}`;anchor.setAttribute('aria-label',gear?.name||`Item ${id||''}`);anchor.title=gear?.name?`${gear.name}${finite(gear.itemLevel)?` · ilvl ${gear.itemLevel}`:''}`:'Open item tooltip';anchor.innerHTML=src?`<img src="${esc(src)}" alt="" loading="lazy">`:'<span class="loot-item-icon-fallback" aria-hidden="true"></span>';});}
function patchSelectedItem(root){const selected=root.querySelector('.loot-selected h3');if(!selected||selected.querySelector('.loot-selected-icon'))return;const s=state(),item=s?.item;if(!item?.id)return;const link=document.createElement('a');link.className='loot-selected-icon loot-current-icon';link.href=item.wowheadUrl||`https://www.wowhead.com/item=${item.id}`;link.dataset.wowhead=`item=${item.id}${finite(s?.itemLevel)?`&ilvl=${Number(s.itemLevel)}`:''}`;link.target='_blank';link.rel='noreferrer';link.setAttribute('aria-label',item.name||`Item ${item.id}`);link.innerHTML='<span class="loot-item-icon-fallback" aria-hidden="true"></span>';selected.prepend(link);}
function patchSimIlvl(root){const s=state(),ilvl=finite(s?.itemLevel)?Number(s.itemLevel):null;if(!ilvl)return;root.querySelectorAll('.loot-sim-matrix').forEach(matrix=>{if(matrix.querySelector('.loot-matrix-ilvl'))return;const badge=document.createElement('span');badge.className='loot-matrix-ilvl';badge.textContent=`SIM ILVL ${ilvl}`;matrix.prepend(badge);});}
function patch(){const root=document.querySelector('.avoid-loot-root');if(!root)return;patchVersion(root);patchSelectedItem(root);patchSimIlvl(root);root.querySelectorAll('.loot-table tbody tr').forEach(row=>{patchIdentity(row);patchCurrentSlot(row);});}
let queued=false;const schedule=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;patch();});};
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',schedule,true);
window.addEventListener('avoid:home-history-ready',schedule);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
