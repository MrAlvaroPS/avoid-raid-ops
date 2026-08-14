import { wclGraphql } from '../client/graphql-client.mjs';

const chunk=(xs,n)=>Array.from({length:Math.ceil(xs.length/n)},(_,i)=>xs.slice(i*n,(i+1)*n));

export function buildPullSummaryQuery(fightIds){
  const aliases=fightIds.map(id=>`p${Number(id)}:table(dataType:Summary,fightIDs:[${Number(id)}])`).join('\n');
  return `query AvoidPullSummaryBatch($code:String!){reportData{report(code:$code,allowUnlisted:true){${aliases}}}}`;
}

// Keeping the batch deliberately small avoids recreating the query-complexity
// problem we already solved in History. One table per pull is enough for the
// pull delta engine and gets cached by Netlify/WCL layers upstream.
export async function fetchPullSummaryTables(reportCode,fightIds,{batchSize=5}={}){
  const ids=(fightIds||[]).map(Number).filter(Number.isFinite);
  const out=new Map();
  for(const batch of chunk(ids,Math.max(1,Math.min(8,Number(batchSize)||5)))){
    const data=await wclGraphql(buildPullSummaryQuery(batch),{code:reportCode});
    const report=data?.reportData?.report||{};
    for(const id of batch)out.set(id,report[`p${id}`]||null);
  }
  return out;
}
