export const RELIABILITY_EVIDENCE_SCHEMA_VERSION=1;

export const RELIABILITY_EVIDENCE_CONTRACTS=Object.freeze({
  mechanic:Object.freeze({
    kind:'mechanic',
    required:Object.freeze(['actorId','fightId','mechanicKey','occurrenceKey','assigned','observable','sourceComplete','severity','confidence']),
    scoringRequirements:Object.freeze({assigned:true,observable:true,sourceComplete:true}),
    identity:'canonicalPullKey + actorIdentity + mechanicKey + occurrenceKey',
    producer:'encounter mechanics/model layer'
  }),
  survival:Object.freeze({
    kind:'survival',
    required:Object.freeze(['actorId','fightId','sourceComplete']),
    scoringRequirements:Object.freeze({sourceComplete:true}),
    identity:'canonicalPullKey + actorIdentity + survival',
    producer:'complete meaningful-death population with shared wipe-cutoff semantics'
  }),
  defensive:Object.freeze({
    kind:'defensive',
    required:Object.freeze(['actorId','fightId','opportunityKey','availability','sourceComplete','confidence']),
    scoringRequirements:Object.freeze({availability:'confirmed',sourceComplete:true,outcomeObservable:true}),
    identity:'canonicalPullKey + actorIdentity + defensive ability + danger window',
    producer:'versioned class/spec defensive availability engine'
  }),
  duty:Object.freeze({
    kind:'duty',
    required:Object.freeze(['actorId','fightId','opportunityKey','dutyKey','assigned','observable','sourceComplete','confidence']),
    scoringRequirements:Object.freeze({assigned:true,observable:true,sourceComplete:true}),
    identity:'canonicalPullKey + actorIdentity + dutyKey + occurrence',
    producer:'raid-plan/encounter duty ownership engine'
  })
});

const has=(obj,key)=>obj!=null&&Object.prototype.hasOwnProperty.call(obj,key);

export function validateEvidenceCandidate(kind,row){
  const contract=RELIABILITY_EVIDENCE_CONTRACTS[kind];
  if(!contract)return{ok:false,kind,errors:[`unknown Reliability evidence kind: ${kind}`]};
  const errors=[];
  for(const key of contract.required)if(!has(row,key)||row[key]===null||row[key]===undefined)errors.push(`missing ${key}`);
  if(kind==='mechanic'){
    if(row.assigned!==true)errors.push('player assignment not proven');
    if(row.observable!==true)errors.push('outcome not observable');
    if(row.sourceComplete!==true)errors.push('source completeness not proven');
  }
  if(kind==='survival'&&row.sourceComplete!==true)errors.push('meaningful-death source completeness not proven');
  if(kind==='defensive'){
    if(String(row.availability||'').toLowerCase()!=='confirmed')errors.push('defensive availability not confirmed');
    if(row.sourceComplete!==true)errors.push('source completeness not proven');
    const observable=typeof row.usedOnTime==='boolean'||(typeof row.used==='boolean'&&typeof row.late==='boolean');
    if(!observable)errors.push('defensive outcome not observable');
  }
  if(kind==='duty'){
    if(row.assigned!==true)errors.push('duty assignment not proven');
    if(row.observable!==true)errors.push('duty outcome not observable');
    if(row.sourceComplete!==true)errors.push('source completeness not proven');
  }
  return{ok:errors.length===0,kind,errors};
}

export function reliabilityEvidenceKey(kind,row,{canonicalPullKey=null,actorIdentity=null}={}){
  const actor=actorIdentity||row?.actorIdentity||row?.actorId||'unknown-actor';
  const pull=canonicalPullKey||row?.canonicalPullKey||row?.fightId||'unknown-pull';
  if(kind==='mechanic')return`${pull}:${actor}:mechanic:${row?.mechanicKey||'unknown'}:${row?.occurrenceKey||'unknown'}`;
  if(kind==='survival')return`${pull}:${actor}:survival`;
  if(kind==='defensive')return`${pull}:${actor}:defensive:${row?.abilityId||row?.abilityKey||'unknown'}:${row?.opportunityKey||'unknown'}`;
  if(kind==='duty')return`${pull}:${actor}:duty:${row?.dutyKey||'unknown'}:${row?.opportunityKey||'unknown'}`;
  return`${pull}:${actor}:${kind||'unknown'}`;
}
