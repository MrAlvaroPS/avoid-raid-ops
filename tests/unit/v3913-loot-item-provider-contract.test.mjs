import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Loot item identity comes from Blizzard and Wowhead is reference-only',async()=>{
  const src=await readFile('server/loot/item-provider-v1.mjs','utf8');
  assert.match(src,/data\/wow\/search\/item/);
  assert.match(src,/data\/wow\/item\/\$\{id\}/);
  assert.match(src,/wowheadUrl/);
  assert.match(src,/negativeEvidence:false/);
});
