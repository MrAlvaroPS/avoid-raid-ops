import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Loot ledger stays local/auditable until WoWAudit sync exists',async()=>{
  const src=await readFile('server/loot/ledger-v1.mjs','utf8');
  assert.match(src,/source:'local-ledger'/);
  assert.match(src,/futureSync:\['wowaudit'\]/);
  assert.match(src,/reportCode/);
  assert.match(src,/fightId/);
  assert.match(src,/difficultyName/);
});
