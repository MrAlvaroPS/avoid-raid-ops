import { getWclAccessToken } from "../auth/token-cache.mjs";
const API_URL = "https://www.warcraftlogs.com/api/v2/client";

export async function wclGraphql(query, variables = {}) {
  const token = await getWclAccessToken();
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); }
  catch { throw new Error(`WCL returned non-JSON (${response.status}): ${text.slice(0,800)}`); }
  if (!response.ok || payload.errors) throw new Error(`WCL GraphQL ${response.status}: ${JSON.stringify(payload.errors || payload).slice(0,2500)}`);
  return payload.data;
}
