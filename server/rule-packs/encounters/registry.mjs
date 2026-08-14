import { BELOREN, BELOREN_ENCOUNTER_ID } from './beloren/index.mjs';
const PACKS = new Map([[BELOREN_ENCOUNTER_ID, BELOREN]]);
export function getEncounterRulePack(encounterId){ return PACKS.get(Number(encounterId)) || null; }
export function hasEncounterRulePack(encounterId){ return PACKS.has(Number(encounterId)); }
export function listEncounterRulePacks(){ return [...PACKS.values()]; }
