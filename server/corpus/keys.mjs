export function corpusId({encounterId,difficulty=5,partition=0}){
  const e=Number(encounterId),d=Number(difficulty),p=Number(partition||0);
  if(!Number.isFinite(e)||e<=0)throw new Error('encounterId is required');
  if(!Number.isFinite(d)||d<=0)throw new Error('difficulty is required');
  return `${e}/d${d}/p${p}`;
}
export const jobKey=args=>`jobs/${corpusId(args)}.json`;
export const aggregateKey=args=>`aggregates/${corpusId(args)}.json`;
export const modelKey=args=>`models/${corpusId(args)}.json`;
export const profileKey=(args,code)=>`profiles/${corpusId(args)}/${String(code)}.json`;
export const deepProfileKey=(args,code)=>`deep/${corpusId(args)}/${String(code)}.json`;
export const corpusAliasKey=({encounterId,difficulty=5})=>`aliases/${Number(encounterId)}/d${Number(difficulty)}.json`;
