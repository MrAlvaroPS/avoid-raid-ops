import { median } from "../../wcl/normalization/primitives.mjs";
export function detectBreakthrough(fights) {
 if((fights||[]).length<7)return null; const values=fights.map(f=>Number(f.fightPercentage)); if(values.some(v=>!Number.isFinite(v)))return null;
 const rolling=[]; for(let i=2;i<values.length-2;i++)rolling.push({index:i,value:median(values.slice(i-2,i+3))});
 for(let i=1;i<rolling.length;i++){const improvement=rolling[i-1].value-rolling[i].value;if(improvement<10)continue;const future=values.slice(rolling[i].index+1,rolling[i].index+6);if(future.length<3)continue;const threshold=rolling[i-1].value-improvement*.60;const maintained=future.filter(v=>v<=threshold).length;if(maintained>=3)return{pullNumber:rolling[i].index+1,improvementPctPoints:Number(improvement.toFixed(1)),maintained,sample:future.length};}
 return null;
}
