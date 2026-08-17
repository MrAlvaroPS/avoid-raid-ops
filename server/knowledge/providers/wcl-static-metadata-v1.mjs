import { wclGraphql } from '../../wcl/client/graphql-client.mjs';
import { buildWclAbilityKnowledgeQuery,normalizeWclAbilityKnowledge } from '../../wcl/queries/ability-knowledge.mjs';

export const WCL_STATIC_METADATA_PROVIDER_VERSION='wcl-static-metadata-provider-v1';

export async function fetchWclStaticAbilityKnowledge(abilityIds,{encounterId=null,fetcher=wclGraphql}={}){
  const query=buildWclAbilityKnowledgeQuery(abilityIds,{encounterId});
  const data=await fetcher(query,{});
  return normalizeWclAbilityKnowledge(data,abilityIds,{encounterId});
}
