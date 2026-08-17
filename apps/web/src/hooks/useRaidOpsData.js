import { useCallback, useEffect, useRef, useState } from "react";
import { raidOpsClient } from "../api/raidOpsClient.js";

const SERVICES = ["report", "telemetry", "history", "intelligence", "status"];
const idleServices = () => Object.fromEntries(SERVICES.map(name => [name, { state: "idle", error: null, updatedAt: null }]));
const messageOf = reason => reason?.message || String(reason || "Unknown service error");

/**
 * Source-owned data hook for the Vite/React migration target.
 *
 * Core report failure blocks a report-scoped screen. Supplemental services are
 * explicitly partial: one slow/failed History/Intelligence request must not
 * blank otherwise valid report data. Every service exposes its own state so UI
 * can show a small spinner/error instead of looking frozen.
 */
export function useRaidOpsData({ report, guild, encounter, pollMs = 15000 } = {}) {
  const [state, setState] = useState({
    loading: true,
    refreshing: false,
    error: null,
    warnings: [],
    services: idleServices(),
    report: null,
    telemetry: null,
    history: null,
    intelligence: null,
    status: null,
    updatedAt: null,
  });
  const mounted = useRef(true);
  const generation = useRef(0);

  const load = useCallback(async ({ refresh = false } = {}) => {
    const run = ++generation.current;
    if (mounted.current) setState(prev => ({
      ...prev,
      loading: !prev.report,
      refreshing: refresh,
      error: null,
      warnings: [],
      services: Object.fromEntries(SERVICES.map(name => [name, { ...prev.services?.[name], state: "loading", error: null }])),
    }));

    const args = { report, guild, encounter };
    const results = await Promise.allSettled([
      raidOpsClient.report(args),
      raidOpsClient.telemetry(args),
      raidOpsClient.history(args),
      raidOpsClient.intelligence(args),
      raidOpsClient.status(args),
    ]);
    if (!mounted.current || run !== generation.current) return;

    const keyed = Object.fromEntries(SERVICES.map((name, index) => [name, results[index]]));
    const now = Date.now();
    const services = Object.fromEntries(SERVICES.map(name => {
      const result = keyed[name];
      return [name, result.status === "fulfilled"
        ? { state: "ready", error: null, updatedAt: now }
        : { state: "error", error: messageOf(result.reason), updatedAt: now }];
    }));

    if (keyed.report.status === "rejected") {
      setState(prev => ({ ...prev, loading: false, refreshing: false, error: messageOf(keyed.report.reason), services }));
      return;
    }

    const warnings = SERVICES.filter(name => name !== "report" && keyed[name].status === "rejected")
      .map(name => ({ service: name, message: messageOf(keyed[name].reason) }));

    setState(prev => ({
      ...prev,
      loading: false,
      refreshing: false,
      error: null,
      warnings,
      services,
      report: keyed.report.value,
      telemetry: keyed.telemetry.status === "fulfilled" ? keyed.telemetry.value : prev.telemetry,
      history: keyed.history.status === "fulfilled" ? keyed.history.value : prev.history,
      intelligence: keyed.intelligence.status === "fulfilled" ? keyed.intelligence.value : prev.intelligence,
      status: keyed.status.status === "fulfilled" ? keyed.status.value : prev.status,
      updatedAt: now,
    }));
  }, [report, guild, encounter]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => { mounted.current = false; generation.current += 1; };
  }, [load]);

  useEffect(() => {
    if (!pollMs || pollMs < 5000) return undefined;
    const id = window.setInterval(() => load({ refresh: true }), pollMs);
    return () => window.clearInterval(id);
  }, [load, pollMs]);

  return { ...state, refresh: () => load({ refresh: true }) };
}
