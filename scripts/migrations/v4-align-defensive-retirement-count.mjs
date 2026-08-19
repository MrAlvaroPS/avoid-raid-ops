import { readFile, writeFile, unlink } from 'node:fs/promises';

const verifier=new URL('../verify-legacy-runtime-ownership.mjs',import.meta.url);
const self=new URL(import.meta.url);
const before="expect(declared.length===64,`wcl-runtime.js must contain exactly 64 active function declarations after Progress, Players, Corpus and Mechanics presentation retirement; found ${declared.length}`);";
const after="expect(declared.length===62,`wcl-runtime.js must contain exactly 62 active function declarations after Progress, Players, Corpus, Mechanics and Defensive Audit presentation retirement; found ${declared.length}`);";
const source=await readFile(verifier,'utf8');
if(!source.includes(before))throw new Error('Expected pre-retirement function-count assertion not found; aborting without changes.');
if((source.match(/declared\.length===64/g)||[]).length!==1)throw new Error('Function-count assertion is not unique; aborting without changes.');
await writeFile(verifier,source.replace(before,after));
await unlink(self);
console.log('Aligned legacy runtime ownership count with the two approved Defensive Audit writer retirements.');
