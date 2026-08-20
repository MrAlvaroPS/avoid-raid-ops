import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');

test('CRITICAL v3.9.12 MECHANICS FREEZE: operational DOM mutations cannot recursively schedule the operational renderer',async()=>{
  const [guard,index,operational]=await Promise.all([
    read('public/avoid-operational-observer-guard-v3912.js'),
    read('index.html'),
    read('public/avoid-operational-ui-v3912.js'),
  ]);
  assert.match(operational,/new MutationObserver\(schedule\)\.observe\(document\.body,\{subtree:true,childList:true\}\)/);
  assert.match(guard,/closest\?\.\('\.avoid-operational-root'\)/);
  assert.match(guard,/window\.MutationObserver=NativeMutationObserver/);
  const guardAt=index.indexOf('/avoid-operational-observer-guard-v3912.js?v=3.9.12.1');
  const uiAt=index.indexOf('/avoid-operational-ui-v3912.js?v=3.9.12.1');
  assert.ok(guardAt>=0&&uiAt>guardAt,'observer guard must execute immediately before the operational UI runtime');

  let lastObserver=null,callbackCount=0;
  class FakeElement{
    constructor(operationalRoot=false){this.operationalRoot=operationalRoot;}
    closest(selector){return selector==='.avoid-operational-root'&&this.operationalRoot?this:null;}
  }
  class NativeMutationObserver{
    constructor(callback){this.callback=callback;lastObserver=this;}
    observe(){}
    disconnect(){}
  }
  const context=vm.createContext({window:{MutationObserver:NativeMutationObserver},Element:FakeElement,Object});
  context.window.window=context.window;
  new vm.Script(guard,{filename:'avoid-operational-observer-guard-v3912.js'}).runInContext(context);
  const Guarded=context.window.MutationObserver;
  const instance=new Guarded(()=>{callbackCount++;});
  assert.equal(context.window.MutationObserver,NativeMutationObserver,'native MutationObserver must be restored after the operational observer is constructed');
  assert.equal(instance,lastObserver);

  lastObserver.callback([{target:new FakeElement(true)}],lastObserver);
  assert.equal(callbackCount,0,'an innerHTML mutation produced by the operational root must not schedule another render');
  lastObserver.callback([{target:new FakeElement(false)}],lastObserver);
  assert.equal(callbackCount,1,'external SPA/React DOM mutations must still reach the operational observer');
});
