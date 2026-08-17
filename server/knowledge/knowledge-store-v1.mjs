import { mkdir,readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';

const memory={active:null,candidate:null,activation:null};
const dataDir=()=>String(process.env.IRIS_DATA_DIR||'').trim();
const filePath=()=>dataDir()?path.join(dataDir(),'knowledge','game-knowledge-v1.json'):null;

async function loadDisk(){
  const file=filePath();if(!file)return null;
  try{return JSON.parse(await readFile(file,'utf8'))}catch{return null}
}
async function saveDisk(state){
  const file=filePath();if(!file)return false;
  await mkdir(path.dirname(file),{recursive:true});
  await writeFile(file,JSON.stringify(state,null,2),'utf8');
  return true;
}

export async function readKnowledgeState(){
  const disk=await loadDisk();
  if(disk){memory.active=disk.active||null;memory.candidate=disk.candidate||null;memory.activation=disk.activation||null;}
  return {...memory,persistence:filePath()?'local-fs':'process-memory'};
}

export async function stageKnowledgeCandidate(snapshot){
  memory.candidate=snapshot;
  const state={active:memory.active,candidate:memory.candidate,activation:memory.activation};
  await saveDisk(state);
  return readKnowledgeState();
}

export async function activateKnowledgeCandidate(){
  if(!memory.candidate){const disk=await loadDisk();if(disk){memory.active=disk.active||null;memory.candidate=disk.candidate||null;memory.activation=disk.activation||null;}}
  if(!memory.candidate)throw new Error('No staged knowledge revision to activate');
  const previousRevision=memory.active?.revision||null;
  memory.active=memory.candidate;
  memory.candidate=null;
  memory.activation={
    at:Date.now(),
    previousRevision,
    activeRevision:memory.active.revision,
    derivedDataPolicy:'invalidate-and-rederive',
    rawEvidencePolicy:'immutable',
    reindexStatus:'required',
  };
  await saveDisk({active:memory.active,candidate:memory.candidate,activation:memory.activation});
  return readKnowledgeState();
}
