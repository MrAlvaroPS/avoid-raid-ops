import { unwrap, num } from "./primitives.mjs";

export function tableEntries(table) {
  const x = unwrap(table);
  return Array.isArray(x.entries) ? x.entries : [];
}

export function auraEntries(table) {
  const x = unwrap(table);
  return Array.isArray(x.auras) ? x.auras : [];
}

export function indexEntriesByActor(table) {
  const map = new Map();
  for (const row of tableEntries(table)) {
    if (row?.id != null) map.set(`id:${row.id}`, row);
    if (row?.name) map.set(`name:${String(row.name).toLowerCase()}`, row);
  }
  return map;
}

export function matchActor(index, actor) {
  if (!index || !actor) return null;
  return index.get(`id:${actor.actorId ?? actor.id}`) || index.get(`name:${String(actor.name || '').toLowerCase()}`) || null;
}

export function normalizeRole(role) {
  const r=String(role||'').toLowerCase();
  if (r.includes('tank')) return 'TANK';
  if (r.includes('heal')) return 'HEAL';
  if (r.includes('dps') || r.includes('damage')) return 'DPS';
  return null;
}

export function compositionIndex(summaryTable) {
  const x=unwrap(summaryTable); const map=new Map();
  for (const p of (Array.isArray(x.composition)?x.composition:[])) {
    const specInfo=Array.isArray(p.specs)&&p.specs.length?p.specs[0]:{};
    const normalized={
      id:num(p.id), name:p.name||'Unknown', className:p.type||'Unknown',
      spec:specInfo.spec||null, role:normalizeRole(specInfo.role)
    };
    if (p.id!=null) map.set(`id:${p.id}`,normalized);
    if (p.name) map.set(`name:${String(p.name).toLowerCase()}`,normalized);
  }
  return map;
}

export function abilityBreakdown(table) {
  const out=new Map();
  for (const actor of tableEntries(table)) {
    for (const ability of (Array.isArray(actor?.abilities)?actor.abilities:[])) {
      const id=num(ability.guid ?? ability.abilityGameID ?? ability.id);
      const name=ability.name || ability.ability?.name || (id!=null?`Ability ${id}`:'Unknown');
      const key=String(id ?? name);
      const prev=out.get(key)||{id,name,icon:ability.icon||ability.abilityIcon||null,total:0,count:0};
      prev.total += Number(ability.total ?? ability.amount ?? 0)||0;
      prev.count += Number(ability.count ?? ability.uses ?? 0)||0;
      out.set(key,prev);
    }
  }
  return [...out.values()].filter(x=>x.name&&x.name!=='Unknown');
}

export function healingOverhealPct(table, friendlyIds=[]) {
  const rows=tableEntries(table); const ids=new Set((friendlyIds||[]).map(Number));
  const selected=rows.filter(r=>ids.has(Number(r.id))); const use=selected.length?selected:rows;
  let effective=0,overheal=0;
  for(const r of use){effective+=Number(r.total)||0;overheal+=Number(r.overheal)||0;}
  const raw=effective+overheal; return raw>0?100*overheal/raw:null;
}

export function consumableUses(castsTable, healingTable) {
  const out=new Map();
  const get=name=>{const k=String(name||'').toLowerCase(); if(!out.has(k))out.set(k,{healthstone:0,potion:0}); return out.get(k)};
  for(const row of [...tableEntries(castsTable),...tableEntries(healingTable)]){
    const bucket=get(row.name);
    for(const a of (Array.isArray(row.abilities)?row.abilities:[])){
      const n=String(a.name||'').toLowerCase(); const c=Number(a.count??a.uses??0)||0; const use=c||(Number(a.total)>0?1:0);
      if(n.includes('healthstone')) bucket.healthstone+=use;
      if(n.includes('healing potion')||n.includes('health potion')||n.includes('poción de sanación')||n.includes('poción de salud')) bucket.potion+=use;
    }
  }
  return Object.fromEntries(out);
}

export function safeShape(value) {
  const x=unwrap(value);
  return {type:Array.isArray(value)?'array':typeof value,keys:x&&typeof x==='object'&&!Array.isArray(x)?Object.keys(x).slice(0,30):[],entryCount:tableEntries(value).length,auraCount:auraEntries(value).length};
}
