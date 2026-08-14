import { phaseReached } from "../../wcl/normalization/fights.mjs";
export function phaseConversion(fights,maxPhase=3){const denominator=(fights||[]).length;const counts={};const percentages={};for(let p=1;p<=maxPhase;p++){counts[p]=fights.filter(f=>phaseReached(f,p)).length;percentages[p]=denominator?Math.round(100*counts[p]/denominator):0;}return{denominator,counts,percentages};}
