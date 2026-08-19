const DEFAULT_TIMEOUT_MS = 45000;
const RETRY_DELAY_MS = 500;

export class RaidOpsApiError extends Error {
  constructor(message, { status = 0, code = "REQUEST_FAILED", service = "unknown", retryable = false, cause = null } = {}) {
    super(message, { cause });
    this.name = "RaidOpsApiError";
    this.status = status;
    this.code = code;
    this.service = service;
    this.retryable = retryable;
  }
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const params = values => new URLSearchParams(Object.fromEntries(Object.entries(values).filter(([, value]) => value != null && value !== "")));
const serviceName = url => { try { return new URL(url, location.origin).pathname; } catch { return String(url); } };
function activity(message, state = "busy", detail = {}) { if (typeof window === "undefined") return; window.dispatchEvent(new CustomEvent("avoid:activity", { detail: { at: Date.now(), message, state, ...detail } })); }
async function parsePayload(response) { const text = await response.text(); if (!text) return {}; try { return JSON.parse(text); } catch { throw new RaidOpsApiError("Service returned invalid JSON", { status: response.status, code: "INVALID_JSON", service: serviceName(response.url) }); } }
async function requestJson(url, { method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS, retries = method === "GET" ? 1 : 0 } = {}) {
  const service = serviceName(url); let attempt = 0;
  while (true) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(new DOMException(`Request timed out after ${timeoutMs}ms`, "TimeoutError")), timeoutMs); activity(`${method} ${service}`, "busy", { service, attempt });
    try {
      const response = await fetch(url, { method, signal: controller.signal, headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const payload = await parsePayload(response);
      if (!response.ok || payload?.ok === false) { const retryable = response.status >= 500 || response.status === 429; throw new RaidOpsApiError(payload?.error || `HTTP ${response.status}`, { status: response.status, code: payload?.code || `HTTP_${response.status}`, service, retryable }); }
      activity(`${service} ready`, "ready", { service, status: response.status }); return payload;
    } catch (error) {
      const timeout = controller.signal.aborted; const normalized = error instanceof RaidOpsApiError ? error : new RaidOpsApiError(timeout ? `Request timed out after ${timeoutMs}ms` : (error?.message || String(error)), { code: timeout ? "TIMEOUT" : "NETWORK_ERROR", service, retryable: true, cause: error });
      if (attempt < retries && normalized.retryable) { attempt += 1; activity(`${service} retry ${attempt}/${retries}`, "busy", { service, code: normalized.code }); await wait(RETRY_DELAY_MS * attempt); continue; }
      activity(`${service} failed · ${normalized.message}`, "error", { service, code: normalized.code, status: normalized.status }); throw normalized;
    } finally { clearTimeout(timer); }
  }
}
const get = (url, timeoutMs) => requestJson(url, { timeoutMs });
const post = (url, body, timeoutMs = 30000) => requestJson(url, { method: "POST", body, timeoutMs, retries: 0 });

export const raidOpsClient = {
  report: ({ report, guild, encounter } = {}) => get(`/api/wcl/report?${params({ report, guild, encounter })}`, 45000),
  telemetry: ({ report, encounter } = {}) => get(`/api/wcl/telemetry?${params({ report, encounter })}`, 60000),
  history: ({ report, guild, encounter } = {}) => get(`/api/wcl/history?${params({ report, guild, encounter })}`, 60000),
  intelligence: ({ report, encounter } = {}) => get(`/api/wcl/intelligence?${params({ report, encounter })}`, 60000),
  status: ({ report, encounter } = {}) => get(`/api/wcl/status?${params({ report, encounter })}`, 15000),
  reports: ({ report, guild, days = 120, force = false } = {}) => get(`/api/wcl/reports?${params({ report, guild, days, force: force ? 1 : undefined })}`, 30000),
  corpusStatus: ({ encounter, difficulty = 5, partition = 0 } = {}) => get(`/api/wcl/corpus?${params({ encounter, difficulty, partition })}`, 30000),
  corpusAction: (body = {}) => post(`/api/wcl/corpus`, body, 30000),
  raidCatalog: ({ refresh = false, official = true } = {}) => get(`/api/knowledge/raid-catalog?${params({ refresh: refresh ? 1 : undefined, official: official ? 1 : 0 })}`, 60000),
  mechanicKnowledge: ({ encounter, difficulty = 5, partition = 0 } = {}) => get(`/api/wcl/mechanic-knowledge?${params({ encounter, difficulty, partition: partition || undefined })}`, 30000),
  knowledge: () => get(`/api/knowledge`, 15000),
  refreshKnowledge: ({ patch = "unknown", season = "unknown", build = "manual" } = {}) => post(`/api/knowledge`, { action: "refresh", patch, season, build }, 30000),
  activateKnowledge: () => post(`/api/knowledge`, { action: "activate" }, 30000),
};
