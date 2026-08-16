import { RELIABILITY_POLICY } from './reliability-policy-v1.mjs';

const median=values=>{
  const a=(values||[]).map(Number).filter(Number.isFinite).sort((x,y)=>x-y);
  if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;
};

const same=(a,b)=>String(a??'').toLowerCase()===String(b??'').toLowerCase();
const sameNumberOrNull=(a,b)=>a==null||b==null?true:Number(a)===Number(b);

function sameReliabilityContext(a,b,policy){
  if(!policy.peerSelection.requireSameEncounterContext)return true;
  const ac=a?.context||{},bc=b?.context||{};
  return sameNumberOrNull(ac.encounterId,bc.encounterId)
    && sameNumberOrNull(ac.difficulty,bc.difficulty)
    && sameNumberOrNull(ac.partition,bc.partition);
}

const componentValue=(profile,dimension)=>{
  const value=profile?.components?.[dimension]?.value;
  return Number.isFinite(Number(value))?Number(value):null;
};

function result(source,peers,dimension){
  const values=peers.map(p=>componentValue(p,dimension)).filter(Number.isFinite);
  return{source,value:median(values),peerCount:values.length,peerKeys:peers.map(p=>p.identity?.key).filter(Boolean)};
}

export function selectPeerBaseline(profiles,player,dimension,{policy=RELIABILITY_POLICY}={}){
  const cfg=policy.peerSelection,identity=player.identity||{};
  const scopedEligible=predicate=>(profiles||[]).filter(p=>
    p.identity?.key!==player.identity?.key
    && sameReliabilityContext(p,player,policy)
    && predicate(p)
    && componentValue(p,dimension)!=null
  );

  const specRole=scopedEligible(p=>same(p.identity?.spec,identity.spec)&&same(p.identity?.role,identity.role));
  if(specRole.length>=cfg.sameSpecRoleMinPeers)return result('same-spec-role',specRole,dimension);

  const classRole=scopedEligible(p=>same(p.identity?.className,identity.className)&&same(p.identity?.role,identity.role));
  if(classRole.length>=cfg.sameClassRoleMinPeers)return result('same-class-role',classRole,dimension);

  const role=scopedEligible(p=>same(p.identity?.role,identity.role));
  if(role.length>=cfg.sameRoleMinPeers)return result('same-role',role,dimension);

  const roster=scopedEligible(()=>true);
  if(roster.length>=cfg.rosterMinPeers)return result('roster',roster,dimension);

  return{
    source:'policy-reference',
    value:Number(policy.priors.scoringSuccessRate[dimension])*100,
    peerCount:0,
    peerKeys:[]
  };
}

export function peerBaselineQuality(baseline){
  if(!baseline)return 'unknown';
  if(baseline.source==='same-spec-role')return 'strong';
  if(baseline.source==='same-class-role')return 'good';
  if(baseline.source==='same-role')return 'contextual';
  if(baseline.source==='roster')return 'weak';
  return 'reference';
}
