import { RELIABILITY_CONTRACT_VERSION } from './reliability-contract-v1.mjs';

const finite=v=>Number.isFinite(Number(v));
const numberOrNull=v=>finite(v)?Number(v):null;
const confidenceWeight=value=>({confirmed:1,high:1,medium:.7,low:.35,unknown:0}[String(value||'unknown').toLowerCase()]??0);
const stableIdentity=player=>String(player?.canonicalId||player?.actorId||player?.name||'unknown');

export function evidenceKey(row){
  return [row.playerId,row.reportCode,row.fightId,row.dimension,row.opportunityKey,row.kind].join(':');
}

export function normalizeEvidenceRow(input={}){
  const row={
    schemaVersion:1,
    contractVersion:RELIABILITY_CONTRACT_VERSION,
    playerId:String(input.playerId||''),
    playerName:String(input.playerName||''),
    canonicalId:input.canonicalId==null?null:String(input.canonicalId),
    className:input.className||null,
    spec:input.spec||null,
    role:input.role||null,
    encounterId:numberOrNull(input.encounterId),
    difficulty:numberOrNull(input.difficulty),
    partition:numberOrNull(input.partition),
    reportCode:input.reportCode||null,
    fightId:numberOrNull(input.fightId),
    pullNumber:numberOrNull(input.pullNumber),
    nightId:input.nightId||null,
    timestamp:numberOrNull(input.timestamp),
    dimension:String(input.dimension||''),
    kind:String(input.kind||''),
    opportunityKey:String(input.opportunityKey||''),
    outcome:input.outcome==='success'?'success':input.outcome==='failure'?'failure':'unknown',
    eligible:Boolean(input.eligible),
    exclusionReason:input.exclusionReason||null,
    severity:Math.max(0,numberOrNull(input.severity)??1),
    confidence:String(input.confidence||'unknown').toLowerCase(),
    evidenceWeight:Math.max(0,numberOrNull(input.evidenceWeight)??confidenceWeight(input.confidence)),
    exposureNumber:Math.max(1,numberOrNull(input.exposureNumber)??1),
    repeatedFailure:Boolean(input.repeatedFailure),
    linkedDeath:Boolean(input.linkedDeath),
    firstDeath:Boolean(input.firstDeath),
    source:String(input.source||'unknown'),
    evidence:input.evidence&&typeof input.evidence==='object'?input.evidence:{},
  };
  if(!row.playerId)throw new Error('Reliability evidence requires playerId');
  if(!row.dimension)throw new Error('Reliability evidence requires dimension');
  if(!row.kind)throw new Error('Reliability evidence requires kind');
  if(!row.opportunityKey)throw new Error('Reliability evidence requires opportunityKey');
  return row;
}

export function buildShadowEvidenceLedger({players=[],reportCode=null,encounter=null,mechanics=null,deathChains=null}={}){
  const rows=[];
  const playersById=new Map(players.map(player=>[Number(player.actorId),player]));
  const linkedByPlayer=new Map();
  for(const chain of deathChains?.chains||[]){
    if(chain?.actorId==null)continue;
    const key=Number(chain.actorId);
    const item=linkedByPlayer.get(key)||{linked:0,first:0};
    if(chain.probableCause)item.linked++;
    if(chain.isFirstDeath||chain.firstDeath)item.first++;
    linkedByPlayer.set(key,item);
  }

  for(const player of players){
    const playerId=stableIdentity(player);
    const encounterStats=player.encounter||{};
    const pulls=Number(encounterStats.pulls)||0;
    const linked=linkedByPlayer.get(Number(player.actorId))||{linked:0,first:Number(encounterStats.firstDeaths)||0};
    // Existing telemetry does not prove per-pull participation across the report. Preserve the
    // aggregate as audit context but keep it ineligible until the per-pull ledger is available.
    rows.push(normalizeEvidenceRow({
      playerId,playerName:player.name,canonicalId:player.canonicalId,className:player.className,spec:player.spec,role:player.role,
      encounterId:encounter?.id,difficulty:encounter?.difficulty,partition:encounter?.partition,reportCode,
      dimension:'survival',kind:'aggregate-participation-placeholder',opportunityKey:`aggregate:${reportCode}:${playerId}:survival`,
      outcome:'unknown',eligible:false,exclusionReason:'per-pull-player-participation-not-proven',confidence:'unknown',source:'telemetry-aggregate',
      evidence:{pulls,rawDeaths:Number(encounterStats.deaths)||0,meaningfulDeaths:Number(encounterStats.meaningfulDeaths)||0,firstDeaths:Number(encounterStats.firstDeaths)||0,deathLinked:linked.linked}
    }));
  }

  for(const failure of mechanics?.failures||[]){
    if(failure.actorId==null)continue;
    const player=playersById.get(Number(failure.actorId));
    if(!player)continue;
    rows.push(normalizeEvidenceRow({
      playerId:stableIdentity(player),playerName:player.name,canonicalId:player.canonicalId,className:player.className,spec:player.spec,role:player.role,
      encounterId:encounter?.id,difficulty:encounter?.difficulty,partition:encounter?.partition,reportCode,
      fightId:failure.fightId,timestamp:failure.timestampReportMs,dimension:'mechanics',kind:'mechanic-failure',
      opportunityKey:failure.occurrenceKey||`${failure.fightId}:${failure.mechanicKey}:${failure.timestampReportMs}`,
      outcome:'failure',eligible:false,exclusionReason:'player-opportunity-denominator-not-proven',severity:failure.severity||failure.weight||1,
      confidence:failure.confidence||'unknown',source:'encounter-rule-engine',linkedDeath:Boolean(failure.linkedDeath),firstDeath:Boolean(failure.firstDeath),
      evidence:{mechanicKey:failure.mechanicKey,mechanicName:failure.mechanicName,reason:failure.reason,...(failure.evidence||{})}
    }));
  }

  return dedupeEvidence(rows);
}

export function dedupeEvidence(rows=[]){
  const map=new Map();
  for(const input of rows){
    const row=input?.schemaVersion===1?input:normalizeEvidenceRow(input);
    const key=evidenceKey(row);
    const previous=map.get(key);
    if(!previous||row.evidenceWeight>previous.evidenceWeight)map.set(key,row);
  }
  return [...map.values()].sort((a,b)=>(a.timestamp??0)-(b.timestamp??0)||a.playerId.localeCompare(b.playerId));
}

export function ledgerDiagnostics(rows=[]){
  const normalized=dedupeEvidence(rows);
  const eligible=normalized.filter(row=>row.eligible&&row.outcome!=='unknown');
  const byDimension={};
  const exclusionReasons={};
  for(const row of normalized){
    const dim=byDimension[row.dimension]??={raw:0,eligible:0,successes:0,failures:0,unknown:0};
    dim.raw++;
    if(row.eligible)dim.eligible++;
    dim[row.outcome==='success'?'successes':row.outcome==='failure'?'failures':'unknown']++;
    if(!row.eligible){const reason=row.exclusionReason||'unspecified';exclusionReasons[reason]=(exclusionReasons[reason]||0)+1;}
  }
  return {rawRows:normalized.length,eligibleRows:eligible.length,players:new Set(normalized.map(row=>row.playerId)).size,byDimension,exclusionReasons};
}
