import { readFile } from 'node:fs/promises';
import { PRODUCT_RELEASE_VERSION, PRODUCT_RELEASE_LABEL } from '@avoid/release';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const fail=[];
const expect=(condition,message)=>{if(!condition)fail.push(message)};

expect(/^\d+\.\d+\.\d+$/.test(PRODUCT_RELEASE_VERSION),'product release must be strict X.Y.Z');
expect(PRODUCT_RELEASE_LABEL===`v${PRODUCT_RELEASE_VERSION}`,'release label must derive from product release version');

const [rootPkgSource,webPkgSource,bootstrap,appShell,route,service]=await Promise.all([
  read('package.json'),read('apps/web/package.json'),read('public/wcl-bootstrap-v389.js'),read('apps/web/src/app/AppShell.js'),read('routes/api/release.js'),read('server/services/release-service.mjs'),
]);
const rootPkg=JSON.parse(rootPkgSource),webPkg=JSON.parse(webPkgSource);
expect(rootPkg.private===true,'root package must remain private');
expect(webPkg.private===true,'web package must remain private');
expect(rootPkg.version==='0.0.0-private.0','root npm version must not masquerade as product release');
expect(webPkg.version==='0.0.0-private.0','web npm version must not masquerade as product release');
expect(rootPkg.workspaces?.includes('packages/release'),'root workspaces must include @avoid/release');
expect(webPkg.dependencies?.['@avoid/release']==='*','web source must consume the shared release package');
expect(appShell.includes('PRODUCT_RELEASE_LABEL')&&appShell.includes('@avoid/release'),'AppShell must consume the shared release label');
expect(!appShell.includes(PRODUCT_RELEASE_VERSION),'AppShell must not hardcode the current product release');
expect(bootstrap.includes("'/api/release'")||bootstrap.includes('"/api/release"'),'active bootstrap must read product release from /api/release');
expect(!bootstrap.includes(`const RELEASE='${PRODUCT_RELEASE_VERSION}'`),'bootstrap must not own the product release literal');
expect(!bootstrap.includes(`const RELEASE=\"${PRODUCT_RELEASE_VERSION}\"`),'bootstrap must not own the product release literal');
expect(route.includes('release-service.mjs'),'Nitro release route must delegate to the release service');
expect(!route.includes(PRODUCT_RELEASE_VERSION),'Nitro release route must not own the product release literal');
expect(service.includes("from '@avoid/release'"),'release service must consume @avoid/release');
expect(!service.includes(PRODUCT_RELEASE_VERSION),'release service must not duplicate the product release literal');

const tag=process.env.GITHUB_REF_TYPE==='tag'?process.env.GITHUB_REF_NAME:(process.env.AVOID_RELEASE_TAG||'');
if(tag)expect(tag===PRODUCT_RELEASE_LABEL,`tag ${tag} must match canonical product release ${PRODUCT_RELEASE_LABEL}`);

if(fail.length){
  console.error('RELEASE OWNERSHIP VERIFICATION: FAIL');
  for(const message of fail)console.error(' -',message);
  process.exit(1);
}
console.log('RELEASE OWNERSHIP VERIFICATION: PASS');
console.log(` - ${PRODUCT_RELEASE_LABEL} is owned only by @avoid/release`);
console.log(' - package versions are private implementation metadata, not product releases');
console.log(' - browser/server consumers derive the visible release from the shared contract');
if(tag)console.log(` - release tag ${tag} matches the canonical product release`);
