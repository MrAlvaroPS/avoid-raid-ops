export const DEFAULT_READINESS_WEIGHTS = Object.freeze({ progressionDepth:.25, repeatability:.20, throughputReadiness:.20, mechanicExecution:.20, survivalAndDefensives:.15 });
export function readinessBand(score){ if(score==null)return "unknown"; if(score<40)return "learning"; if(score<65)return "developing"; if(score<80)return "killable"; return "imminent"; }
