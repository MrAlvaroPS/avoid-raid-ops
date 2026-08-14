import test from 'node:test';
import assert from 'node:assert/strict';
import { wowheadItemRef,wowheadSpellRef,wowheadTalentRef,wowheadEncounterSearchRef } from '../../server/enrichment/wowhead.mjs';

test('Wowhead enrichment uses exact entity links when WCL provides entity IDs',()=>{
  const item=wowheadItemRef(250024,{itemLevel:289,gems:[123],enchants:[456]});
  assert.equal(item.url,'https://www.wowhead.com/item=250024');
  assert.match(item.dataWowhead,/item=250024/);
  assert.match(item.dataWowhead,/ilvl=289/);
  const spell=wowheadSpellRef(1241932);
  assert.equal(spell.url,'https://www.wowhead.com/spell=1241932');
  assert.equal(spell.mode,'exact');
});

test('talent node IDs are never pretended to be spell IDs',()=>{
  const talent=wowheadTalentRef({nodeId:82126,entryId:9001});
  assert.equal(talent.mode,'search');
  assert.match(talent.url,/wowhead\.com\/search/);
  assert.ok(!talent.url.includes('spell=82126'));
  assert.match(wowheadEncounterSearchRef("Belo'ren, Child of Al'ar").url,/wowhead\.com\/search/);
});
