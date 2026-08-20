import { createHash, randomUUID } from 'node:crypto';
import { corpusGet, corpusSet } from '../corpus/storage.mjs';

export const LOOT_LEDGER_VERSION='loot-ledger-v1';
const KEY='home/loot/v1/ledger.json';
const norm=value=>String(value||'').trim().toLowerCase();
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
const fp=value=>createHash('sha1').update(JSON.stringify(stable(value))).digest('hex');

function empty(){return{version:LOOT_LEDGER_VERSION,updatedAt:null,awards:[],source:'local-ledger',futureSync:['wowaudit'],networkExecuted:false};}
export async function loadLootLedgerV1({storageGet=corpusGet}={}){const row=await storageGet(KEY).catch(()=>null);return row?.version===LOOT_LEDGER_VERSION?row:empty();}
export function lootCountsV1(ledger={}){const map=new Map();for(const award of ledger.awards||[]){const key=norm(award.playerName);if(!key)continue;const row=map.get(key)||{playerName:award.playerName,count:0,lastAwardAt:null,items:[]};row.count++;row.lastAwardAt=Math.max(Number(row.lastAwardAt)||0,Number(award.awardedAt)||0)||null;row.items.push({itemId:award.itemId,itemName:award.itemName,awardedAt:award.awardedAt,bossName:award.bossName,difficultyName:award.difficultyName});map.set(key,row);}return[...map.values()];}
export async function awardLootV1(input,{storageGet=corpusGet,storageSet=corpusSet,now=()=>Date.now()}={}){
  const playerName=String(input?.playerName||'').trim(),itemId=Number(input?.itemId),itemName=String(input?.itemName||'').trim();if(!playerName)throw new Error('playerName is required');if(!Number.isInteger(itemId)||itemId<=0)throw new Error('itemId is required');if(!itemName)throw new Error('itemName is required');
  const ledger=await loadLootLedgerV1({storageGet}),award={id:randomUUID(),playerName,itemId,itemName,itemLevel:Number.isFinite(Number(input?.itemLevel))?Number(input.itemLevel):null,bossName:String(input?.bossName||'').trim()||null,difficulty:Number.isFinite(Number(input?.difficulty))?Number(input.difficulty):null,difficultyName:String(input?.difficultyName||'').trim()||null,reportCode:String(input?.reportCode||'').trim()||null,fightId:Number.isFinite(Number(input?.fightId))?Number(input.fightId):null,note:String(input?.note||'').trim()||null,awardedAt:Number(input?.awardedAt)||Number(now())};ledger.awards.push(award);ledger.updatedAt=Number(now());ledger.fingerprint=fp({version:ledger.version,awards:ledger.awards});await storageSet(KEY,ledger);return{ledger,award,counts:lootCountsV1(ledger)};
}
export async function removeLootAwardV1(id,{storageGet=corpusGet,storageSet=corpusSet,now=()=>Date.now()}={}){const target=String(id||'').trim();if(!target)throw new Error('award id is required');const ledger=await loadLootLedgerV1({storageGet}),before=ledger.awards.length;ledger.awards=ledger.awards.filter(row=>row.id!==target);if(ledger.awards.length===before)throw new Error('award not found');ledger.updatedAt=Number(now());ledger.fingerprint=fp({version:ledger.version,awards:ledger.awards});await storageSet(KEY,ledger);return{ledger,counts:lootCountsV1(ledger)};}
