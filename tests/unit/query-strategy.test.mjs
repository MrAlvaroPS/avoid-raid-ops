import test from "node:test";
import assert from "node:assert/strict";
import { LIST_GUILD_REPORTS_QUERY, REPORT_HISTORY_FIGHTS_QUERY } from "../../server/wcl/queries/history.mjs";
import { TELEMETRY_EVENTS_QUERY, COMBATANT_INFO_QUERY } from "../../server/wcl/queries/telemetry.mjs";

test("history report listing does not embed fights",()=>{assert.ok(LIST_GUILD_REPORTS_QUERY.includes("reports("));assert.ok(!LIST_GUILD_REPORTS_QUERY.includes("fights("));assert.ok(REPORT_HISTORY_FIGHTS_QUERY.includes("fights("));});
test("telemetry does not fetch unfiltered buff events",()=>{assert.ok(!/events\(dataType:Buffs/.test(TELEMETRY_EVENTS_QUERY));});
test("enemy casts are scoped explicitly for mechanic timing",()=>{assert.match(TELEMETRY_EVENTS_QUERY,/bestEnemyCasts:events\(dataType:Casts[^)]*hostilityType:Enemies/);});
test("combatant info is scoped to the best pull for roster gear and talents",()=>{assert.match(COMBATANT_INFO_QUERY,/bestCombatantInfo:events\(dataType:CombatantInfo/);});
test("death semantics use a WCL wipe cutoff in addition to raw death events",()=>{assert.match(TELEMETRY_EVENTS_QUERY,/meaningfulDeaths:events\(dataType:Deaths[^)]*wipeCutoff:5/);});

import { buildPullSummaryQuery } from "../../server/wcl/queries/pull-summaries.mjs";
test("pull intelligence batches summary tables rather than fetching all events per pull",()=>{const q=buildPullSummaryQuery([1,2,3]);assert.match(q,/p1:table\(dataType:Summary,fightIDs:\[1\]\)/);assert.match(q,/p3:table\(dataType:Summary,fightIDs:\[3\]\)/);assert.ok(!q.includes("events("));});


import { ENCOUNTER_INTELLIGENCE_QUERY } from "../../server/wcl/queries/intelligence.mjs";
test("v3.4 intelligence queries meaningful deaths with WCL wipe cutoff",()=>{
  assert.match(ENCOUNTER_INTELLIGENCE_QUERY,/meaningfulDeaths:events\(dataType:Deaths[^)]*wipeCutoff:5/);
});

import { FEATHER_DEBUFF_PAGE_QUERY,FEATHER_BUFF_PAGE_QUERY } from "../../server/wcl/queries/intelligence.mjs";
test("v3.4.2 Feather assignment queries are filtered and independently pageable",()=>{
  assert.match(ENCOUNTER_INTELLIGENCE_QUERY,/featherDebuffs:events\(dataType:Debuffs[^)]*filterExpression:\$featherFilter/);
  assert.match(ENCOUNTER_INTELLIGENCE_QUERY,/featherBuffs:events\(dataType:Buffs[^)]*filterExpression:\$featherFilter/);
  assert.match(FEATHER_DEBUFF_PAGE_QUERY,/startTime:\$start/);
  assert.match(FEATHER_BUFF_PAGE_QUERY,/startTime:\$start/);
  assert.ok(!ENCOUNTER_INTELLIGENCE_QUERY.includes('friendlyAuras:events'));
});
