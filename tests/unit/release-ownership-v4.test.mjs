import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PRODUCT_RELEASE, PRODUCT_RELEASE_LABEL, PRODUCT_RELEASE_VERSION } from '@avoid/release';
import releaseService from '../../server/services/release-service.mjs';

const read=path=>readFile(new URL(`../../${path}`,import.meta.url),'utf8');

test('product release contract has one canonical semantic version',()=>{
  assert.equal(PRODUCT_RELEASE_VERSION,'3.9.2');
  assert.equal(PRODUCT_RELEASE_LABEL,'v3.9.2');
  assert.deepEqual(PRODUCT_RELEASE,{schema:'product-release-v1',product:'AvoiD Raid Operations',version:'3.9.2',label:'v3.9.2'});
  assert.ok(Object.isFrozen(PRODUCT_RELEASE));
});

test('release API exposes the shared contract and is GET-only',async()=>{
  const response=await releaseService({method:'GET'});assert.equal(response.status,200);
  const body=await response.json();assert.equal(body.ok,true);assert.deepEqual(body.release,PRODUCT_RELEASE);
  const rejected=await releaseService({method:'POST'});assert.equal(rejected.status,405);
});

test('active release consumers derive product version instead of owning a duplicate literal',async()=>{
  const [bootstrap,appShell,route,service,rootPkg,webPkg]=await Promise.all([read('public/wcl-bootstrap-v389.js'),read('apps/web/src/app/AppShell.js'),read('routes/api/release.js'),read('server/services/release-service.mjs'),read('package.json'),read('apps/web/package.json')]);
  assert.match(bootstrap,/nativeFetch\('\/api\/release'/);assert.doesNotMatch(bootstrap,/const RELEASE=/);
  assert.doesNotMatch(bootstrap,new RegExp(`['\"]${PRODUCT_RELEASE_VERSION.replaceAll('.','\\.')}['\"]`));
  assert.match(appShell,/PRODUCT_RELEASE_LABEL/);assert.match(appShell,/@avoid\/release/);assert.doesNotMatch(appShell,new RegExp(PRODUCT_RELEASE_VERSION.replaceAll('.','\\.')));
  assert.match(route,/release-service\.mjs/);assert.doesNotMatch(route,new RegExp(PRODUCT_RELEASE_VERSION.replaceAll('.','\\.')));
  assert.match(service,/from '@avoid\/release'/);assert.doesNotMatch(service,new RegExp(PRODUCT_RELEASE_VERSION.replaceAll('.','\\.')));
  assert.equal(JSON.parse(rootPkg).version,'0.3.9-2-vercel.0');assert.equal(JSON.parse(webPkg).version,'0.0.0-private.0');
  assert.notEqual(JSON.parse(rootPkg).version,PRODUCT_RELEASE_VERSION,'root package transport version is not the product release owner');
});
