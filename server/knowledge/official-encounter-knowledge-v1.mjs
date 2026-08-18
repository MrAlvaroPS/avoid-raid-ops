import { createHash } from 'node:crypto';
import { blizzardGameDataConfigured,getBlizzardAccessTokenV1,searchBlizzardJournalEncounterV1,fetchBlizzardJournalEncounterV1,blizzardLocalizationV1 } from './providers/blizzard-game-data-v1.mjs';

export const OFFICIAL_ENCOUNTER_KNOWLEDGE_VERSION='official-encounter-knowledge-v1';
export const OFFICIAL_ENCOUNTER_GRAPH_SCHEMA='official-encounter-semantic-graph-v1';

const {localized,cleanRegion,cleanLocale}=blizzardLocalizationV1;
const finiteId=value=>{const n=Number(value);return Number.isInteger(n)&&n>0?n:null;};
const compact=value=>value==null?null:String(value).trim()||null;
const sha1=value=>createHash('sha1').update(String(value)).digest('hex');

export function normalizeOfficialEncounterKnowledgeRequest(input={}){
  const request={
    encounterName:compact(input.encounterName||input.name),
    journalEncounterId:finiteId(input.journalEncounterId),
    wclEncounterId:finiteId(input.wclEncounterId||input.encounterId),
    region:cleanRegion(input.region),
    locale:cleanLocale(input.locale),
  };
  if(!request.encounterName&&!request.journalEncounterId)throw new Error('encounterName or journalEncounterId is required');
  return request;
}

export function buildOfficialEncounterKnowledgePreviewV1(input={}){
  const request=normalizeOfficialEncounterKnowledgeRequest(input);
  const fingerprint=sha1(`${OFFICIAL_ENCOUNTER_KNOWLEDGE_VERSION}|${JSON.stringify(request)}`);
  return {
    version:'official-encounter-knowledge-preview-v1',
    fingerprint,
    request,
    networkUpperBound:{
      oauthCalls:1,
      blizzardGameDataCalls:request.journalEncounterId?1:2,
      wclCalls:0,
      thirdPartyCalls:0,
    },
    safety:{
      readOnly:true,
      combatTruth:'Warcraft Logs observed combat remains canonical empirical truth.',
      officialMetadata:'Blizzard Encounter Journal supplies official published encounter structure and semantics, not observed pull events.',
      causalInference:false,
      canonicalDeepContribution:{reports:0,pulls:0},
      directScoreDelta:0,
      automaticPromotion:false,
    },
  };
}

function structuralRole(section,depth){
  if(depth===0&&section?.creature_display)return 'stage';
  if(depth===0)return 'overview-or-root-section';
  if(section?.spell)return depth===1?'mechanic':'submechanic';
  return 'mechanic-group';
}

function localizedName(value,locale){return compact(localized(value,locale));}

function normalizeModes(journal,locale){
  return (journal?.modes||[]).map(row=>({type:compact(row?.type),name:localizedName(row?.name,locale)})).filter(row=>row.type||row.name);
}
function normalizeCreatures(journal,locale){
  return (journal?.creatures||[]).map(row=>({id:finiteId(row?.id),name:localizedName(row?.name,locale),displayId:finiteId(row?.creature_display?.id)})).filter(row=>row.id||row.name);
}

export function compileOfficialEncounterGraphV1({journal,locale='en_US',sourceEndpoint=null,namespace=null,wclEncounterId=null}={}){
  if(!journal||typeof journal!=='object')throw new Error('Blizzard journal payload is required');
  const journalEncounterId=finiteId(journal.id);
  if(!journalEncounterId)throw new Error('Blizzard journal encounter id is required');
  const encounterName=localizedName(journal.name,locale)||`Journal Encounter ${journalEncounterId}`;
  const encounterNodeId=`blizzard:journal-encounter:${journalEncounterId}`;
  const nodes=[{
    id:encounterNodeId,
    type:'encounter',
    journalEncounterId,
    wclEncounterId:finiteId(wclEncounterId),
    name:encounterName,
    category:compact(journal?.category?.type),
    instanceId:finiteId(journal?.instance?.id),
    instanceName:localizedName(journal?.instance?.name,locale),
  }];
  const edges=[];
  const spellNodes=new Map();
  const spellIndex=new Map();
  const sections=[];

  function walk(sectionList,parentSectionId=null,path=[],depth=0){
    for(const section of Array.isArray(sectionList)?sectionList:[]){
      const sectionId=finiteId(section?.id);
      if(!sectionId)continue;
      const title=localizedName(section?.title,locale);
      const bodyText=localizedName(section?.body_text,locale);
      const role=structuralRole(section,depth);
      const nodeId=`blizzard:journal-section:${sectionId}`;
      const spellId=finiteId(section?.spell?.id);
      const spellName=localizedName(section?.spell?.name,locale);
      const currentPath=[...path,{sectionId,title,role}];
      const sectionNode={
        id:nodeId,type:'journal-section',sectionId,title,bodyText,depth,structuralRole:role,
        creatureDisplayId:finiteId(section?.creature_display?.id),spellId,spellName,
      };
      nodes.push(sectionNode);
      sections.push({...sectionNode,path:currentPath.map(item=>item.title).filter(Boolean)});
      edges.push({from:parentSectionId?`blizzard:journal-section:${parentSectionId}`:encounterNodeId,to:nodeId,relation:'contains-section',provenance:'blizzard-journal'});

      if(spellId){
        const spellNodeId=`spell:${spellId}`;
        if(!spellNodes.has(spellId)){
          const spellNode={id:spellNodeId,type:'spell',abilityId:spellId,name:spellName||null};
          spellNodes.set(spellId,spellNode);
          nodes.push(spellNode);
        }else if(!spellNodes.get(spellId).name&&spellName){
          spellNodes.get(spellId).name=spellName;
        }
        edges.push({from:nodeId,to:spellNodeId,relation:'official-spell-membership',provenance:'blizzard-journal'});
        const membership={sectionId,title,structuralRole:role,path:currentPath.map(item=>item.title).filter(Boolean),sectionPath:currentPath.map(item=>({sectionId:item.sectionId,title:item.title,structuralRole:item.role}))};
        const current=spellIndex.get(spellId)||{abilityId:spellId,name:spellName||null,officialEncounterAssociation:true,memberships:[]};
        if(!current.name&&spellName)current.name=spellName;
        current.memberships.push(membership);
        spellIndex.set(spellId,current);
      }
      walk(section?.sections,sectionId,currentPath,depth+1);
    }
  }

  walk(journal.sections||[]);
  nodes.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  edges.sort((a,b)=>`${a.from}|${a.relation}|${a.to}`.localeCompare(`${b.from}|${b.relation}|${b.to}`));
  const abilities=[...spellIndex.values()].sort((a,b)=>a.abilityId-b.abilityId);
  const fingerprint=sha1(`${OFFICIAL_ENCOUNTER_GRAPH_SCHEMA}|${JSON.stringify({journalEncounterId,wclEncounterId:finiteId(wclEncounterId),namespace,nodes,edges})}`);
  return {
    version:OFFICIAL_ENCOUNTER_KNOWLEDGE_VERSION,
    schema:OFFICIAL_ENCOUNTER_GRAPH_SCHEMA,
    fingerprint,
    source:{provider:'blizzard-game-data',kind:'official-encounter-journal',endpoint:sourceEndpoint,namespace:compact(namespace),locale,authority:'official-published-game-metadata'},
    encounter:{
      journalEncounterId,wclEncounterId:finiteId(wclEncounterId),name:encounterName,
      instanceId:finiteId(journal?.instance?.id),instanceName:localizedName(journal?.instance?.name,locale),
      category:compact(journal?.category?.type),modes:normalizeModes(journal,locale),creatures:normalizeCreatures(journal,locale),
    },
    graph:{nodes,edges,sectionCount:sections.length,spellCount:abilities.length,officialMembershipEdges:edges.filter(edge=>edge.relation==='official-spell-membership').length,maxDepth:sections.reduce((max,row)=>Math.max(max,Number(row.depth)||0),0)},
    sections,
    abilities,
    evidenceContract:{
      combatTruth:'Warcraft Logs observed combat events remain canonical empirical truth.',
      officialEncounterSemantics:'Blizzard Encounter Journal is authoritative for the published encounter hierarchy, names, descriptions and spell membership it exposes for this build.',
      hierarchySemantics:'Journal parent/child placement is official structural metadata; it does not by itself prove event-to-event causality or timing in a pull.',
      observedOccurrence:false,
      causalCombatEvidence:false,
      canonicalDeepContribution:{reports:0,pulls:0},
      directScoreDelta:0,
      automaticPromotion:false,
    },
  };
}

export function officialEncounterMembershipForAbilityV1(graph,abilityId){
  const id=finiteId(abilityId);
  if(!id)return null;
  return graph?.abilities?.find(row=>Number(row.abilityId)===id)||null;
}

export async function resolveOfficialEncounterKnowledgeV1(input={},options={}){
  const request=normalizeOfficialEncounterKnowledgeRequest(input);
  const preview=buildOfficialEncounterKnowledgePreviewV1(request);
  if(!blizzardGameDataConfigured({BLIZZARD_CLIENT_ID:options.clientId??process.env.BLIZZARD_CLIENT_ID,BLIZZARD_CLIENT_SECRET:options.clientSecret??process.env.BLIZZARD_CLIENT_SECRET}))throw new Error('Blizzard Game Data provider is not configured');
  const token=await getBlizzardAccessTokenV1({fetcher:options.fetcher||fetch,clientId:options.clientId??process.env.BLIZZARD_CLIENT_ID,clientSecret:options.clientSecret??process.env.BLIZZARD_CLIENT_SECRET,now:options.now});
  let journalEncounterId=request.journalEncounterId,href=null,search=null,dataCalls=0;
  if(!journalEncounterId){
    search=await searchBlizzardJournalEncounterV1(request.encounterName,{fetcher:options.fetcher||fetch,accessToken:token.accessToken,region:request.region,locale:request.locale});
    dataCalls++;
    if(!search.match){
      const names=search.candidates.slice(0,5).map(row=>`${row.id}:${row.name}`).join(', ');
      throw new Error(`Blizzard Journal encounter search did not resolve an unambiguous match${names?`; candidates: ${names}`:''}`);
    }
    journalEncounterId=search.match.id;
    href=search.match.href;
  }
  const fetched=await fetchBlizzardJournalEncounterV1(journalEncounterId,{fetcher:options.fetcher||fetch,accessToken:token.accessToken,region:request.region,locale:request.locale,href});
  dataCalls++;
  const graph=compileOfficialEncounterGraphV1({journal:fetched.journal,locale:request.locale,sourceEndpoint:fetched.endpoint,namespace:fetched.namespace,wclEncounterId:request.wclEncounterId});
  return {
    ...graph,
    previewFingerprint:preview.fingerprint,
    requested:request,
    resolved:{journalEncounterId,matchedBy:request.journalEncounterId?'journal-id':'encounter-name',searchCandidates:search?.candidates?.map(row=>({id:row.id,name:row.name,instanceId:row.instanceId,instanceName:row.instanceName,href:row.href}))||[]},
    usage:{oauthCalls:token.oauthCalls,tokenCacheHit:token.cacheHit,blizzardGameDataCalls:dataCalls,wclCalls:0,thirdPartyCalls:0},
  };
}
