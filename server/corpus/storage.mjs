import { mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const STORE_NAME = 'avoid-raid-ops-encounter-corpus-v1';
const LOCAL_DIR = process.env.AVOID_CORPUS_LOCAL_DIR || join(process.cwd(), '.raidops-corpus');
let blobModulePromise = null;

export const isVercelRuntime = () => Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_URL);

async function blobModule(){
  if (!blobModulePromise) {
    blobModulePromise = import('@vercel/blob').catch(error => {
      blobModulePromise = null;
      throw new Error(`Persistent corpus storage unavailable: ${error?.message || error}`);
    });
  }
  return blobModulePromise;
}

function safeKey(key){return String(key||'').replace(/^\/+/, '').replace(/\.\.(?:\/|\\)/g,'');}
function blobPath(key){return `${STORE_NAME}/${safeKey(key)}`;}
function localPath(key){return join(LOCAL_DIR, safeKey(key));}


export async function corpusStorageStatus(){
  if (isVercelRuntime()) {
    await blobModule();
    return {kind:'vercel-blob-private',persistent:true,hostedBuilder:true,consistentReads:true,store:STORE_NAME};
  }
  return {kind:'local-filesystem',persistent:true,hostedBuilder:false,store:STORE_NAME,localDir:LOCAL_DIR};
}

export async function assertCorpusStorage(){
  const status = await corpusStorageStatus();
  if (!isVercelRuntime()) {
    await mkdir(LOCAL_DIR,{recursive:true});
    return status;
  }
  const {put,get,del} = await blobModule();
  const probe = `${STORE_NAME}/health/${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
  const payload = JSON.stringify({ok:true,at:Date.now()});
  await put(probe,payload,{access:'private',addRandomSuffix:false,contentType:'application/json',cacheControlMaxAge:60});
  const result = await get(probe,{access:'private',useCache:false});
  if (!result || result.statusCode !== 200) throw new Error('Persistent corpus storage health check failed: private Blob write succeeded but consistent read failed');
  const text = await new Response(result.stream).text();
  if (JSON.parse(text)?.ok !== true) throw new Error('Persistent corpus storage health check failed: invalid probe payload');
  await del(probe);
  return status;
}

export async function corpusGet(key){
  if (isVercelRuntime()) {
    const {get} = await blobModule();
    const result = await get(blobPath(key),{access:'private',useCache:false});
    if (!result || result.statusCode !== 200) return null;
    const text = await new Response(result.stream).text();
    return text ? JSON.parse(text) : null;
  }
  try{return JSON.parse(await readFile(localPath(key),'utf8'));}catch(err){if(err?.code==='ENOENT')return null;throw err;}
}

export async function corpusSet(key,value){
  if (isVercelRuntime()) {
    const {put} = await blobModule();
    await put(blobPath(key),JSON.stringify(value),{
      access:'private',
      addRandomSuffix:false,
      allowOverwrite:true,
      contentType:'application/json',
      cacheControlMaxAge:60,
    });
    return value;
  }
  const path=localPath(key);await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(value),'utf8');return value;
}

export async function corpusDelete(key){
  if (isVercelRuntime()) {
    const {del} = await blobModule();
    await del(blobPath(key));
    return;
  }
  await rm(localPath(key),{force:true,recursive:true});
}

async function listLocal(dir,prefix=''){
  const root=join(LOCAL_DIR,dir);let out=[];
  try{
    for(const ent of await readdir(root,{withFileTypes:true})){
      const rel=prefix?`${prefix}/${ent.name}`:ent.name;
      if(ent.isDirectory())out=out.concat(await listLocal(join(dir,ent.name),rel));
      else out.push(rel);
    }
  }catch(err){if(err?.code!=='ENOENT')throw err;}
  return out;
}

export async function corpusList(prefix=''){
  if (isVercelRuntime()) {
    const {list} = await blobModule();
    const fullPrefix=blobPath(prefix);let cursor;const out=[];
    do {
      const page=await list({prefix:fullPrefix,limit:1000,cursor});
      for(const blob of page.blobs||[]) out.push(String(blob.pathname).replace(`${STORE_NAME}/`,''));
      cursor=page.hasMore?page.cursor:undefined;
    } while(cursor);
    return out;
  }
  return listLocal('', '').then(keys=>keys.filter(k=>k.startsWith(safeKey(prefix))));
}

export const corpusStorageInfo = Object.freeze({storeName:STORE_NAME,localDir:LOCAL_DIR});
