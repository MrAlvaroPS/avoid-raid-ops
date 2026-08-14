/**
 * Belo'ren, Child of Al'ar — Mythic encounter knowledge pack.
 *
 * WCL remains the combat source of truth. This pack only supplies semantics:
 * mechanic identity, safe inference rules, normalized occurrence units and
 * Wowhead detail links.
 *
 * v2026.08.14-3 corrections:
 * - 1241313 is Belo'ren's normal Rebirth/intermission, never an Ember failure.
 * - 1263412 is the Ember Rebirth that may complete if an egg is not killed.
 * - Feather ingestion is restricted to the two actual assignment auras.
 * - Mythic Quills are splash-aware and are not player-scored until the direct
 *   interceptor can be proven from WCL evidence.
 */

export const BELOREN_ENCOUNTER_ID = 3182;
const wowheadSpell = id => `https://www.wowhead.com/spell=${id}`;

export const BELOREN = Object.freeze({
  id: BELOREN_ENCOUNTER_ID,
  slug: 'beloren-child-of-alar',
  name: "Belo'ren, Child of Al'ar",
  difficulty: 5,
  version: '2026.08.14-3',
  phaseModel: {
    type: 'repeating-semantic-phases',
    semanticSequence: [1, 2, 1],
    labels: { 1: 'Phoenix Reborn', 2: 'Ashen Shell' },
    notes: 'WCL can emit 1 → 2 → 1; Raid Ops scores absolute stages separately from semantic phase IDs.'
  },
  auras: {
    lightFeather: { ids: [1241162], name: 'Light Feather', color: 'LIGHT', wowhead: wowheadSpell(1241162) },
    voidFeather: { ids: [1241163], name: 'Void Feather', color: 'VOID', wowhead: wowheadSpell(1241163) }
  },
  mechanics: [
    {
      key: 'voidlight-convergence', name: 'Voidlight Convergence', category: 'raid-damage', stage: 'PHOENIX',
      castIds: [1242515], damageIds: [1241932], severity: 2, scoreable: false,
      inference: 'pressure-window', expectedAction: 'Establish Light/Void assignments and cover the raid-damage window.',
      wowhead: wowheadSpell(1242515)
    },
    {
      key: 'light-dive', name: 'Light Dive', category: 'soak', stage: 'PHOENIX',
      castIds: [1241292], damageIds: [1241291,1241292], requiredColor: 'LIGHT', severity: 3, scoreable: true,
      inference: 'wrong-color-impact', expectedAction: 'Only Light-assigned players should participate in the soak.',
      wowhead: wowheadSpell(1241292), occurrenceWindowMs: 12000
    },
    {
      key: 'void-dive', name: 'Void Dive', category: 'soak', stage: 'PHOENIX',
      castIds: [1241339], damageIds: [1241340,1241339], requiredColor: 'VOID', severity: 3, scoreable: true,
      inference: 'wrong-color-impact', expectedAction: 'Only Void-assigned players should participate in the soak.',
      wowhead: wowheadSpell(1241339), occurrenceWindowMs: 12000
    },
    {
      key: 'infused-quills-light', name: 'Light Quill', category: 'intercept', stage: 'PHOENIX',
      // 1241992 = targeted channeled Light Quill, 1242232 = missile trigger, 1263430 = hidden helper.
      castIds: [1241992,1242232,1263430], damageIds: [1242093], requiredColor: 'LIGHT', severity: 4, scoreable: false,
      inference: 'quill-splash-observed', expectedAction: 'A Light-assigned player intercepts the Light quill; non-interceptors avoid Mythic splash.',
      wowhead: wowheadSpell(1242093)
    },
    {
      key: 'infused-quills-void', name: 'Void Quill', category: 'intercept', stage: 'PHOENIX',
      // 1242091 = targeted channeled Void Quill, 1242234 = missile trigger, 1263435 = hidden helper.
      castIds: [1242091,1242234,1263435], damageIds: [1242094], requiredColor: 'VOID', severity: 4, scoreable: false,
      inference: 'quill-splash-observed', expectedAction: 'A Void-assigned player intercepts the Void quill; non-interceptors avoid Mythic splash.',
      wowhead: wowheadSpell(1242094)
    },
    {
      key: 'radiant-echoes', name: 'Radiant Echoes', category: 'orb-management', stage: 'PHOENIX',
      castIds: [1242981], relatedIds: [1243021,1243026], failureDamageIds: [1243866], severity: 5, scoreable: true,
      inference: 'failure-damage-by-occurrence', expectedAction: 'Clear matching-color orbs; avoid opposite-color contact and boss collisions.',
      wowhead: wowheadSpell(1242981), occurrenceWindowMs: 52000
    },
    {
      key: 'guardian-edict', name: "Guardian's Edict", category: 'tank-assignment', stage: 'PHOENIX',
      // Count the actual Light/Void cone casts as opportunities. 1260826 is the
      // boss empowerment that explicitly signals an unsoaked/opposite-colour Edict.
      castIds: [1261217,1261218,1241640,1260763], opportunityCastIds: [1261217,1261218], failureAuraIds: [1260826],
      severity: 5, scoreable: true, inference: 'failure-aura-is-failure',
      expectedAction: 'The tank with the matching color soaks the matching frontal; no cone should go unsoaked.',
      wowhead: wowheadSpell(1260826), occurrenceWindowMs: 6000
    },
    {
      key: 'light-eruption', name: 'Light Eruption', category: 'interrupt', stage: 'PHOENIX',
      castIds: [1243852], damageIds: [1243852], requiredColor: 'LIGHT', severity: 5, scoreable: true,
      inference: 'completed-damage-is-failure', expectedAction: 'A Light-assigned player interrupts the cast.',
      wowhead: wowheadSpell(1243852), occurrenceWindowMs: 10000
    },
    {
      key: 'void-eruption', name: 'Void Eruption', category: 'interrupt', stage: 'PHOENIX',
      castIds: [1243854], damageIds: [1243854], requiredColor: 'VOID', severity: 5, scoreable: true,
      inference: 'completed-damage-is-failure', expectedAction: 'A Void-assigned player interrupts the cast.',
      wowhead: wowheadSpell(1243854), occurrenceWindowMs: 10000
    },
    {
      key: 'ember-rebirth', name: 'Ember Rebirth', category: 'add-priority', stage: 'PHOENIX',
      castIds: [1263412], severity: 5, scoreable: true, inference: 'completed-cast-is-failure',
      expectedAction: 'Kill the ember egg before Rebirth completes.', wowhead: wowheadSpell(1263412), occurrenceWindowMs: 35000
    },
    {
      key: 'boss-rebirth', name: "Belo'ren Rebirth", category: 'phase-transition', stage: 'ASHEN',
      castIds: [1241313], severity: 1, scoreable: false, inference: 'phase-transition-observed',
      expectedAction: "Burn Belo'ren's ashen egg during the intermission; this cast is a normal encounter transition, not an Ember failure.",
      wowhead: wowheadSpell(1241313)
    },
    {
      key: 'death-drop', name: 'Death Drop', category: 'positioning', stage: 'TRANSITION',
      castIds: [1246709], damageIds: [1246709], severity: 3, scoreable: false, inference: 'damage-distribution-only',
      expectedAction: 'Move away from the center before impact.', wowhead: wowheadSpell(1246709)
    },
    {
      key: 'incubation-light', name: 'Light Flames', category: 'match', stage: 'ASHEN',
      castIds: [1242792], damageIds: [1242803], requiredColor: 'LIGHT', severity: 5, scoreable: true,
      // The same spell applies a 10s periodic aura only to the opposing colour.
      inference: 'opposite-color-periodic', expectedAction: 'Move into the Light area while assigned Light.',
      wowhead: wowheadSpell(1242803), occurrenceWindowMs: 12000
    },
    {
      key: 'incubation-void', name: 'Void Flames', category: 'match', stage: 'ASHEN',
      castIds: [1242792], damageIds: [1242815], requiredColor: 'VOID', severity: 5, scoreable: true,
      inference: 'opposite-color-periodic', expectedAction: 'Move into the Void area while assigned Void.',
      wowhead: wowheadSpell(1242815), occurrenceWindowMs: 12000
    },
    {
      key: 'burning-heart', name: 'Burning Heart', category: 'raid-damage', stage: 'ALL',
      damageIds: [1264650,1283067], severity: 2, scoreable: false, inference: 'pressure-window',
      expectedAction: 'Plan healing/defensive coverage; pressure accelerates during Ashen Shell.', wowhead: wowheadSpell(1283067)
    },
    {
      key: 'eternal-burns', name: 'Eternal Burns', category: 'healing-absorb', stage: 'PHOENIX',
      auraIds: [1244344,1244348,1264698,1266404], severity: 3, scoreable: false, inference: 'duration-analysis',
      expectedAction: 'Heal absorbs promptly while respecting Light/Void assignments.', wowhead: wowheadSpell(1244344)
    },
    {
      key: 'ashen-benediction', name: 'Ashen Benediction', category: 'stacking-pressure', stage: 'ASHEN',
      auraIds: [1262573], damageIds: [1262573], severity: 2, scoreable: false, inference: 'stack-count',
      expectedAction: 'Minimize encounter length as healing reduction stacks after egg phases.', wowhead: wowheadSpell(1262573)
    }
  ]
});

export function allIds(field){
  return [...new Set(BELOREN.mechanics.flatMap(m=>m[field]||[]).map(Number).filter(Number.isFinite))];
}

export const BELOREN_FILTERS = Object.freeze({
  damage: [...new Set([...allIds('damageIds'),...allIds('failureDamageIds')])],
  casts: [...new Set([...allIds('castIds'),...allIds('opportunityCastIds')])],
  enemyBuffs: allIds('failureAuraIds'),
  // Keep assignment ingestion intentionally narrow. Other friendly auras are
  // not needed by the v3.4.2 mechanic engine and can create huge event pages.
  friendlyAuras: [1241162,1241163]
});
