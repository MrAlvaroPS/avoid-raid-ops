import { readFile, writeFile } from 'node:fs/promises';

const path=new URL('../public/wcl-runtime.js',import.meta.url);
let source=await readFile(path,'utf8');

const count=(text,needle)=>text.split(needle).length-1;
const removeFunction=(text,name,nextName)=>{
  const startMarker=`function ${name}() {`;
  const endMarker=`\nfunction ${nextName}`;
  if(count(text,startMarker)!==1)throw new Error(`${name}: expected exactly one declaration`);
  const start=text.indexOf(startMarker);
  const end=text.indexOf(endMarker,start);
  if(end<0)throw new Error(`${name}: next anchor ${nextName} not found`);
  return text.slice(0,start)+text.slice(end+1);
};

source=removeFunction(source,'applyProgressPage','setCompareCell');
source=removeFunction(source,'applyRealProgressMatrix','applyPullIntelligenceToCommand');

for(const call of ['applyProgressPage();','applyRealProgressMatrix();']){
  if(count(source,call)!==1)throw new Error(`${call}: expected exactly one orchestration call after declaration removal`);
  source=source.replace(call,'');
}

for(const retired of ['applyProgressPage','applyRealProgressMatrix']){
  if(source.includes(`function ${retired}(`))throw new Error(`${retired}: declaration survived migration`);
  if(source.includes(`${retired}();`))throw new Error(`${retired}: orchestration call survived migration`);
}
for(const preserved of ['applyProgressCurve','applyHistoryData']){
  if(!source.includes(`function ${preserved}(`))throw new Error(`${preserved}: shared compatibility behavior was removed unexpectedly`);
}
if(!source.includes('applySupplemental();'))throw new Error('applyAll orchestration was damaged');
if(!source.includes('applyCommandCenter();'))throw new Error('Command Center orchestration was damaged');

await writeFile(path,source,'utf8');
console.log('PHASE 3 PROGRESS WRITER RETIREMENT: PASS');
console.log(' - removed applyProgressPage declaration + applyAll call');
console.log(' - removed applyRealProgressMatrix declaration + applyAll call');
console.log(' - preserved applyProgressCurve and applyHistoryData');
