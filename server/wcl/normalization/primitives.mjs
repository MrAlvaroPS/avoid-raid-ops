export const num = value => Number.isFinite(Number(value)) ? Number(value) : null;
export function median(values) {
  const xs=(values||[]).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!xs.length)return null; const m=Math.floor(xs.length/2); return xs.length%2?xs[m]:(xs[m-1]+xs[m])/2;
}
export const durationMs = fight => Math.max(0, Number(fight?.endTime||0)-Number(fight?.startTime||0));
export function unwrap(value) { return value?.data && typeof value.data === "object" && !Array.isArray(value.data) ? value.data : (value || {}); }
export function playerRows(table) {
  const x=unwrap(table); if(Array.isArray(x.entries))return x.entries;
  const candidates=[]; const walk=n=>{ if(!n||typeof n!=="object")return; if(Array.isArray(n)){if(n.length&&n.every(x=>x&&typeof x==="object"))candidates.push(n); n.forEach(walk);} else Object.values(n).forEach(walk); }; walk(x);
  return (candidates.sort((a,b)=>b.length-a.length)[0]||[]).filter(r=>r&&(r.name||r.id!=null));
}
