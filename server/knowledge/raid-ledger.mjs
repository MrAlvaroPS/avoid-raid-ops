import { corpusGet, corpusSet } from '../corpus/storage.mjs';
import { homeRaidLedgerKey } from './keys.mjs';
import { homeGuildId, raidKnowledgeScope } from './scopes.mjs';

const now=()=>Date.now();

function cleanPlayer(player={}){
  return {
    canonicalID:player.canonicalID??null,
    actorId:Number.isFinite(Number(player.actorId))?Number(player.actorId):null,
    name:player.name||null,
    className:player.className||null,
    spec:player.spec||null,
    role:player.role||null,
    itemLevel:Number.isFinite(Number(player.itemLevel))?Number(player.itemLevel):null,
    evidence:player.evidence||null,
  };
}

export async function writeHomeRaidEvidence({
  guildId=homeGuildId(),
  reportGuildId=guildId,
  encounterId,
  difficulty=5,
  partition,
  reportCode,
  reportStartTime=null,
  players=[],
  raid=null,
}={}){
  const scope=raidKnowledgeScope({guildId,encounterId,difficulty,partition});
  if(Number(reportGuildId)!==homeGuildId())throw new Error(`External guild ${reportGuildId} cannot enter the AvoiD raid/player knowledge ledger`);
  if(!reportCode)throw new Error('reportCode is required for home raid evidence');
  const key=homeRaidLedgerKey(scope);
  const current=await corpusGet(key)||{
    schemaVersion:1,
    knowledgeScope:'home-raid',
    guildId:homeGuildId(),
    encounterId:Number(encounterId),
    difficulty:Number(difficulty),
    partition:Number(partition),
    reports:{},
    createdAt:now(),
  };
  current.reports[String(reportCode)]={
    reportCode:String(reportCode),
    reportGuildId:Number(reportGuildId),
    reportStartTime:Number.isFinite(Number(reportStartTime))?Number(reportStartTime):null,
    players:(players||[]).map(cleanPlayer),
    raid,
    updatedAt:now(),
  };
  current.updatedAt=now();
  await corpusSet(key,current);
  return current;
}

export async function loadHomeRaidEvidence(args={}){
  const scope=raidKnowledgeScope(args);
  return corpusGet(homeRaidLedgerKey(scope));
}
