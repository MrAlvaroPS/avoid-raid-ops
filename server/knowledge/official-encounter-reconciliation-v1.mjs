import { officialEncounterMembershipForAbilityV1 } from './official-encounter-knowledge-v1.mjs';

export const OFFICIAL_ENCOUNTER_RECONCILIATION_VERSION='official-encounter-reconciliation-v1';

const positiveId=value=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};

function roleNode(membership,role){
  return (membership?.sectionPath||[]).find(row=>row?.structuralRole===role)||null;
}

function normalizeMembership(membership){
  const stage=roleNode(membership,'stage');
  const mechanic=roleNode(membership,'mechanic');
  return {
    sectionId:positiveId(membership?.sectionId),
    title:membership?.title||null,
    structuralRole:membership?.structuralRole||null,
    path:Array.isArray(membership?.path)?membership.path:[],
    stage:stage?{sectionId:positiveId(stage.sectionId),title:stage.title||null}:null,
    mechanic:mechanic?{sectionId:positiveId(mechanic.sectionId),title:mechanic.title||null}:null,
  };
}

function pairRelation(left,right){
  const a=normalizeMembership(left),b=normalizeMembership(right);
  const sameSection=Boolean(a.sectionId&&b.sectionId&&a.sectionId===b.sectionId);
  const sameMechanic=Boolean(a.mechanic?.sectionId&&b.mechanic?.sectionId&&a.mechanic.sectionId===b.mechanic.sectionId);
  const sameStage=Boolean(a.stage?.sectionId&&b.stage?.sectionId&&a.stage.sectionId===b.stage.sectionId);
  let relation='official-relationship-unresolved';
  let rank=0;
  if(sameSection){relation='same-official-section';rank=4;}
  else if(sameMechanic){relation='same-official-mechanic-branch';rank=3;}
  else if(sameStage){relation='same-stage-different-official-branch';rank=2;}
  else if(a.stage?.sectionId&&b.stage?.sectionId){relation='different-official-stage';rank=1;}
  return {relation,rank,left:a,right:b};
}

export function reconcileOfficialEncounterAbilitiesV1(graph,leftAbilityId,rightAbilityId){
  const leftId=positiveId(leftAbilityId),rightId=positiveId(rightAbilityId);
  if(!leftId||!rightId)throw new Error('two positive ability IDs are required');
  const left=officialEncounterMembershipForAbilityV1(graph,leftId);
  const right=officialEncounterMembershipForAbilityV1(graph,rightId);
  if(!left||!right){
    return {
      version:OFFICIAL_ENCOUNTER_RECONCILIATION_VERSION,
      status:'official-membership-unresolved',
      leftAbilityId:leftId,
      rightAbilityId:rightId,
      leftOfficial:Boolean(left),
      rightOfficial:Boolean(right),
      bestRelation:null,
      pairs:[],
      evidenceContract:{officialSemantics:true,observedOccurrence:false,causalCombatEvidence:false,negativeEvidence:false,promotionEligible:false,automaticPromotion:false},
    };
  }
  const pairs=[];
  for(const leftMembership of left.memberships||[])for(const rightMembership of right.memberships||[])pairs.push(pairRelation(leftMembership,rightMembership));
  pairs.sort((a,b)=>b.rank-a.rank||String(a.left.path.join(' > ')).localeCompare(String(b.left.path.join(' > '))));
  const best=pairs[0]||null;
  return {
    version:OFFICIAL_ENCOUNTER_RECONCILIATION_VERSION,
    status:best?.relation||'official-relationship-unresolved',
    leftAbilityId:leftId,
    rightAbilityId:rightId,
    leftName:left.name||null,
    rightName:right.name||null,
    leftOfficial:true,
    rightOfficial:true,
    bestRelation:best?{relation:best.relation,left:best.left,right:best.right}:null,
    pairs:pairs.map(({rank,...row})=>row),
    evidenceContract:{officialSemantics:true,observedOccurrence:false,causalCombatEvidence:false,negativeEvidence:false,promotionEligible:false,automaticPromotion:false},
  };
}
