import { wclGraphql } from '../client/graphql-client.mjs';

const positiveIds=values=>[...new Set((values||[]).map(Number).filter(n=>Number.isInteger(n)&&n>0))];

/**
 * WCL exposes ReportFight.talentImportCode(actorID), which is the canonical
 * Blizzard loadout string for Retail characters. We generate aliases so the
 * whole roster can be fetched in one GraphQL request instead of one request
 * per raider.
 */
export async function fetchTalentImportCodes({reportCode,fightId,actorIds=[]}){
  const ids=positiveIds(actorIds);
  if(!ids.length||!Number.isInteger(Number(fightId)))return new Map();

  const fields=ids.map(id=>`a${id}: talentImportCode(actorID:${id})`).join('\n');
  const query=`
    query AvoidTalentImportCodes($code:String!,$fight:[Int]){
      reportData{
        report(code:$code,allowUnlisted:true){
          fights(fightIDs:$fight){
            id
            ${fields}
          }
        }
      }
    }`;
  const data=await wclGraphql(query,{code:reportCode,fight:[Number(fightId)]});
  const fight=data?.reportData?.report?.fights?.[0];
  const out=new Map();
  if(!fight)return out;
  for(const id of ids){
    const code=typeof fight[`a${id}`]==='string'&&fight[`a${id}`].trim()?fight[`a${id}`].trim():null;
    if(code)out.set(id,code);
  }
  return out;
}
