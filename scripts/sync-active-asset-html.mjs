import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { synchronizeActiveAssetHtml } from './lib/active-asset-html.mjs';

const checkOnly=process.argv.includes('--check');
const indexUrl=new URL('../index.html',import.meta.url);
const source=await readFile(indexUrl,'utf8');
const synchronized=synchronizeActiveAssetHtml(source);

if(synchronized===source){
  console.log(`ACTIVE ASSET HTML ${checkOnly?'CHECK':'SYNC'}: index.html already canonical`);
  process.exit(0);
}

if(checkOnly){
  console.error('ACTIVE ASSET HTML CHECK: FAIL');
  console.error(' - index.html asset blocks differ from config/active-assets.mjs');
  console.error(' - run npm run sync:assets and commit the resulting index.html change');
  process.exit(1);
}

await writeFile(indexUrl,synchronized,'utf8');
console.log('ACTIVE ASSET HTML SYNC: UPDATED index.html');
