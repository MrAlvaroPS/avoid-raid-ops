import { access, readFile, readdir } from 'node:fs/promises';
import {
  ACTIVE_ASSET_MANIFEST_VERSION,
  ACTIVE_STYLES,
  CSS_BUNDLE_SOURCES,
  ACTIVE_LOCAL_SCRIPTS,
  ACTIVE_EXTERNAL_SCRIPTS,
  RUNTIME_FAMILIES,
  HISTORICAL_ONLY_ASSETS,
} from '../config/active-assets.mjs';
import { synchronizeActiveAssetHtml } from './lib/active-asset-html.mjs';

const root=new URL('../',import.meta.url);
const html=await readFile(new URL('index.html',root),'utf8');
const publicFiles=await readdir(new URL('public/',root));
const fail=[];
const expect=(condition,message)=>{if(!condition)fail.push(message)};
const attr=(tag,name)=>tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`,'i'))?.[1]||null;
const tags=name=>[...html.matchAll(new RegExp(`<${name}\\b[^>]*>`,'gi'))].map(match=>match[0]);
const actualStyles=tags('link').filter(tag=>(attr(tag,'rel')||'').toLowerCase().split(/\s+/).includes('stylesheet')).map(tag=>attr(tag,'href')).filter(Boolean);
const actualScripts=tags('script').map(tag=>attr(tag,'src')).filter(Boolean);
const expectedStyles=ACTIVE_STYLES.map(asset=>asset.src);
const expectedScripts=[...ACTIVE_EXTERNAL_SCRIPTS,...ACTIVE_LOCAL_SCRIPTS].map(asset=>asset.src);
const cleanLocal=src=>src.split('?')[0];
const publicPath=src=>`public${cleanLocal(src)}`;

expect(ACTIVE_ASSET_MANIFEST_VERSION==='active-assets-v1','active asset manifest version must remain explicit');
try{
  expect(synchronizeActiveAssetHtml(html)===html,'index active asset blocks differ from canonical manifest; run npm run sync:assets');
}catch(error){fail.push(`index active asset markers are invalid: ${error instanceof Error?error.message:String(error)}`)}
expect(JSON.stringify(actualStyles)===JSON.stringify(expectedStyles),`index stylesheet transport differs from canonical manifest\n expected ${JSON.stringify(expectedStyles)}\n actual   ${JSON.stringify(actualStyles)}`);
expect(JSON.stringify(actualScripts)===JSON.stringify(expectedScripts),`index script order differs from canonical manifest\n expected ${JSON.stringify(expectedScripts)}\n actual   ${JSON.stringify(actualScripts)}`);
expect(ACTIVE_STYLES.length===2,'production must transport exactly Golden CSS plus one generated compatibility bundle');
expect(CSS_BUNDLE_SOURCES.length===17,'generated compatibility bundle must retain all 17 reviewed source layers');

const all=[...ACTIVE_STYLES,...CSS_BUNDLE_SOURCES,...ACTIVE_LOCAL_SCRIPTS,...ACTIVE_EXTERNAL_SCRIPTS];
const ids=new Set(),sources=new Set();
for(const asset of all){
  expect(Boolean(asset.id&&asset.owner&&asset.domain&&asset.role&&asset.retirement&&asset.authority),`asset ${asset.src||'<missing>'} lacks ownership metadata`);
  expect(!ids.has(asset.id),`duplicate asset id ${asset.id}`);ids.add(asset.id);
  expect(!sources.has(asset.src),`duplicate asset src ${asset.src}`);sources.add(asset.src);
}

for(const asset of [...ACTIVE_STYLES,...CSS_BUNDLE_SOURCES,...ACTIVE_LOCAL_SCRIPTS]){
  expect(asset.src.startsWith('/'),'local asset must use root-relative src');
  expect(!asset.src.includes('/old/'),'active/source asset cannot cross old/ quarantine boundary');
  try{await access(new URL(publicPath(asset.src),root))}catch{fail.push(`required asset file missing: ${publicPath(asset.src)}`)}
}

const linkedStyleSet=new Set(actualStyles.map(cleanLocal));
for(const source of CSS_BUNDLE_SOURCES)expect(!linkedStyleSet.has(cleanLocal(source.src)),`CSS source layer must not be individually transported after consolidation: ${source.src}`);
expect(ACTIVE_STYLES[1]?.id==='active-css-bundle'&&ACTIVE_STYLES[1]?.authority==='generated-bundle','generated CSS bundle must be the only post-Golden stylesheet transport');
expect(ACTIVE_STYLES[1]?.src==='/raidops-active.css?v=3.9.2-css1','generated CSS transport cache identity changed without manifest review');
expect(CSS_BUNDLE_SOURCES.every(asset=>asset.authority==='source-layer'&&asset.retirement==='visual-equivalence-required'),'CSS source layers must remain audited visual-equivalence sources');

const primaryByDomain=new Map();
for(const asset of ACTIVE_LOCAL_SCRIPTS.filter(asset=>asset.authority==='primary')){
  const existing=primaryByDomain.get(asset.domain);
  expect(!existing,`domain ${asset.domain} has two primary runtime owners: ${existing?.id} and ${asset.id}`);
  primaryByDomain.set(asset.domain,asset);
}
expect(ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.id==='wcl-legacy-runtime')?.authority==='compatibility','legacy WCL runtime must never be promoted back to primary ownership');
for(const required of ['bootstrap','data-platform','knowledge','mechanics','progress','iris','players'])expect(primaryByDomain.has(required),`missing primary runtime owner for ${required}`);

const loadedLocalFiles=new Set(ACTIVE_LOCAL_SCRIPTS.map(asset=>cleanLocal(asset.src).replace(/^\//,'')));
for(const family of RUNTIME_FAMILIES){
  const members=publicFiles.filter(name=>family.pattern.test(name)).sort();
  expect(members.includes(family.activeFile),`runtime family ${family.id} active file ${family.activeFile} is missing from public/`);
  const loaded=members.filter(name=>loadedLocalFiles.has(name));
  expect(loaded.length===1&&loaded[0]===family.activeFile,`runtime family ${family.id} must load only ${family.activeFile}; loaded ${loaded.join(', ')||'none'}`);
  const manifestEntry=ACTIVE_LOCAL_SCRIPTS.find(asset=>asset.family===family.id);
  expect(manifestEntry?.owner===family.owner,`runtime family ${family.id} owner differs from active manifest`);
}

const activeClean=new Set([...ACTIVE_STYLES,...ACTIVE_LOCAL_SCRIPTS].map(asset=>cleanLocal(asset.src)));
for(const src of HISTORICAL_ONLY_ASSETS){
  expect(!activeClean.has(src),`historical-only asset was reactivated: ${src}`);
  try{await access(new URL(`public${src}`,root))}catch{fail.push(`historical inventory points to missing file: public${src}`)}
}

expect(ACTIVE_STYLES[0]?.id==='golden-css'&&ACTIVE_STYLES[0]?.retirement==='never','Golden CSS must remain first and immutable');
expect(ACTIVE_LOCAL_SCRIPTS[0]?.id==='golden-runtime'&&ACTIVE_LOCAL_SCRIPTS[0]?.retirement==='never','Golden runtime must remain the first local runtime');
expect(ACTIVE_LOCAL_SCRIPTS.findIndex(asset=>asset.id==='wcl-bootstrap')<ACTIVE_LOCAL_SCRIPTS.findIndex(asset=>asset.id==='data-hub'),'bootstrap must load before Data Hub');
expect(ACTIVE_LOCAL_SCRIPTS.findIndex(asset=>asset.id==='data-hub')<ACTIVE_LOCAL_SCRIPTS.findIndex(asset=>asset.id==='wcl-legacy-runtime'),'Data Hub must wrap network/data mode before legacy WCL runtime starts');
expect(ACTIVE_LOCAL_SCRIPTS.findIndex(asset=>asset.id==='wcl-legacy-runtime')<ACTIVE_LOCAL_SCRIPTS.findIndex(asset=>asset.id==='progress-runtime'),'Progress canonical owner must load after legacy WCL writers it intercepts');
expect(ACTIVE_LOCAL_SCRIPTS.findIndex(asset=>asset.id==='iris-runtime')<ACTIVE_LOCAL_SCRIPTS.findIndex(asset=>asset.id==='player-intelligence'),'Players hotfix/owner must remain after Iris runtime');

if(fail.length){
  console.error('ACTIVE ASSET VERIFICATION: FAIL');
  for(const message of fail)console.error(' -',message);
  process.exit(1);
}
console.log('ACTIVE ASSET VERIFICATION: PASS');
console.log(' - index.html active asset blocks are generated from the canonical manifest');
console.log(` - ${ACTIVE_STYLES.length} stylesheet transports: immutable Golden + generated compatibility bundle`);
console.log(` - ${CSS_BUNDLE_SOURCES.length} audited CSS source layers remain ordered and individually unlinked`);
console.log(` - ${ACTIVE_LOCAL_SCRIPTS.length} local runtimes + ${ACTIVE_EXTERNAL_SCRIPTS.length} external reference script match the canonical load order`);
console.log(` - ${primaryByDomain.size} runtime domains have one primary owner`);
console.log(` - ${HISTORICAL_ONLY_ASSETS.length} known historical assets are present but cannot be reactivated silently`);
