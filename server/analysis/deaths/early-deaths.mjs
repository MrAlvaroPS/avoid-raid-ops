import { phaseStart } from "../../wcl/normalization/fights.mjs";
export function countEarlyDeaths(fights,deathsByFight,targetPhase=3){let count=0;for(const fight of fights){const deaths=deathsByFight?.[fight.id]||[];if(!deaths.length)continue;const target=phaseStart(fight,targetPhase);const first=deaths[0];if(target==null||Number(first.timestampReportMs)<target)count++;}return count;}
