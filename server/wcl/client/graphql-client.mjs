import { getWclAccessToken } from "../auth/token-cache.mjs";
const API_URL = "https://www.warcraftlogs.com/api/v2/client";
const GRAPHQL_TIMEOUT_MS = Math.max(2_000, Number(process.env.WCL_GRAPHQL_TIMEOUT_MS) || 25_000);

function operationName(query) {
  const source = String(query || "");
  return source.match(/\b(?:query|mutation)\s+([A-Za-z0-9_]+)/)?.[1] || "anonymous";
}
function retryAfterMs(response){
  const raw=response?.headers?.get?.('retry-after');if(!raw)return null;
  const seconds=Number(raw);if(Number.isFinite(seconds)&&seconds>=0)return Math.ceil(seconds*1000);
  const at=Date.parse(raw);return Number.isFinite(at)?Math.max(0,at-Date.now()):null;
}

export async function wclGraphql(query, variables = {}) {
  const operation = operationName(query);
  const token = await getWclAccessToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GRAPHQL_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`WCL GraphQL timeout (${operation}) after ${GRAPHQL_TIMEOUT_MS}ms`);
    throw new Error(`WCL GraphQL network error (${operation}): ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); }
  catch { throw new Error(`WCL returned non-JSON (${operation}, ${response.status}): ${text.slice(0,800)}`); }
  if (!response.ok || payload.errors) {
    const error=new Error(`WCL GraphQL ${response.status} (${operation}): ${JSON.stringify(payload.errors || payload).slice(0,2500)}`);
    error.status=Number(response.status)||null;
    error.operation=operation;
    error.retryAfterMs=retryAfterMs(response);
    throw error;
  }
  return payload.data;
}
