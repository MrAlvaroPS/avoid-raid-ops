const json = async (url) => {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const payload = await response.json();
  if (!response.ok || payload?.ok === false) throw new Error(payload?.error || `HTTP ${response.status}`);
  return payload;
};

const postJson = async (url, body) => {
  const response = await fetch(url, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok || payload?.ok === false) throw new Error(payload?.error || `HTTP ${response.status}`);
  return payload;
};

export const raidOpsClient = {
  report: ({ report, guild, encounter } = {}) => json(`/api/wcl/report?${new URLSearchParams(Object.fromEntries(Object.entries({ report, guild, encounter }).filter(([,v]) => v != null)))}`),
  telemetry: ({ report, encounter } = {}) => json(`/api/wcl/telemetry?${new URLSearchParams(Object.fromEntries(Object.entries({ report, encounter }).filter(([,v]) => v != null)))}`),
  history: ({ report, guild, encounter } = {}) => json(`/api/wcl/history?${new URLSearchParams(Object.fromEntries(Object.entries({ report, guild, encounter }).filter(([,v]) => v != null)))}`),
  intelligence: ({ report, encounter } = {}) => json(`/api/wcl/intelligence?${new URLSearchParams(Object.fromEntries(Object.entries({ report, encounter }).filter(([,v]) => v != null)))}`),
  status: ({ report, encounter } = {}) => json(`/api/wcl/status?${new URLSearchParams(Object.fromEntries(Object.entries({ report, encounter }).filter(([,v]) => v != null)))}`),
  corpusStatus: ({ encounter, difficulty = 5, partition = 0 } = {}) => json(`/api/wcl/corpus?${new URLSearchParams({ encounter, difficulty, partition })}`),
  corpusAction: (body = {}) => postJson(`/api/wcl/corpus`, body),
};
