const TOKEN_URL = "https://www.warcraftlogs.com/oauth/token";
const API_URL = "https://www.warcraftlogs.com/api/v2/client";

let tokenCache = globalThis.__AVOID_WCL_TOKEN_CACHE__ || { token: null, expiresAt: 0 };
globalThis.__AVOID_WCL_TOKEN_CACHE__ = tokenCache;

export function json(status, body, cache = "no-store") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cache
    }
  });
}

export async function getToken() {
  const now = Date.now();
  if (tokenCache.token && tokenCache.expiresAt > now + 60_000) return tokenCache.token;

  const id = process.env.WCL_CLIENT_ID;
  const secret = process.env.WCL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Missing WCL_CLIENT_ID or WCL_CLIENT_SECRET in this Netlify site.");

  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json"
    },
    body: "grant_type=client_credentials"
  });

  const text = await r.text();
  if (!r.ok) throw new Error(`WCL OAuth ${r.status}: ${text.slice(0, 800)}`);

  const data = JSON.parse(text);
  tokenCache.token = data.access_token;
  tokenCache.expiresAt = now + Number(data.expires_in || 3600) * 1000;
  return tokenCache.token;
}

export async function gql(query, variables) {
  const token = await getToken();
  const r = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });

  const text = await r.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`WCL returned non-JSON (${r.status}): ${text.slice(0, 800)}`);
  }

  if (!r.ok || payload.errors) {
    throw new Error(`WCL GraphQL ${r.status}: ${JSON.stringify(payload.errors || payload).slice(0, 2500)}`);
  }
  return payload.data;
}

export const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function median(values) {
  const xs = (values || []).map(Number).filter(Number.isFinite).sort((a,b) => a-b);
  if (!xs.length) return null;
  const m = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[m] : (xs[m-1] + xs[m]) / 2;
}

export function durationMs(f) {
  return Math.max(0, Number(f?.endTime || 0) - Number(f?.startTime || 0));
}

export function maxPhase(f) {
  const ids = (f?.phaseTransitions || []).map(x => Number(x.id)).filter(Number.isFinite);
  const abs = Number(f?.lastPhaseAsAbsoluteIndex);
  if (Number.isFinite(abs)) ids.push(abs + 1);
  return ids.length ? Math.max(...ids) : 1;
}

export function phaseStart(f, phase) {
  if (phase <= 1) return Number(f?.startTime ?? 0);
  const p = (f?.phaseTransitions || []).find(x => Number(x.id) === Number(phase));
  return p ? Number(p.startTime) : null;
}

export function groupEncounter(fights, encounterId) {
  const valid = (fights || []).filter(f => Number(f.encounterID) > 0);
  if (encounterId) {
    const picked = valid.filter(f => Number(f.encounterID) === Number(encounterId));
    if (picked.length) return picked.sort((a,b) => Number(a.startTime)-Number(b.startTime));
  }
  const latest = valid.slice().sort((a,b) => Number(b.startTime)-Number(a.startTime))[0];
  return latest
    ? valid.filter(f => Number(f.encounterID) === Number(latest.encounterID))
      .sort((a,b) => Number(a.startTime)-Number(b.startTime))
    : [];
}

export function bestFight(fights) {
  return (fights || [])
    .filter(f => !f.inProgress && Number.isFinite(Number(f.fightPercentage)))
    .slice()
    .sort((a,b) => Number(a.fightPercentage)-Number(b.fightPercentage))[0] || null;
}

export function unwrap(v) {
  if (!v || typeof v !== "object") return {};
  if (v.data && typeof v.data === "object" && !Array.isArray(v.data)) return v.data;
  return v;
}

export function entries(v) {
  const x = unwrap(v);
  if (Array.isArray(x.entries)) return x.entries;
  if (Array.isArray(v)) return v;
  return [];
}

export function allArrays(value, out = []) {
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    out.push(value);
    for (const x of value) allArrays(x, out);
    return out;
  }
  for (const x of Object.values(value)) allArrays(x, out);
  return out;
}

export function findRows(value) {
  const candidates = allArrays(value, []);
  return candidates
    .filter(arr => arr.length && arr.every(x => x && typeof x === "object"))
    .sort((a,b) => b.length-a.length)[0] || [];
}

export function abilityKey(a) {
  return String(a?.guid ?? a?.abilityGameID ?? a?.id ?? a?.name ?? "unknown");
}

export function aggregateAbilities(table) {
  const result = new Map();

  function add(a, amount = 0, count = 0) {
    if (!a || typeof a !== "object") return;
    const key = abilityKey(a);
    const name = a.name || a.ability?.name || `Ability ${key}`;
    const guid = num(a.guid ?? a.abilityGameID ?? a.id ?? a.ability?.guid);
    const icon = a.icon || a.abilityIcon || a.ability?.icon || null;
    const row = result.get(key) || { key, guid, name, icon, total: 0, count: 0 };
    row.total += Number(amount) || 0;
    row.count += Number(count) || 0;
    result.set(key, row);
  }

  function walk(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }

    if (node.name && (
      node.guid != null || node.abilityGameID != null ||
      node.type === "ability" || node.total != null
    )) {
      add(node, node.total ?? node.amount ?? node.totalDamage ?? 0, node.count ?? node.uses ?? 0);
    }

    if (Array.isArray(node.abilities)) {
      for (const a of node.abilities) {
        add(a, a.total ?? a.amount ?? 0, a.count ?? a.uses ?? 0);
      }
    }

    for (const v of Object.values(node)) walk(v);
  }

  walk(table);
  return Array.from(result.values()).filter(x => x.name && x.name !== "Unknown");
}

export function playerRows(table) {
  const x = unwrap(table);
  const rows = Array.isArray(x.entries) ? x.entries : findRows(x);
  return rows.filter(r => r && typeof r === "object" && (r.name || r.id != null));
}

export function indexByActor(table) {
  const map = new Map();
  for (const r of playerRows(table)) {
    const keys = [
      r.id != null ? `id:${r.id}` : null,
      r.name ? `name:${String(r.name).toLowerCase()}` : null
    ].filter(Boolean);
    for (const k of keys) map.set(k, r);
  }
  return map;
}

export function matchActor(map, actor) {
  if (!map || !actor) return null;
  return map.get(`id:${actor.actorId ?? actor.id}`) ||
    map.get(`name:${String(actor.name || "").toLowerCase()}`) || null;
}

export function countTotal(table) {
  return playerRows(table).reduce((s,r) => s + (Number(r.total) || Number(r.count) || 0), 0);
}

export function safeShape(v) {
  const x = unwrap(v);
  return {
    type: Array.isArray(v) ? "array" : typeof v,
    keys: x && typeof x === "object" && !Array.isArray(x) ? Object.keys(x).slice(0,30) : [],
    entryCount: entries(v).length
  };
}
