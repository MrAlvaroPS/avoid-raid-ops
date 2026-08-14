const TOKEN_URL = "https://www.warcraftlogs.com/oauth/token";
let cache = globalThis.__AVOID_WCL_TOKEN_CACHE__ || { token: null, expiresAt: 0 };
globalThis.__AVOID_WCL_TOKEN_CACHE__ = cache;

export async function getWclAccessToken() {
  const now = Date.now();
  if (cache.token && cache.expiresAt > now + 60_000) return cache.token;
  const id = process.env.WCL_CLIENT_ID;
  const secret = process.env.WCL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Missing WCL_CLIENT_ID or WCL_CLIENT_SECRET in this Netlify site.");
  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: "grant_type=client_credentials",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`WCL OAuth ${response.status}: ${text.slice(0, 800)}`);
  const payload = JSON.parse(text);
  cache.token = payload.access_token;
  cache.expiresAt = now + Number(payload.expires_in || 3600) * 1000;
  return cache.token;
}
