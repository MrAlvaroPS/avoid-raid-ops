export type Confidence = "confirmed" | "high" | "medium" | "low" | "unknown";
export type MetricSource = "observed" | "derived" | "intelligence" | "manual";
export type MetricStatus = "confirmed" | "estimated" | "pending" | "not-applicable" | "unavailable";

export type EvidenceRef = {
  reportCode: string;
  fightId?: number;
  actorId?: number;
  abilityId?: number;
  timestampMs?: number;
  note?: string;
};

export type Metric<T> = {
  value: T | null;
  status: MetricStatus;
  source: MetricSource;
  confidence: Confidence;
  evidence: EvidenceRef[];
  algorithmVersion?: string;
  reason?: string;
};
