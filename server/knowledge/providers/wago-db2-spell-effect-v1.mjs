export const WAGO_DB2_SPELL_EFFECT_PROVIDER_VERSION='wago-db2-spell-effect-client-v1';
export const WAGO_DB2_BASE_URL='https://wago.tools/db2';
export const WAGO_DB2_MAX_SEEDS=12;
export const WAGO_DB2_MAX_RESPONSE_BYTES=2_000_000;
export const WAGO_DB2_MAX_ROWS=5000;

const FILTER_FIELDS=new Set(['SpellID','EffectTriggerSpell']);
const positiveId=(value,label='id')=>{const n=Number(value);if(!Number.isInteger(n)||n<=0)throw new Error(`${label} must be a positive integer`);return n;};
const optionalNumber=value=>{const n=Number(value);return Number.isFinite(n)?n:null;};
const clean=value=>String(value??'').trim();

export function normalizeWagoBuildV1(value){
  const raw=clean(value);
  if(!raw)throw new Error('Wago DB2 build is required');
  const namespace=raw.match(/^static-(\d+)\.(\d+)\.(\d+)_(\d+)-[a-z0-9-]+$/i);
  if(namespace)return `${namespace[1]}.${namespace[2]}.${namespace[3]}.${namespace[4]}`;
  if(/^\d+\.\d+\.\d+\.\d+$/.test(raw))return raw;
  throw new Error(`Unsupported Wago/Blizzard build format: ${raw}`);
}

export function wagoBuildFromBlizzardNamespaceV1(namespace){
  return normalizeWagoBuildV1(namespace);
}

export function wagoDb2SpellEffectUrlV1({build,field='SpellID',value}={}){
  const normalizedBuild=normalizeWagoBuildV1(build);
  if(!FILTER_FIELDS.has(field))throw new Error(`Unsupported Wago SpellEffect filter field: ${field}`);
  const id=positiveId(value,field);
  const url=new URL(`${WAGO_DB2_BASE_URL}/SpellEffect/csv`);
  url.searchParams.set('build',normalizedBuild);
  url.searchParams.set(`filter[${field}]`,String(id));
  return url.toString();
}

function parseCsvRows(text){
  const rows=[];let row=[],field='',quoted=false;
  const pushField=()=>{row.push(field);field='';};
  const pushRow=()=>{pushField();rows.push(row);row=[];};
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){
      if(ch==='"'&&text[i+1]==='"'){field+='"';i++;continue;}
      if(ch==='"'){quoted=false;continue;}
      field+=ch;continue;
    }
    if(ch==='"'){quoted=true;continue;}
    if(ch===','){pushField();continue;}
    if(ch==='\n'){pushRow();continue;}
    if(ch==='\r')continue;
    field+=ch;
  }
  if(field.length||row.length)pushRow();
  return rows.filter(values=>values.some(value=>value!==''));
}

function parseCsvObjects(text){
  const rows=parseCsvRows(text);
  if(!rows.length)return{headers:[],rows:[]};
  const headers=rows[0].map(clean);
  const objects=rows.slice(1).map(values=>Object.fromEntries(headers.map((header,index)=>[header,values[index]??''])));
  return{headers,rows:objects};
}

function first(row,names){for(const name of names)if(Object.prototype.hasOwnProperty.call(row,name))return row[name];return null;}

export function normalizeWagoSpellEffectRowV1(row={}){
  const spellId=optionalNumber(first(row,['SpellID','SpellId']));
  const triggerSpellId=optionalNumber(first(row,['EffectTriggerSpell','TriggerSpell']));
  return{
    rowId:optionalNumber(first(row,['ID','Id'])),
    spellId:Number.isInteger(spellId)&&spellId>0?spellId:null,
    effectIndex:optionalNumber(first(row,['EffectIndex'])),
    effect:optionalNumber(first(row,['Effect'])),
    effectAura:optionalNumber(first(row,['EffectAura'])),
    effectAuraPeriod:optionalNumber(first(row,['EffectAuraPeriod'])),
    effectTriggerSpell:Number.isInteger(triggerSpellId)&&triggerSpellId>0?triggerSpellId:null,
    effectMiscValue0:optionalNumber(first(row,['EffectMiscValue_0','EffectMiscValue0'])),
    effectMiscValue1:optionalNumber(first(row,['EffectMiscValue_1','EffectMiscValue1'])),
    implicitTarget0:optionalNumber(first(row,['ImplicitTarget_0','ImplicitTarget0'])),
    implicitTarget1:optionalNumber(first(row,['ImplicitTarget_1','ImplicitTarget1'])),
  };
}

async function readBoundedText(response,{maxBytes=WAGO_DB2_MAX_RESPONSE_BYTES}={}){
  const declared=Number(response.headers?.get?.('content-length')||0);
  if(declared>maxBytes)throw new Error(`Wago DB2 response exceeds ${maxBytes} byte safety limit`);
  const text=await response.text();
  if(Buffer.byteLength(text,'utf8')>maxBytes)throw new Error(`Wago DB2 response exceeds ${maxBytes} byte safety limit`);
  return text;
}

export async function fetchWagoSpellEffectRowsV1({build,field='SpellID',value,fetcher=fetch,baseUrl=WAGO_DB2_BASE_URL,maxBytes=WAGO_DB2_MAX_RESPONSE_BYTES,maxRows=WAGO_DB2_MAX_ROWS}={}){
  const normalizedBuild=normalizeWagoBuildV1(build);
  if(!FILTER_FIELDS.has(field))throw new Error(`Unsupported Wago SpellEffect filter field: ${field}`);
  const id=positiveId(value,field);
  const url=new URL(`${String(baseUrl).replace(/\/$/,'')}/SpellEffect/csv`);
  url.searchParams.set('build',normalizedBuild);
  url.searchParams.set(`filter[${field}]`,String(id));
  let response;
  try{
    response=await fetcher(url.toString(),{method:'GET',headers:{accept:'text/csv,*/*;q=0.5','user-agent':'AvoiD-Raid-Ops-Iris/0.3.9 structural-metadata'}});
  }catch(error){throw new Error(`Wago DB2 network error: ${error instanceof Error?error.message:String(error)}`);}
  if(!response?.ok)throw new Error(`Wago DB2 HTTP ${response?.status||'unknown'} for SpellEffect ${field}=${id}`);
  const text=await readBoundedText(response,{maxBytes});
  const parsed=parseCsvObjects(text);
  if(!parsed.headers.includes('SpellID')||!parsed.headers.includes('EffectTriggerSpell'))throw new Error('Wago SpellEffect CSV schema is missing SpellID or EffectTriggerSpell');
  if(parsed.rows.length>maxRows)throw new Error(`Wago DB2 response exceeds ${maxRows} row safety limit`);
  const normalized=parsed.rows.map(normalizeWagoSpellEffectRowV1).filter(row=>row.spellId);
  const matched=normalized.filter(row=>field==='SpellID'?row.spellId===id:row.effectTriggerSpell===id);
  return{
    version:WAGO_DB2_SPELL_EFFECT_PROVIDER_VERSION,
    provider:'wago-db2',
    table:'SpellEffect',
    build:normalizedBuild,
    endpoint:url.toString(),
    filter:{field,value:id},
    rows:matched,
    responseRows:normalized.length,
    matchedRows:matched.length,
    serverFilterVerified:normalized.every(row=>field==='SpellID'?row.spellId===id:row.effectTriggerSpell===id),
    rawCsvPersisted:false,
  };
}

export async function resolveWagoTriggerRelationsV1(seedAbilityIds,{build,directions='both',fetcher=fetch,baseUrl=WAGO_DB2_BASE_URL}={}){
  const seeds=[...new Set((seedAbilityIds||[]).map(Number).filter(id=>Number.isInteger(id)&&id>0))];
  if(!seeds.length)throw new Error('At least one seed ability ID is required for Wago structural resolution');
  if(seeds.length>WAGO_DB2_MAX_SEEDS)throw new Error(`Wago structural resolution supports at most ${WAGO_DB2_MAX_SEEDS} seed abilities per request`);
  const normalizedBuild=normalizeWagoBuildV1(build);
  const fields=directions==='outbound'?['SpellID']:directions==='inbound'?['EffectTriggerSpell']:directions==='both'?['SpellID','EffectTriggerSpell']:null;
  if(!fields)throw new Error(`Unsupported Wago relation direction: ${directions}`);
  const queries=[];const relations=[];const seen=new Set();
  for(const seed of seeds){
    for(const field of fields){
      const result=await fetchWagoSpellEffectRowsV1({build:normalizedBuild,field,value:seed,fetcher,baseUrl});
      queries.push({field,value:seed,endpoint:result.endpoint,matchedRows:result.matchedRows,serverFilterVerified:result.serverFilterVerified});
      for(const row of result.rows){
        const sourceAbilityId=row.spellId,targetAbilityId=row.effectTriggerSpell;
        if(!sourceAbilityId||!targetAbilityId||sourceAbilityId===targetAbilityId)continue;
        const key=`${sourceAbilityId}|${targetAbilityId}|${row.rowId??''}|${row.effectIndex??''}`;
        if(seen.has(key))continue;seen.add(key);
        relations.push({
          provider:'wago-db2',
          retrievalMode:'build-pinned-filtered-csv',
          providerBuild:normalizedBuild,
          providerTable:'SpellEffect',
          providerRowId:row.rowId,
          sourceUrl:result.endpoint,
          sourceAbilityId,
          targetAbilityId,
          relationKind:'trigger-spell',
          relationLabel:'SpellEffect.EffectTriggerSpell',
          structuralEvidence:{
            effectIndex:row.effectIndex,effect:row.effect,effectAura:row.effectAura,effectAuraPeriod:row.effectAuraPeriod,
            effectMiscValue0:row.effectMiscValue0,effectMiscValue1:row.effectMiscValue1,
            implicitTarget0:row.implicitTarget0,implicitTarget1:row.implicitTarget1,
          },
        });
      }
    }
  }
  relations.sort((a,b)=>a.sourceAbilityId-b.sourceAbilityId||a.targetAbilityId-b.targetAbilityId||Number(a.providerRowId||0)-Number(b.providerRowId||0));
  return{
    version:WAGO_DB2_SPELL_EFFECT_PROVIDER_VERSION,
    provider:'wago-db2',build:normalizedBuild,directions,
    seedAbilityIds:seeds,
    relations,
    usage:{networkCalls:queries.length,queries},
    evidenceContract:{clientDb2StructuralMetadata:true,officialBlizzardApi:false,observedCombat:false,causalCombatEvidence:false,rawCsvPersisted:false,automaticPromotion:false},
  };
}
