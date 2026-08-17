import { readFile, writeFile } from 'node:fs/promises';
import { synchronizeActiveAssetHtml } from './lib/active-asset-html.mjs';

const indexUrl=new URL('../index.html',import.meta.url);
const source=await readFile(indexUrl,'utf8');
const synchronized=synchronizeActiveAssetHtml(source);
if(synchronized!==source){
  await writeFile(indexUrl,synchronized,'utf8');
  console.log('ACTIVE ASSET HTML SYNC: UPDATED index.html');
}else{
  console.log('ACTIVE ASSET HTML SYNC: index.html already canonical');
}
