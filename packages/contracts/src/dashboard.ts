import type { Metric } from "./metric";

export type DashboardContract = {
  guild: unknown;
  report: unknown;
  encounter: unknown;
  bestPull: Metric<unknown>;
  phaseConversion: Metric<Record<string, number>>;
  raidDps: Metric<number | null>;
  raidHps: Metric<number | null>;
  killReadiness: Metric<number | null>;
  currentBlocker: Metric<unknown>;
  wipeSignatures: Metric<unknown[]>;
};
