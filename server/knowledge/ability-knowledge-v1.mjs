import { createHash } from 'node:crypto';
import { buildBundledKnowledge } from './game-knowledge-v1.mjs';
import { officialEncounterMembershipForAbilityV1 } from './official-encounter-knowledge-v1.mjs';
import { loadLatestOfficialEncounterGraphByWclIdV1 } from './official-encounter-store-v1.mjs';
import { fetchLorrgsBossSpells,fetchLorrgsSpell } from './providers/lorrgs-client-v1.mjs';
import { fetchParseWowheadSpell,parseWowheadConfigured } from './providers/parse-wowhead-client-v1.mjs';
import { fetchWclStaticAbilityKnowledge } from './providers/wcl-static-metadata-v1.mjs';

export const ABILITY_KNOWLEDGE_VERSION='provider-aware-ability-knowledge-v1';
export const ABILITY_KNOWLEDGE_MAX_IDS=20;

const uniqIds=value=>[...new Set((Array.isArray(value)?value:[value]).map(Number).filter(id=>Number.isInteger(id)&&id>0))].slice(0,ABILITY_KNOWLEDGE_MAX_IDS);
const bool=value=>value===true||value===1||String(value).toLowerCase()==='true'||String(value)==='1';

export function normalizeAbilityKnowledgeRequest(input={}){
  const abilityIds=uniqIds(input.abilityIds??input.abilityId);
  if(!abilityIds.length)throw new Error('At least one valid abilityId is required');
  const encounterId=Number(input.encounterId);
  const providers=input.providers||{};
  return {
    abilityIds,
    encounterId:Number.isInteger(encounterId)&&encounterId>0?encounterId:null,
    bossSlug:String(input.bossSlug||'').trim()||null,
    providers:{
      lorrgs:providers.lorrgs===undefined?true:bool(providers.lorrgs),
      parseWowhead:providers.parseWowhead===undefined?false:bool(providers.parseWowhead),
      wcl:providers.wcl===undefined?false:bool(providers.wcl),
    },
  };
}

export function buildAbilityKnowledgePreviewV1(input={}){
  const request=normalizeAbilityKnowledgeRequest(input);
  const canonical=JSON.stringify(request);
  const fingerprint=createHash('sha1').update(`${ABILITY_KNOWLEDGE_VERSION}|${canonical}`).digest('hex');
  const n=request.abilityIds.length;
  return {
    version:'provider-aware-ability-knowledge-preview-v1',fingerprint,request,
    networkUpperBound:{
      lorrgsCalls:request.providers.lorrgs?(request.bossSlug?1+n:n):0,
      parseWowheadCalls:request.providers.parseWowhead?n:0,
      parseWowheadCredits:request.providers.parseWowhead?n:0,
      wclCalls:request.providers.wcl?1:0,
      wclPointEstimate:null,
    },
    storedKnowledge:{officialBlizzardJournalLookup:request.encounterId?'attempted-at-resolve-with-0-provider-calls':'not-addressable-without-encounterId'},
    safety:{
      wclRequiresExplicitApproval:request.providers.wcl,
      parseCreditsRequireExplicitApproval:request.providers.parseWowhead,
      lorrgsReadOnly:true,
      officialJournalStoredLookupNetworkCalls:0,
      promotionAutomatic:false,
      combatTruth:'Warcraft Logs observed combat remains canonical; provider metadata is enrichment only.',
    },
  };
}

function internalKnowledgeFor(ids,encounterId){
  const wanted=new Set(ids);
  const snapshot=buildBundledKnowledge();
  const byId=new Map();
  for(const entity of snapshot.entities||[]){
    const id=Number(entity?.id);
    if(!wanted.has(id))continue;
    if(!['boss-ability','aura','player-ability'].includes(entity?.type))continue;
    const arr=byId.get(id)||[];
    arr.push(entity);byId.set(id,arr);
  }
  return new Map([...byId].map(([id,rows])=>[id,{
    rows,
    encounterMatch:Boolean(encounterId&&rows.some(row=>Number(row.encounterId)===Number(encounterId))),
    encounterIds:[...new Set(rows.map(row=>Number(row.encounterId)).filter(Number.isFinite))],
    names:[...new Set(rows.map(row=>row.name).filter(Boolean))],
  }]));
}

const providerName=row=>String(row?.name||'').trim()||null;
const lorrgsName=row=>String(row?.name||'').trim()||null;

function aggregateAbility(id,{internal,officialGraph,officialMembership,lorrgs,lorrgsBossMember,lorrgsBossCatalogResolved,parse,wcl,encounterId,bossSlug}){
  const names=[
    ['wcl',providerName(wcl)],
    ['blizzard-journal',officialMembership?.name||null],
    ['lorrgs',lorrgsName(lorrgs)],
    ['parse-wowhead',providerName(parse)],
    ['raidops-rule-pack',internal?.names?.[0]||null],
  ].filter(([,name])=>name);
  const uniqueNames=[...new Set(names.map(([,name])=>name.toLowerCase()))];
  const encounterSupport=[];
  if(officialMembership?.officialEncounterAssociation)encounterSupport.push({provider:'blizzard-journal',reason:'ability is published by Blizzard under the official Encounter Journal hierarchy for this encounter/build',memberships:officialMembership.memberships});
  if(internal?.encounterMatch)encounterSupport.push({provider:'raidops-rule-pack',reason:'ability is already associated with this encounter by an active internal rule pack'});
  if(lorrgsBossMember)encounterSupport.push({provider:'lorrgs',reason:`ability is explicitly tracked by Lorrgs for boss ${bossSlug} as a curated timeline/analysis marker`});
  const association=encounterSupport.length?'supported':(bossSlug&&lorrgsBossCatalogResolved?'not-listed-by-lorrgs':'unknown');
  const semanticClass=officialMembership?.officialEncounterAssociation?'official-encounter-ability':association==='supported'?'boss-ability-candidate':'unclassified';
  const confidence=officialMembership?.officialEncounterAssociation?'high':encounterSupport.length>=2?'high':encounterSupport.length===1?'medium':'low';
  const catalogSemantics='curated-boss-timeline-markers-not-exhaustive';
  const lorrgsSignal=lorrgs
    ?{status:'resolved',name:lorrgs.name||null,icon:lorrgs.icon||null,spellType:lorrgs.spell_type||null,tags:lorrgs.tags||[],bossMember:Boolean(lorrgsBossMember),bossCatalogResolved:Boolean(lorrgsBossCatalogResolved),catalogSemantics,role:'secondary-boss-timeline-marker-discovery'}
    :lorrgsBossCatalogResolved
      ?{status:'not-listed-by-boss-catalog',bossMember:false,bossCatalogResolved:true,catalogSemantics,role:'secondary-boss-timeline-marker-discovery'}
      :{status:'not-requested-or-unresolved',bossCatalogResolved:false,catalogSemantics};
  const officialSignal=officialGraph
    ?officialMembership
      ?{status:'resolved',journalEncounterId:officialGraph.encounter?.journalEncounterId||null,namespace:officialGraph.source?.namespace||null,graphFingerprint:officialGraph.fingerprint||null,name:officialMembership.name||null,memberships:officialMembership.memberships,role:'official-published-encounter-membership',negativeEvidence:false}
      :{status:'not-listed-in-journal',journalEncounterId:officialGraph.encounter?.journalEncounterId||null,namespace:officialGraph.source?.namespace||null,graphFingerprint:officialGraph.fingerprint||null,role:'official-published-encounter-membership',negativeEvidence:false}
    :{status:'not-cached-or-unavailable',role:'official-published-encounter-membership',negativeEvidence:false};
  const structuralUse=officialMembership?.officialEncounterAssociation
    ?'Blizzard publishes this ID under the official Encounter Journal hierarchy for the selected encounter/build; this establishes official semantic membership but not occurrence or causality in a pull.'
    :lorrgsBossMember
      ?'Lorrgs explicitly tracks this ID as a boss timeline/analysis marker, supporting encounter relevance.'
      :internal?.encounterMatch
        ?'An active versioned AvoiD rule pack associates this ID with the encounter; observed combat meaning still requires WCL evidence.'
        :association==='not-listed-by-lorrgs'
          ?'Lorrgs resolved the boss tracking catalogue but does not track this ID there; this is weak negative evidence only because the catalogue is curated and non-exhaustive.'
          :'provider metadata does not yet establish encounter relevance';
  return {
    abilityId:id,
    identity:{name:names[0]?.[1]||null,icon:wcl?.icon||lorrgs?.icon||null,wowheadUrl:parse?.url||`https://www.wowhead.com/spell=${id}`},
    semanticClass,
    encounterAssociation:{status:association,encounterId:encounterId||null,bossSlug:bossSlug||null,support:encounterSupport},
    providerSignals:{
      blizzardJournal:officialSignal,
      wcl:wcl?{status:'resolved',id:wcl.id,name:wcl.name||null,icon:wcl.icon||null,role:'official-static-identity'}:{status:'not-requested-or-unresolved'},
      lorrgs:lorrgsSignal,
      parseWowhead:parse?{status:'resolved',name:parse.name||null,url:parse.url||null,role:'reference-identity-fallback'}:{status:'not-requested-or-unresolved'},
      internal:internal?{status:'resolved',encounterIds:internal.encounterIds,names:internal.names,role:'versioned-product-semantics'}:{status:'unresolved'},
    },
    disagreements:uniqueNames.length>1?[{kind:'name-mismatch',providers:names.map(([provider,name])=>({provider,name}))}]:[],
    confidence,
    interpretation:{
      structuralUse,
      canonicalCombatEvidence:false,
      officialEncounterMembership:Boolean(officialMembership?.officialEncounterAssociation),
      promotionEligible:false,
      automaticPromotion:false,
    },
  };
}

export async function resolveAbilityKnowledgeV1(input={},options={}){
  const request=normalizeAbilityKnowledgeRequest(input);
  const preview=buildAbilityKnowledgePreviewV1(request);
  const fetcher=options.fetcher||fetch;
  const internal=internalKnowledgeFor(request.abilityIds,request.encounterId);
  const lorrgsRows=new Map();
  const lorrgsBossMembers=new Set();
  let lorrgsBossCatalogResolved=false;
  const parseRows=new Map();
  const wclRows=new Map();
  const errors=[];
  const hasInjectedOfficialGraph=Object.prototype.hasOwnProperty.call(options,'officialGraph');
  let officialGraph=hasInjectedOfficialGraph?options.officialGraph:null;
  if(officialGraph?.encounter?.wclEncounterId&&request.encounterId&&Number(officialGraph.encounter.wclEncounterId)!==Number(request.encounterId))throw new Error('Injected official encounter graph does not match requested WCL encounterId');
  const usage={officialJournalReadsAttempted:request.encounterId&&!hasInjectedOfficialGraph?1:0,officialJournalCacheHit:Boolean(officialGraph),officialJournalInjected:hasInjectedOfficialGraph,lorrgsCallsAttempted:0,lorrgsCallsSucceeded:0,lorrgsBossCatalogResolved:false,parseCallsAttempted:0,parseCallsSucceeded:0,parseCreditUpperBound:0,wclCallsAttempted:0,wclCallsSucceeded:0,wclRateLimit:null};

  if(request.encounterId&&!hasInjectedOfficialGraph){
    try{officialGraph=await loadLatestOfficialEncounterGraphByWclIdV1(request.encounterId);usage.officialJournalCacheHit=Boolean(officialGraph);}
    catch(error){errors.push({provider:'blizzard-journal',scope:`stored-wcl-encounter:${request.encounterId}`,error:error instanceof Error?error.message:String(error),negativeEvidence:false});}
  }

  if(request.providers.lorrgs){
    let boss=null;
    if(request.bossSlug){
      usage.lorrgsCallsAttempted++;
      try{boss=await fetchLorrgsBossSpells(request.bossSlug,{fetcher,baseUrl:options.lorrgsBaseUrl});usage.lorrgsCallsSucceeded++;lorrgsBossCatalogResolved=true;usage.lorrgsBossCatalogResolved=true;}
      catch(error){errors.push({provider:'lorrgs',scope:'boss-spells',error:error instanceof Error?error.message:String(error)});}
      for(const id of request.abilityIds){if(boss?.spells?.has(id)){lorrgsBossMembers.add(id);lorrgsRows.set(id,boss.spells.get(id));}}
    }
    for(const id of request.abilityIds){
      if(lorrgsRows.has(id))continue;
      usage.lorrgsCallsAttempted++;
      try{const row=await fetchLorrgsSpell(id,{fetcher,baseUrl:options.lorrgsBaseUrl});usage.lorrgsCallsSucceeded++;if(row.spell)lorrgsRows.set(id,row.spell);}
      catch(error){errors.push({provider:'lorrgs',scope:`spell:${id}`,error:error instanceof Error?error.message:String(error)});}
    }
  }

  if(request.providers.parseWowhead){
    for(const id of request.abilityIds){
      usage.parseCallsAttempted++;
      try{
        const row=await fetchParseWowheadSpell(id,{fetcher,apiKey:options.parseApiKey??process.env.PARSE_API_KEY,baseUrl:options.parseBaseUrl});
        if(row.configured===false){errors.push({provider:'parse-wowhead',scope:`spell:${id}`,error:row.reason});break;}
        usage.parseCallsSucceeded++;usage.parseCreditUpperBound+=Number(row.creditUpperBound)||0;if(row.spell)parseRows.set(id,row.spell);
      }catch(error){errors.push({provider:'parse-wowhead',scope:`spell:${id}`,error:error instanceof Error?error.message:String(error)});}
    }
  }

  let wclEncounter=null;
  if(request.providers.wcl){
    usage.wclCallsAttempted++;
    try{
      const row=await fetchWclStaticAbilityKnowledge(request.abilityIds,{encounterId:request.encounterId,fetcher:options.wclFetcher});
      usage.wclCallsSucceeded++;usage.wclRateLimit=row.rateLimit||null;wclEncounter=row.encounter||null;
      for(const [id,value] of row.abilities)wclRows.set(id,value);
    }catch(error){errors.push({provider:'warcraftlogs',scope:'static-metadata',error:error instanceof Error?error.message:String(error)});}
  }

  const abilities=request.abilityIds.map(id=>aggregateAbility(id,{
    internal:internal.get(id)||null,
    officialGraph,
    officialMembership:officialGraph?officialEncounterMembershipForAbilityV1(officialGraph,id):null,
    lorrgs:lorrgsRows.get(id)||null,
    lorrgsBossMember:lorrgsBossMembers.has(id),
    lorrgsBossCatalogResolved,
    parse:parseRows.get(id)||null,
    wcl:wclRows.get(id)||null,
    encounterId:request.encounterId,
    bossSlug:request.bossSlug,
  }));
  return {
    version:ABILITY_KNOWLEDGE_VERSION,previewFingerprint:preview.fingerprint,request,
    providers:{
      blizzardJournal:{networkRequested:false,storedGraphAvailable:Boolean(officialGraph),journalEncounterId:officialGraph?.encounter?.journalEncounterId||null,namespace:officialGraph?.source?.namespace||null,graphFingerprint:officialGraph?.fingerprint||null,role:'official published encounter hierarchy/membership; stored lookup only in ability resolver'},
      lorrgs:{requested:request.providers.lorrgs,bossCatalogResolved:lorrgsBossCatalogResolved,catalogSemantics:'curated-boss-timeline-markers-not-exhaustive',role:'secondary curated boss timeline/analysis markers'},
      parseWowhead:{requested:request.providers.parseWowhead,configured:parseWowheadConfigured({PARSE_API_KEY:options.parseApiKey??process.env.PARSE_API_KEY}),role:'independent maintained Wowhead wrapper; identity/reference only'},
      wcl:{requested:request.providers.wcl,role:'official static identity/scope metadata'},
    },
    encounter:wclEncounter||{id:request.encounterId,name:officialGraph?.encounter?.name||null,journalID:officialGraph?.encounter?.journalEncounterId||null},abilities,usage,errors,
    evidenceContract:{combatTruth:'WCL observed combat events remain canonical',blizzardJournal:'official published encounter hierarchy/membership from persisted build-specific graph; does not prove pull occurrence or causality',providerMetadata:'enrichment/hypothesis support only',lorrgs:'secondary derived data; boss catalogue is a curated timeline/analysis marker set, so successful absence is weak negative evidence only',parseWowhead:'non-official wrapper over public Wowhead data',promotionAutomatic:false,deepContribution:{reports:0,pulls:0},directScoreDelta:0},
  };
}
