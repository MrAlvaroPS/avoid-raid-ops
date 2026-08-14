import { useCallback, useEffect, useRef, useState } from "react";
import { raidOpsClient } from "../api/raidOpsClient.js";

/**
 * Source-owned data hook for the future Vite/React publish target.
 *
 * The current Netlify publish target remains the Golden Master + runtime adapter
 * until visual parity is proven. Keeping this hook functional means the repo can
 * migrate feature-by-feature without recreating the WCL data layer.
 */
export function useRaidOpsData({ report, guild, encounter, pollMs = 15000 } = {}) {
  const [state, setState] = useState({
    loading: true,
    refreshing: false,
    error: null,
    report: null,
    telemetry: null,
    history: null,
    intelligence: null,
    status: null,
    updatedAt: null,
  });
  const mounted = useRef(true);

  const load = useCallback(async ({ refresh = false } = {}) => {
    if (mounted.current) setState(prev => ({ ...prev, loading: !prev.report, refreshing: refresh, error: null }));
    const args = { report, guild, encounter };
    const [core, telemetry, history, intelligence, status] = await Promise.allSettled([
      raidOpsClient.report(args),
      raidOpsClient.telemetry(args),
      raidOpsClient.history(args),
      raidOpsClient.intelligence(args),
      raidOpsClient.status(args),
    ]);
    if (!mounted.current) return;
    if (core.status === "rejected" || telemetry.status === "rejected") {
      const reason = core.status === "rejected" ? core.reason : telemetry.reason;
      setState(prev => ({ ...prev, loading: false, refreshing: false, error: reason?.message || String(reason) }));
      return;
    }
    setState({
      loading: false,
      refreshing: false,
      error: null,
      report: core.value,
      telemetry: telemetry.value,
      history: history.status === "fulfilled" ? history.value : null,
      intelligence: intelligence.status === "fulfilled" ? intelligence.value : null,
      status: status.status === "fulfilled" ? status.value : null,
      updatedAt: Date.now(),
    });
  }, [report, guild, encounter]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => { mounted.current = false; };
  }, [load]);

  useEffect(() => {
    if (!pollMs || pollMs < 5000) return undefined;
    const id = window.setInterval(() => load({ refresh: true }), pollMs);
    return () => window.clearInterval(id);
  }, [load, pollMs]);

  return { ...state, refresh: () => load({ refresh: true }) };
}
