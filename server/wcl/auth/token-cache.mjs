const TOKEN_URL = "https://www.warcraftlogs.com/oauth/token";
const TOKEN_TIMEOUT_MS = Math.max(1_000, Number(process.env.WCL_OAUTH_TIMEOUT_MS) || 8_000);
let cache = globalThis.__AVOID_WCL_TOKEN_CACHE__ || { token: null, expiresAt: 0, pending: null };
if (!("pending" in cache)) cache.pending = null;
globalThis.__AVOID_WCL_TOKEN_CACHE__ = cache;

async function requestWclAccessToken() {
  const id = process.env.WCL_CLIENT_ID;
  const secret = process.env.WCL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Missing WCL_CLIENT_ID or WCL_CLIENT_SECRET in the runtime environment.");

  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: "grant_type=client_credentials",
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`WCL OAuth timeout after ${TOKEN_TIMEOUT_MS}ms`);
    throw new Error(`WCL OAuth network error: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  if (!response.ok) throw new Error(`WCL OAuth ${response.status}: ${text.slice(0, 800)}`);
  let payload;
  try { payload = JSON.parse(text); }
  catch { throw new Error(`WCL OAuth returned invalid JSON (${response.status}): ${text.slice(0, 800)}`); }
  if (!payload?.access_token) throw new Error("WCL OAuth response did not include an access token.");

  const now = Date.now();
  cache.token = payload.access_token;
  cache.expiresAt = now + Number(payload.expires_in || 3600) * 1000;
  return cache.token;
}

export async function getWclAccessToken() {
  const now = Date.now();
  if (cache.token && cache.expiresAt > now + 60_000) return cache.token;
  if (cache.pending) return cache.pending;

  cache.pending = requestWclAccessToken().finally(() => { cache.pending = null; });
  return cache.pending;
}
