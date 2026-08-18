// Minimal report metadata used to classify semantic-evidence actor provenance.
// No combat events are fetched here. Actor ids are transient and must never be
// persisted into GLOBAL BOSS knowledge; callers persist only aggregated role labels.
export const SEMANTIC_ACTOR_PROVENANCE_QUERY = `
query AvoidSemanticActorProvenance($code:String!){
 rateLimitData{limitPerHour pointsSpentThisHour pointsResetIn}
 reportData{report(code:$code,allowUnlisted:false){
  masterData(translate:false){
   actors{id type subType petOwner}
  }
 }}
}`;
