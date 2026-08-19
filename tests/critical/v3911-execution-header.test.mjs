import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');

test('CRITICAL v3.9.11 FIRST LOAD: HOME history reader is physically isolated from WCL network code',async()=>{
  const [reader,refresh,service,index]=await Promise.all([read('server/engines/home-history-read-v1.mjs'),read('server/engines/home-history-refresh-v1.mjs'),read('server/services/home-history-service.mjs'),read('index.html')]);
  assert.doesNotMatch(reader,/wclGraphql|graphql-client|CURRENT_HISTORY_REPORT_QUERY|LIST_GUILD_REPORTS_QUERY/);
  assert.match(reader,/networkExecuted:false/);assert.match(reader,/wclCallsExecuted:0/);assert.match(reader,/readPathWclNetwork:false/);
  assert.match(refresh,/wclGraphql/);assert.match(refresh,/explicitRefresh:true/);
  assert.match(service,/req\.method===['"]GET['"]/);assert.match(service,/getPersistedAvoidHistoryIndexV1/);assert.match(service,/req\.method===['"]POST['"]/);assert.match(service,/confirmExecution:true is required/);
  assert.doesNotMatch(index,/\/wcl-runtime\.js/);assert.doesNotMatch(index,/\/wcl-bootstrap-v389\.js/);
  assert.match(index,/avoid-execution-context-v3911\.js\?v=3\.9\.11\.2/);assert.match(index,/WCL stays idle until you explicitly refresh history or load a report/);
});

test('CRITICAL v3.9.11 HEADER: pull selection, explicit history refresh and active live report are independent controls',async()=>{
  const [runtime,css,context,doc]=await Promise.all([read('public/avoid-execution-context-v3911.js'),read('public/raidops-v3911-execution.css'),read('server/execution/execution-context-v1.mjs'),read('docs/AVOID-EXECUTION-CONTEXT-V1.md')]);
  assert.match(runtime,/AVOID HISTORY/);assert.match(runtime,/ACTIVE WCL REPORT/);assert.match(runtime,/data-exec-refresh/);assert.match(runtime,/data-exec-live/);assert.match(runtime,/data-exec-launch/);assert.match(runtime,/data-exec-stop/);
  assert.match(runtime,/waitingForFirstCombat/);assert.match(runtime,/POLL_WAITING_MS=30000/);assert.match(runtime,/POLL_ACTIVE_MS=15000/);assert.match(runtime,/pullSelection:\{mode:['"]all['"]/);
  assert.match(runtime,/activeReportDoesNotMutateHomeHistory:true/);assert.match(runtime,/pullSelectionIsConsumerOptIn:true/);assert.match(runtime,/firstPageWclNetworkAllowed:false/);assert.match(runtime,/activeReportNeverFetchesHomeHistory:true/);
  assert.match(runtime,/window\.__AVOID_WCL_HISTORY__=state\.historyScope/);assert.match(runtime,/window\.__AVOID_ACTIVE_REPORT__=state\.activeReport/);assert.match(runtime,/window\.__AVOID_PULL_SELECTION__=state\.pullSelection/);
  assert.match(runtime,/function installControls/);assert.match(runtime,/setInterval\(maintainShell,750\)/);assert.match(runtime,/historyRefreshing/);
  assert.match(css,/avoid-exec-group\.history/);assert.match(css,/avoid-exec-group\.active/);
  assert.match(context,/difficultyClassifiedPerFight:true/);assert.match(context,/emptyLiveReportIsNotFailure:true/);
  assert.match(doc,/A report\/pull selector is not a global application filter/);
});

test('CRITICAL v3.9.11 ACTIVE DATA: manifest controls rich report hydration and Active Report never calls HOME history',async()=>{
  const runtime=await read('public/avoid-execution-context-v3911.js');
  assert.match(runtime,/function activeHydrationKeys/);assert.match(runtime,/lastReportHydrationKey/);assert.match(runtime,/lastTelemetryHydrationKey/);
  assert.match(runtime,/new URL\(['"]\/api\/wcl\/report['"]/);assert.match(runtime,/new URL\(['"]\/api\/wcl\/telemetry['"]/);
  assert.doesNotMatch(runtime,/new URL\(['"]\/api\/wcl\/history['"]/);
  assert.match(runtime,/if\(keys\.telemetryKey/);assert.match(runtime,/completed-pull only/);
  assert.match(runtime,/window\.__AVOID_ACTIVE_REPORT_DATA__=state\.activeData/);assert.match(runtime,/avoid:active-report-data/);
});

test('CRITICAL v3.9.11 HISTORY: persisted HOME reports keep boss+difficulty per fight and exclude in-progress pulls from historical selector',async()=>{
  const [store,reader,refresh]=await Promise.all([read('server/home/history-store-v1.mjs'),read('server/engines/home-history-read-v1.mjs'),read('server/engines/home-history-refresh-v1.mjs')]);
  assert.match(store,/difficulty:Number\(row\.difficulty\)/);assert.match(store,/scopeKey:key/);
  assert.match(reader,/if\(fight\.inProgress\|\|!/);assert.match(reader,/key:`\$\{report\.reportCode\}:\$\{fight\.id\}`/);
  assert.match(refresh,/reportNeedsRefresh/);assert.match(refresh,/changed\.slice\(-limit\)/);assert.match(refresh,/wclCombatEventCalls:0/);
});
