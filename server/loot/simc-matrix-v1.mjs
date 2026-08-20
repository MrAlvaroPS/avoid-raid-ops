import { simulateLootForPlayerV1, LOOT_SIMC_SCENARIOS } from './simc-runner-v1.mjs';
import { classifyLootSimResultV1 } from './simc-result-policy-v1.mjs';

export const LOOT_SIMC_MATRIX_VERSION='loot-simc-matrix-v1';
const finite=value=>value!==null&&value!==undefined&&Number.isFinite(Number(value))?Number(value):null;
const confidenceRank={unknown:0,low:1,medium:2,high:3};
const weakestConfidence=(...values)=>values.filter(Boolean).sort((a,b)=>(confidenceRank[a]??0)-(confidenceRank[b]??0))[0]||'unknown';

function matrixRow(player,stRaw,mtRaw,itemLevel){
  const st=classifyLootSimResultV1(stRaw),mt=classifyLootSimResultV1(mtRaw),stGain=finite(st?.gainPct),mtGain=finite(mt?.gainPct),complete=stGain!=null&&mtGain!=null,mixGainPct=complete?(stGain+mtGain)/2:null;
  const currentSlot=(st?.currentSlot?.length?st.currentSlot:mt?.currentSlot)||[],currentGear=(st?.currentGear?.length?st.currentGear:mt?.currentGear)||[];
  return{
    version:LOOT_SIMC_MATRIX_VERSION,playerName:player.name,itemId:st?.itemId||mt?.itemId||null,itemLevel:finite(itemLevel),simulatedItemLevel:finite(itemLevel),
    status:complete?'simulated-matrix':'matrix-incomplete',gainPct:mixGainPct,mixGainPct,mixStatus:complete?'complete':'incomplete',mixWeight:{raid_st:0.5,raid_mt5:0.5},mixLabel:'MIX 50/50',
    st,mt,currentSlot,currentGear,profileSource:st?.profileSource||mt?.profileSource||null,importedSpecialization:st?.importedSpecialization||mt?.importedSpecialization||null,importedRole:st?.importedRole||mt?.importedRole||null,
    confidence:complete?weakestConfidence(st?.confidence,mt?.confidence):'unknown',
    reason:complete?'Equal-weight neutral raid index from clean Patchwerk 1T and clean Patchwerk 5T.':`Matrix incomplete: ST=${st?.status||'unknown'}, MT5=${mt?.status||'unknown'}. No mixed value is inferred.`,
  };
}

export async function simulateLootMatrixForPlayerV1({player,item,itemLevel=null,iterations=1000,timeoutMs=180000}={}){
  const st=await simulateLootForPlayerV1({player,item,itemLevel,iterations,scenario:'raid_st',timeoutMs});
  const mt=await simulateLootForPlayerV1({player,item,itemLevel,iterations,scenario:'raid_mt5',timeoutMs});
  return matrixRow(player,st,mt,itemLevel);
}

export async function simulateLootRaidMatrixV1({players=[],item,itemLevel=null,iterations=1000,concurrency=1}={}){
  const queue=[...(players||[])],results=[],workers=Math.max(1,Math.min(2,Number(concurrency)||1));
  await Promise.all(Array.from({length:workers},async()=>{while(queue.length){const player=queue.shift();if(!player)continue;results.push(await simulateLootMatrixForPlayerV1({player,item,itemLevel,iterations}));}}));
  results.sort((a,b)=>((b.mixGainPct==null?-Infinity:Number(b.mixGainPct))-(a.mixGainPct==null?-Infinity:Number(a.mixGainPct)))||((b.st?.gainPct==null?-Infinity:Number(b.st.gainPct))-(a.st?.gainPct==null?-Infinity:Number(a.st.gainPct)))||String(a.playerName).localeCompare(String(b.playerName)));
  return{
    version:LOOT_SIMC_MATRIX_VERSION,engine:'simulationcraft-official-cli',metric:'raid-mix-50-50',itemLevel:finite(itemLevel),simulatedItemLevel:finite(itemLevel),
    scenarios:{st:LOOT_SIMC_SCENARIOS.raid_st,mt:LOOT_SIMC_SCENARIOS.raid_mt5},mix:{label:'MIX 50/50',weights:{raid_st:0.5,raid_mt5:0.5},bossAware:false,meaning:'neutral allocation index, not a boss-specific prediction'},results,
  };
}
