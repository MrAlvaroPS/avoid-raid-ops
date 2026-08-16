import { RELIABILITY_POLICY } from './reliability-policy-v1.mjs';

const median=values=>{
  const a=(values||[]).map(Number).filter(Number.isFinite).sort((x,y)=>x-y);
  if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;
};

const same=(a,b)=>String(a??'').toLowerCase()===String(b??'').toLowerCase();

function eligiblePeers(profiles,player,dimension,predicate){
  return (profiles||[]).filter(p=>p.identity?.key!==player.identity?.key&&predicate(p)&&Number.isFinite(Number(p.raw?.[dimension]?.successRate)));
}

function result(source,peers,dimension){
  const rates=peers.map(p=>Number(p.raw[dimension].successRate)).filter(Number.isFinite);
  return{source,successRate:median(rates),peerCount:rates.length,peerKeys:peers.map(p=>p.identity?.key).filter(Boolean)};
}

export function selectPeerBaseline(profiles,player,dimension,{policy=RELIABILITY_POLICY}={}){
  const cfg=policy.peerSelection,identity=player.identity||{};
  const specRole=eligiblePeers(profiles,player,dimension,p=>same(p.identity?.spec,identity.spec)&&same(p.identity?.role,identity.role));
  if(specRole.length>=cfg.sameSpecRoleMinPeers)return result('same-spec-role',specRole,dimension);

  const classRole=eligiblePeers(profiles,player,dimension,p=>same(p.identity?.className,identity.className)&&same(p.identity?.role,identity.role));
  if(classRole.length>=cfg.sameClassRoleMinPeers)return result('same-class-role',classRole,dimension);

  const role=eligiblePeers(profiles,player,dimension,p=>same(p.identity?.role,identity.role));
  if(role.length>=cfg.sameRoleMinPeers)return result('same-role',role,dimension);

  const roster=eligiblePeers(profiles,player,dimension,()=>true);
  if(roster.length>=cfg.rosterMinPeers)return result('roster',roster,dimension);

  return{
    source:'policy-fallback',
    successRate:Number(policy.priors.fallbackSuccessRate[dimension]),
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
  return 'fallback';
}
