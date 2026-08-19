import { createHash } from 'node:crypto';
import { normalizeWagoBuildV1 } from './wago-db2-spell-effect-v1.mjs';

export const WAGO_DB2_JOURNAL_DIFFICULTY_PROVIDER_VERSION='wago-db2-journal-difficulty-v2';
export const WAGO_DB2_JOURNAL_DIFFICULTY_MAX_BYTES=3_000_000;
export const WAGO_DB2_JOURNAL_DIFFICULTY_MAX_ROWS=20_000;
const BASE_URL='https://wago.tools/db2';

const clean=value=>String(value??'').trim();
const optionalInt=value=>{const n=Number(value);return Number.isInteger(n)?n:null;};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
const sha1=value=>createHash('sha1').update(JSON.stringify(stable(value))).digest('hex');

function parseCsvRows(text){const rows=[];let row=[],field='',quoted=false;const pushField=()=>{row.push(field);field='';},pushRow=()=>{pushField();rows.push(row);row=[];};for(let i=0;i<text.length;i++){const ch=text[i];if(quoted){if(ch==='"'&&text[i+1]==='"'){field+='"';i++;continue;}if(ch==='"'){quoted=false;continue;}field+=ch;continue;}if(ch==='"'){quoted=true;continue;}if(ch===','){pushField();continue;}if(ch==='\n'){pushRow();continue;}if(ch==='\r')continue;field+=ch;}if(field.length||row.length)pushRow();return rows.filter(values=>values.some(value=>value!==''));}
function parseObjects(text){const rows=parseCsvRows(text);if(!rows.length)return{headers:[],rows:[]};const headers=rows[0].map(clean);return{headers,rows:rows.slice(1).map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]??''])))};}
function first(row,names){for(const name of names)if(Object.prototype.hasOwnProperty.call(row,name))return row[name];return null;}
async function fetchTable(table,{build,fetcher=fetch,baseUrl=BASE_URL,maxBytes=WAGO_DB2_JOURNAL_DIFFICULTY_MAX_BYTES,maxRows=WAGO_DB2_JOURNAL_DIFFICULTY_MAX_ROWS}={}){const normalizedBuild=normalizeWagoBuildV1(build),url=new URL(`${String(baseUrl).replace(/\/$/,'')}/${table}/csv`);url.searchParams.set('build',normalizedBuild);const response=await fetcher(url.toString(),{headers:{accept:'text/csv,*/*;q=0.5','user-agent':'AvoiD-Raid-Ops-Iris/0.3.9 journal-difficulty'}});if(!response?.ok)throw new Error(`Wago DB2 HTTP ${response?.status||'unknown'} for ${table}`);const declared=Number(response.headers?.get?.('content-length')||0);if(declared>maxBytes)throw new Error(`${table} exceeds ${maxBytes} byte safety limit`);const text=await response.text();if(Buffer.byteLength(text,'utf8')>maxBytes)throw new Error(`${table} exceeds ${maxBytes} byte safety limit`);const parsed=parseObjects(text);if(parsed.rows.length>maxRows)throw new Error(`${table} exceeds ${maxRows} row safety limit`);return{table,build:normalizedBuild,endpoint:url.toString(),headers:parsed.headers,rows:parsed.rows};}

export async function fetchWagoJournalDifficultySnapshotV1({build,fetcher=fetch,baseUrl=BASE_URL}={}){
  const normalizedBuild=normalizeWagoBuildV1(build);
  const [sections,encounters,difficulties]=await Promise.all([
    fetchTable('JournalSectionXDifficulty',{build:normalizedBuild,fetcher,baseUrl}),
    fetchTable('JournalEncounterXDifficulty',{build:normalizedBuild,fetcher,baseUrl}),
    fetchTable('Difficulty',{build:normalizedBuild,fetcher,baseUrl}),
  ]);
  const sectionRows=sections.rows.map(row=>({rowId:optionalInt(first(row,['ID','Id'])),journalSectionId:optionalInt(first(row,['JournalEncounterSectionID','JournalSectionID','JournalEncounterSectionId'])),difficultyId:optionalInt(first(row,['DifficultyID','DifficultyId']))})).filter(row=>row.journalSectionId&&row.difficultyId);
  const encounterRows=encounters.rows.map(row=>({rowId:optionalInt(first(row,['ID','Id'])),journalEncounterId:optionalInt(first(row,['JournalEncounterID','JournalEncounterId'])),difficultyId:optionalInt(first(row,['DifficultyID','DifficultyId']))})).filter(row=>row.journalEncounterId&&row.difficultyId);
  const difficultyRows=difficulties.rows.map(row=>({difficultyId:optionalInt(first(row,['ID','Id'])),name:clean(first(row,['Name_lang','Name','NameLang'])),instanceType:optionalInt(first(row,['InstanceType'])),fallbackDifficultyId:optionalInt(first(row,['FallbackDifficultyID','FallbackDifficultyId'])),toggleDifficultyId:optionalInt(first(row,['ToggleDifficultyID','ToggleDifficultyId']))})).filter(row=>row.difficultyId);
  if(sections.rows.length&&(!sections.headers.some(h=>/Journal.*SectionID/i.test(h))||!sections.headers.some(h=>/^DifficultyID$/i.test(h))))throw new Error('JournalSectionXDifficulty schema is missing section or DifficultyID');
  if(encounters.rows.length&&(!encounters.headers.some(h=>/JournalEncounterID/i.test(h))||!encounters.headers.some(h=>/^DifficultyID$/i.test(h))))throw new Error('JournalEncounterXDifficulty schema is missing encounter or DifficultyID');
  if(difficulties.rows.length&&(!difficulties.headers.some(h=>/^ID$/i.test(h))||!difficulties.headers.some(h=>/^Name(?:_lang|Lang)?$/i.test(h))))throw new Error('Difficulty schema is missing ID or Name');
  const payload={version:WAGO_DB2_JOURNAL_DIFFICULTY_PROVIDER_VERSION,provider:'wago-db2',build:normalizedBuild,sectionRows,encounterRows,difficultyRows};
  return{...payload,fingerprint:sha1(payload),sources:{sections:sections.endpoint,encounters:encounters.endpoint,difficulties:difficulties.endpoint},usage:{networkCalls:3,sectionRows:sectionRows.length,encounterRows:encounterRows.length,difficultyRows:difficultyRows.length},evidenceContract:{buildPinned:true,clientDb2StructuralMetadata:true,wclDifficultyIdsAreNotDb2DifficultyIds:true,difficultyMappingUsesEncounterScopedDb2IdsAndNames:true,observedCombat:false,absenceIsCombatNegativeEvidence:false,crossDifficultyInference:false,automaticPromotion:false}};
}
