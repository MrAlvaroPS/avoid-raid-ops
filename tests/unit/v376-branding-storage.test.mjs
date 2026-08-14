import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('v3.7.6 exposes Iris, Onie and the deployed release marker', async () => {
  const [runtime,index] = await Promise.all([
    read('public/iris-runtime-v376.js'),
    read('index.html'),
  ]);
  assert.match(runtime, /const RELEASE='3\.7\.6'/);
  assert.match(runtime, /const IRIS='Iris'/);
  assert.match(runtime, /const RAID_LEADER='Onie'/);
  assert.match(runtime, /corpusScope:'encounter\+difficulty\+partition'/);
  assert.match(index, /raidops-v376\.css\?v=3\.7\.6/);
  assert.match(index, /iris-runtime-v376\.js\?v=3\.7\.6/);
});

test('Blob 403 is classified without claiming corpus deletion', async () => {
  const storage = await read('server/corpus/storage.mjs');
  const route = await read('routes/api/wcl/corpus.js');
  assert.match(storage, /CORPUS_BLOB_READ_BLOCKED/);
  assert.match(storage, /corpusReset:false/);
  assert.match(storage, /Storage → Blob → Usage\/limits/);
  assert.match(route, /code:'CORPUS_BLOB_READ_BLOCKED'/);
  assert.match(route, /engineVersion: ENGINE_VERSION/);
});

test('Iris architecture remains explicitly multi-encounter', async () => {
  const architecture = await read('IRIS-ARCHITECTURE.md');
  assert.match(architecture, /Multi-encounter is a hard architectural invariant/);
  assert.match(architecture, /encounterId \+ difficulty \+ WCL partition/);
  assert.match(architecture, /before, during and after raid time/i);
  assert.match(architecture, /if \(encounterId === 3182\)/);
});
