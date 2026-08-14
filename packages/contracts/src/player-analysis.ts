import type { Confidence } from './metric';

export type WowheadRef = {
  url: string;
  dataWowhead?: string;
  mode?: 'exact' | 'search';
};

export type GearItemSnapshot = {
  id: number | null;
  name: string | null;
  slotId: number | null;
  slot: string | null;
  itemLevel: number | null;
  quality: number | null;
  gems: number[];
  enchants: number[];
  wowhead?: WowheadRef | null;
};

export type TalentSnapshot = {
  entryId: number | null;
  nodeId: number | null;
  spellId: number | null;
  rank: number | null;
  name: string | null;
  icon?: string | null;
  wowhead?: WowheadRef | null;
};

export type PlayerAnalysis = {
  actorId: number;
  name: string;
  className: string | null;
  spec: string | null;
  role: 'TANK' | 'HEAL' | 'DPS' | null;
  itemLevel: number | null;
  bestPull: {
    damage: number;
    dps: number;
    healing: number;
    hps: number;
    damageTaken: number;
    casts: number;
  };
  encounter: {
    pulls: number;
    deaths: number;
    meaningfulDeaths: number;
    firstDeaths: number;
    interrupts: number;
    dispels: number;
  };
  character: {
    gear: GearItemSnapshot[];
    gearCount: number;
    powerGearCount: number;
    /** Descriptive mean of item levels present in CombatantInfo, not equipped character ilvl. */
    recordedItemLevelMean: number | null;
    /** Kept null by design: averaging raw inventory rows is not a reliable equipped ilvl formula. */
    gearAverageItemLevel: null;
    talents: TalentSnapshot[];
    talentCount: number;
    talentPoints: number;
    buildFingerprint: string | null;
    source: string | null;
  };
  reliability: {
    value: number | null;
    status: 'pending' | 'calculated';
    confidence: Confidence;
    reason?: string;
  };
};
