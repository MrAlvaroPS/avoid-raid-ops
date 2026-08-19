import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');

test('CRITICAL v3.9.12 RAID WATCH: raw WCL 429 becomes a timed checkpoint instead of killing the watcher',async()=>{
  const source=await read('scripts/iris-prepare-raid.mjs');
  assert.match(source,/isRawWcl429/);
  assert.match(source,/WCL GraphQL 429/);
  assert.match(source,/Too many requests from this IP address/);
  assert.match(source,/start-corpus/);
  assert.match(source,/step-corpus/);
  assert.match(source,/rehearsal/);
  assert.match(source,/WATCH SLEEP · WCL checkpoint\/throttle/);
  assert.match(source,/rawWcl429IsTransientCheckpoint:true/);
  assert.doesNotMatch(source,/catch\(error\)\{throw error;\}/);
});

test('CRITICAL v3.9.12 REHEARSAL DIAGNOSTIC: zero-network preview exposes generated mechanic IDs and persisted corpus evidence',async()=>{
  const source=await read('server/corpus/operational-readiness-v1.mjs');
  assert.match(source,/packDiagnostics/);
  assert.match(source,/aggregateKey/);
  assert.match(source,/castIds/);
  assert.match(source,/failureAuraIds/);
  assert.match(source,/friendlySourceEvents/);
  assert.match(source,/encounterOrUnknownSourceEvents/);
  assert.match(source,/zeroNetwork:true/);
  assert.match(source,/packDiagnosticsFromPersistedAggregate:true/);
});
