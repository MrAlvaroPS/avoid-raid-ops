import { createHash } from 'node:crypto';
import { buildBundledKnowledge } from './game-knowledge-v1.mjs';
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
    safety:{
      wclRequiresExplicitApproval:request.providers.wcl,
      parseCreditsRequireExplicitApproval:request.providers.parseWowhead,
      lorrgsReadOnly:true,
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

function aggregateAbility(id,{internal,lorrgs,lorrgsBossMember,parse,wcl,encounterId,bossSlug}){
  const names=[
    ['wcl',providerName(wcl)],['lorrgs',lorrgsName(lorrgs)],['parse-wowhead',providerName(parse)],
    ['raidops-rule-pack',internal?.names?.[0]||null],
  ].filter(([,name])=>name);
  const uniqueNames=[...new Set(names.map(([,name])=>name.toLowerCase()))];
  const encounterSupport=[];
  if(internal?.encounterMatch)encounterSupport.push({provider:'raidops-rule-pack',reason:'ability is already associated with this encounter by an active internal rule pack'});
  if(lorrgsBossMember)encounterSupport.push({provider:'lorrgs',reason:`ability is listed by Lorrgs under boss ${bossSlug}`});
  const association=encounterSupport.length?'supported':(bossSlug&&lorrgs?'not-listed-by-lorrgs':'unknown');
  const semanticClass=association==='supported'?'boss-ability-candidate':'unclassified';
  const confidence=encounterSupport.length>=2?'high':encounterSupport.length===1?'medium':'low';
  return {
    abilityId:id,
    identity:{name:names[0]?.[1]||null,icon:wcl?.icon||lorrgs?.icon||null,wowheadUrl:parse?.url||`https://www.wowhead.com/spell=${id}`},
    semanticClass,
    encounterAssociation:{status:association,encounterId:encounterId||null,bossSlug:bossSlug||null,support:encounterSupport},
    providerSignals:{
      wcl:wcl?{status:'resolved',id:wcl.id,name:wcl.name||null,icon:wcl.icon||null,role:'official-static-identity'}:{status:'not-requested-or-unresolved'},
      lorrgs:lorrgs?{status:'resolved',name:lorrgs.name||null,icon:lorrgs.icon||null,spellType:lorrgs.spell_type||null,tags:lorrgs.tags||[],bossMember:Boolean(lorrgsBossMember),role:'secondary-semantic-discovery'}:{status:'not-requested-or-unresolved'},
      parseWowhead:parse?{status:'resolved',name:parse.name||null,url:parse.url||null,role:'reference-identity-fallback'}:{status:'not-requested-or-unresolved'},
      internal:internal?{status:'resolved',encounterIds:internal.encounterIds,names:internal.names,role:'versioned-product-semantics'}:{status:'unresolved'},
    },
    disagreements:uniqueNames.length>1?[{kind:'name-mismatch',providers:names.map(([provider,name])=>({provider,name}))}]:[],
    confidence,
    interpretation:{
      structuralUse:association==='supported'?'provider metadata supports treating this ID as an encounter-mechanic candidate':'provider metadata does not yet establish encounter membership',
      canonicalCombatEvidence:false,
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
  const parseRows=new Map();
  const wclRows=new Map();
  const errors=[];
  const usage={lorrgsCallsAttempted:0,lorrgsCallsSucceeded:0,parseCallsAttempted:0,parseCallsSucceeded:0,parseCreditUpperBound:0,wclCallsAttempted:0,wclCallsSucceeded:0,wclRateLimit:null};

  if(request.providers.lorrgs){
    let boss=null;
    if(request.bossSlug){
      usage.lorrgsCallsAttempted++;
      try{boss=await fetchLorrgsBossSpells(request.bossSlug,{fetcher,baseUrl:options.lorrgsBaseUrl});usage.lorrgsCallsSucceeded++;}
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
    internal:internal.get(id)||null,lorrgs:lorrgsRows.get(id)||null,lorrgsBossMember:lorrgsBossMembers.has(id),parse:parseRows.get(id)||null,wcl:wclRows.get(id)||null,encounterId:request.encounterId,bossSlug:request.bossSlug,
  }));
  return {
    version:ABILITY_KNOWLEDGE_VERSION,previewFingerprint:preview.fingerprint,request,
    providers:{
      lorrgs:{requested:request.providers.lorrgs,role:'secondary semantic/discovery metadata'},
      parseWowhead:{requested:request.providers.parseWowhead,configured:parseWowheadConfigured({PARSE_API_KEY:options.parseApiKey??process.env.PARSE_API_KEY}),role:'independent maintained Wowhead wrapper; identity/reference only'},
      wcl:{requested:request.providers.wcl,role:'official static identity/scope metadata'},
    },
    encounter:wclEncounter||{id:request.encounterId,name:null,journalID:null},abilities,usage,errors,
    evidenceContract:{combatTruth:'WCL observed combat events remain canonical',providerMetadata:'enrichment/hypothesis support only',lorrgs:'secondary derived data',parseWowhead:'non-official wrapper over public Wowhead data',promotionAutomatic:false,deepContribution:{reports:0,pulls:0},directScoreDelta:0},
  };
}
