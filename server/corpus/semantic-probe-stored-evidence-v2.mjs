import { eventAbilityId,eventSourceId,eventTargetId } from '../wcl/normalization/events.mjs';

export const SEMANTIC_STORED_EVIDENCE_VERSION='semantic-stored-evidence-v2';

const finite=value=>Number.isFinite(Number(value))?Number(value):null;

function targetEvents(anchorRecord,signalId){
  const rows=[];
  for(const [stream,events] of Object.entries(anchorRecord?.streams||{}))for(const event of events||[]){
    if(Number(eventAbilityId(event))!==Number(signalId))continue;
    const timestamp=finite(event?.timestamp);if(timestamp==null)continue;
    rows.push({timestamp,stream,type:event?.type||null,sourceID:eventSourceId(event),targetID:eventTargetId(event)});
  }
  rows.sort((a,b)=>a.timestamp-b.timestamp);
  return rows;
}

function nearestTarget(rows,timestamp){
  let best=null;
  for(const row of rows||[]){const distance=Math.abs(Number(row.timestamp)-Number(timestamp));if(!best||distance<best.distance)best={...row,distance};}
  return best&&best.distance<=25?best:null;
}

export function buildStoredSemanticSourceEvidenceV2({signalId,evidenceRecords=[]}={}){
  const records=(evidenceRecords||[]).filter(Boolean).filter(row=>Number(row.signalId)===Number(signalId));
  const anchors=records.filter(row=>row.kind==='anchor'&&row?.pagination?.complete===true);
  const contexts=records.filter(row=>row.kind==='context'&&row?.pagination?.complete===true);
  const sourceKeys=new Set([...anchors,...contexts].map(row=>`${String(row.source)}|${String(row.reportCode)}`));
  const sourceEvidence=[];
  for(const sourceKey of sourceKeys){
    const [source,reportCode]=sourceKey.split('|');
    const anchorRows=anchors.filter(row=>String(row.source)===source&&String(row.reportCode)===reportCode);
    const contextRows=contexts.filter(row=>String(row.source)===source&&String(row.reportCode)===reportCode);
    const targetRows=anchorRows.flatMap(row=>targetEvents(row,signalId));
    const anchorOccurrences=[];
    const seen=new Set();
    for(const context of contextRows){
      const timestamp=finite(context.anchorTimestamp);if(timestamp==null)continue;
      const match=nearestTarget(targetRows,timestamp);
      const key=`${finite(context.fightID)??'x'}:${timestamp}`;if(seen.has(key))continue;seen.add(key);
      anchorOccurrences.push({
        timestamp,fightID:finite(context.fightID),stream:match?.stream||null,type:match?.type||null,
        sourceID:match?.sourceID??null,targetID:match?.targetID??null,
      });
    }
    sourceEvidence.push({source,reportCode,anchorOccurrences,contexts:contextRows.map(row=>({...row,complete:true}))});
  }
  return{
    version:SEMANTIC_STORED_EVIDENCE_VERSION,signalId:Number(signalId),sourceEvidence,
    summary:{sources:sourceEvidence.length,anchors:sourceEvidence.reduce((n,row)=>n+row.anchorOccurrences.length,0),contexts:sourceEvidence.reduce((n,row)=>n+row.contexts.length,0)},
  };
}

export function buildStoredFlankBackgroundEvidenceV2({signalId,evidenceRecords=[],innerRadiusMs=2500}={}){
  const records=(evidenceRecords||[]).filter(Boolean).filter(row=>Number(row.signalId)===Number(signalId)&&row.kind==='context'&&row?.pagination?.complete===true);
  const wider=records.filter(row=>Number(row.windowMs)>Number(innerRadiusMs));
  const sourceMap=new Map();
  for(const row of wider){
    const source=String(row.source),reportCode=String(row.reportCode),anchor=Number(row.anchorTimestamp),outer=Number(row.windowMs);
    if(!Number.isFinite(anchor)||!Number.isFinite(outer))continue;
    const bands=[{side:'before',start:anchor-outer,end:anchor-innerRadiusMs,referenceTimestamp:anchor-(outer+innerRadiusMs)/2},{side:'after',start:anchor+innerRadiusMs,end:anchor+outer,referenceTimestamp:anchor+(outer+innerRadiusMs)/2}];
    const key=`${source}|${reportCode}`;if(!sourceMap.has(key))sourceMap.set(key,{source,reportCode,anchorOccurrences:[],contexts:[]});
    const target=sourceMap.get(key);
    for(const band of bands){
      if(!(band.end>band.start))continue;
      const streams=Object.fromEntries(Object.entries(row.streams||{}).map(([stream,events])=>[stream,(events||[]).filter(event=>Number(event?.timestamp)>=band.start&&Number(event?.timestamp)<=band.end)]));
      target.contexts.push({kind:'background-flank',signalId:Number(signalId),source,reportCode,fightID:row.fightID,anchorTimestamp:band.referenceTimestamp,windowMs:(band.end-band.start)/2,streams,complete:true,backgroundMethod:`cached-${band.side}-flank`});
    }
  }
  const backgroundEvidence=[...sourceMap.values()];
  return{
    version:SEMANTIC_STORED_EVIDENCE_VERSION,signalId:Number(signalId),method:'cached-outer-flank',backgroundEvidence,
    summary:{sources:backgroundEvidence.length,contexts:backgroundEvidence.reduce((n,row)=>n+row.contexts.length,0),usesOnlyPersistedEvidence:true,wclCalls:0},
  };
}
