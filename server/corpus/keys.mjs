const requiredPositive=(value,label)=>{const n=Number(value);if(!Number.isFinite(n)||n<=0)throw new Error(`${label} is required`);return n;};
export function corpusId({encounterId,difficulty,partition=0}){
  const e=requiredPositive(encounterId,'encounterId'),d=requiredPositive(difficulty,'difficulty'),p=Number(partition||0);
  return `${e}/d${d}/p${p}`;
}
export const jobKey=args=>`jobs/${corpusId(args)}.json`;
export const aggregateKey=args=>`aggregates/${corpusId(args)}.json`;
export const modelKey=args=>`models/${corpusId(args)}.json`;
export const profileKey=(args,code)=>`profiles/${corpusId(args)}/${String(code)}.json`;
export const deepProfileKey=(args,code)=>`deep/${corpusId(args)}/${String(code)}.json`;
export const corpusAliasKey=({encounterId,difficulty})=>`aliases/${requiredPositive(encounterId,'encounterId')}/d${requiredPositive(difficulty,'difficulty')}.json`;
