export type RaidSessionAnalysis = {
  sessionId: string;
  reportCodes: string[];
  sourceReports: number;
  startTime: number;
  endTime: number;
  pulls: number;
  kills: number;
  bestFightPercentage: number | null;
  medianFightPercentage: number | null;
  rosterSizeMedian: number | null;
  deduplicatedPulls: number;
};
