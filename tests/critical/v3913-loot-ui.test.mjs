import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Loot is injected below Composition and keeps sim gain separate from award context',async()=>{
  const runtime=await readFile('public/loot-runtime-v3913.js','utf8');
  assert.match(runtime,/Composition/);
  assert.match(runtime,/insertAdjacentElement\('afterend'/);
  assert.match(runtime,/RUN RAID SIM/);
  assert.match(runtime,/Reliability/i);
  assert.match(runtime,/Attendance/i);
  assert.match(runtime,/Loot received/i);
  assert.match(runtime,/AWARD/);
  assert.match(runtime,/raid-only/i);
});
