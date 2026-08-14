export type PullSignalStatus = 'improved' | 'regressed' | 'stable' | 'observed' | 'unavailable';

export type PullSignal = {
  key: string;
  label: string;
  status: PullSignalStatus;
  current: number | null;
  baseline: number | null;
  delta: number | null;
  unit: string;
  priority: number;
  evidence: string;
  confidence: 'high' | 'unknown';
};

export type PullFact = {
  fightId: number;
  pullNumber: number;
  kill: boolean;
  fightPercentage: number | null;
  bossPercentage: number | null;
  durationMs: number;
  stageCount: number;
  stages: unknown[];
  raidDps: number | null;
  raidHps: number | null;
  firstDeathMs: number | null;
  rawDeaths: number;
  meaningfulDeaths: number;
  rosterFingerprint: string;
  rosterSize: number;
};

export type PullIntelligence = {
  pulls: PullFact[];
  latest: PullFact | null;
  previous: PullFact | null;
  best: PullFact | null;
  currentVsPrevious: {
    currentPull: number;
    baselinePull: number;
    sameStage: boolean;
    rosterChanged: boolean;
    signals: PullSignal[];
    improvements: PullSignal[];
    regressions: PullSignal[];
    observations: PullSignal[];
  } | null;
  baselines: unknown;
  provenance: Record<string, string>;
  status: 'ready' | 'insufficient-data';
};
