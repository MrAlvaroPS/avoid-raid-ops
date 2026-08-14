import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('v3.7.7 makes corpus action failures visible, including legacy Build Corpus', async () => {
  const runtime = await read('public/iris-runtime-v377.js');
  assert.match(runtime, /IRIS ACTION FAILED/);
  assert.match(runtime, /BUILD CORPUS/);
  assert.match(runtime, /NETWORK_ERROR/);
  assert.match(runtime, /info\.method!==['"]GET['"]/);
  assert.match(runtime, /renderActionIssue\(\)/);
});

test('v3.7.7 stops real corpus requests after a confirmed Blob block for the page session', async () => {
  const runtime = await read('public/iris-runtime-v377.js');
  assert.match(runtime, /if\(info\.isCorpus&&storageIssue\)return blockedResponse\(\)/);
  assert.match(runtime, /CORPUS_BLOB_READ_BLOCKED/);
  assert.match(runtime, /A reload performs one/);
  assert.match(runtime, /corpusReset:false/);
});

test('v3.7.7 checkpoint records the exact standby and multi-encounter restart contract', async () => {
  const checkpoint = await read('docs/CORPUS-STANDBY-2026-08-14.md');
  assert.match(checkpoint, /15\.1k \/ 10k/);
  assert.match(checkpoint, /2\.6k \/ 2k/);
  assert.match(checkpoint, /87% · MATURE/);
  assert.match(checkpoint, /5 Wide reports/);
  assert.match(checkpoint, /44 unverified/);
  assert.match(checkpoint, /multi-encounter/i);
  assert.match(checkpoint, /FULL REBUILD FROM RAW CORPUS/);
});

test('v3.7.7 assets remain available while a newer Iris runtime may be active', async () => {
  const index = await read('index.html');
  assert.match(index, /raidops-v377\.css\?v=3\.7\.7/);
  assert.match(index, /iris-runtime-v37(?:7|8)\.js\?v=3\.7\.(?:7|8)/);
  assert.doesNotMatch(index, /iris-runtime-v376\.js/);
});
