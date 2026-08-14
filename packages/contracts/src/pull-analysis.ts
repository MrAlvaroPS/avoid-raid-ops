import type { Metric } from "./metric";

export type PullAnalysis = {
  reportCode: string;
  fightId: number;
  encounterId: number;
  startedAt: number;
  durationMs: number;
  kill: boolean;
  fightPercentage: number | null;
  bossRemainingPct: number | null;
  phases: unknown[];
  raid: unknown;
  players: unknown[];
  mechanics: unknown[];
  deaths: unknown[];
  cooldowns: unknown[];
  rootCause: Metric<unknown>;
  executionScore: Metric<number | null>;
  generatedAt: number;
  engineVersion: string;
};
