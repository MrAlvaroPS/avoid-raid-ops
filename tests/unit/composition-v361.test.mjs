import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('Composition rebuilds all 13 retail class rows from canonical data', async()=>{
  const runtime=await read('../../deploy-preview/public/wcl-runtime.js');
  assert.match(runtime,/const WOW_CLASSES = \["DeathKnight","DemonHunter","Druid","Evoker","Hunter","Mage","Monk","Paladin","Priest","Rogue","Shaman","Warlock","Warrior"\]/);
  assert.match(runtime,/specGrid\.replaceChildren\(\)/);
  assert.match(runtime,/for\(const cls of WOW_CLASSES\)/);
});

test('Composition uses canonical WoW class colours and derives Monk utility gap', async()=>{
  const runtime=await read('../../deploy-preview/public/wcl-runtime.js');
  assert.match(runtime,/Monk:"#00FF98"/);
  assert.match(runtime,/DeathKnight:"#C41E3A"/);
  assert.match(runtime,/Shaman:"#0070DD"/);
  assert.match(runtime,/CLASS_UTILITY_GAPS = \{Monk:"Mystic Touch \(physical-damage vulnerability\)"\}/);
  assert.match(runtime,/utilityGaps=missing\.map/);
});
