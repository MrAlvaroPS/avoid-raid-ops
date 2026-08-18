const asset=(id,src,owner,domain,role,retirement,extra={})=>Object.freeze({id,src,owner,domain,role,retirement,...extra});

export const ACTIVE_ASSET_MANIFEST_VERSION='active-assets-v1';

export const CSS_BUNDLE_SOURCES=Object.freeze([
  asset('css-v34','/raidops-v34.css?v=3.4.2','compatibility-cascade','cross-screen','readability-composition-data-truth-bootstrap-overlay','visual-equivalence-required',{authority:'source-layer'}),
  asset('css-v35','/raidops-v35.css?v=3.6.2','mechanics-corpus','mechanics','corpus-workbench-overlay','visual-equivalence-required',{authority:'source-layer'}),
  asset('css-v37','/raidops-v37.css?v=3.7.0','mechanics-corpus','mechanics','corpus-learning-overlay','visual-equivalence-required',{authority:'source-layer'}),
  asset('css-v373','/raidops-v373.css?v=3.7.3','mechanics-corpus','mechanics','encounter-intelligence-v373-overlay','visual-equivalence-required',{authority:'source-layer'}),
  asset('css-v374','/raidops-v374.css?v=3.7.4','mechanics-corpus','mechanics','encounter-live-status-overlay','visual-equivalence-required',{authority:'source-layer'}),
  asset('css-v375','/raidops-v375.css?v=3.7.5','mechanics-corpus','mechanics','encounter-readability-live-work-overlay','visual-equivalence-required',{authority:'source-layer'}),
  asset('css-v376','/raidops-v376.css?v=3.7.6','compatibility-cascade','cross-screen','global-readability-iris-storage-overlay','visual-equivalence-required',{authority:'source-layer'}),
  asset('css-v377','/raidops-v377.css?v=3.7.7','iris','cross-screen','corpus-standby-feedback-overlay','visual-equivalence-required',{authority:'source-layer'}),
  asset('css-v378','/raidops-v378.css?v=3.7.8','progress','progress','progress-control-room-overlay','visual-equivalence-required',{authority:'source-layer'}),
  asset('css-v379','/raidops-v379.css?v=3.7.9','progress','progress','progress-historical-live-boundary-overlay','visual-equivalence-required',{authority:'source-layer'}),
  asset('css-v3710','/raidops-v3710.css?v=3.7.10','progress','progress','strategic-progress-explicit-controls-overlay','visual-equivalence-required',{authority:'source-layer'}),
  asset('css-v3711','/raidops-v3711.css?v=3.7.11','progress','progress','canonical-progress-readonly-indicators-overlay','visual-equivalence-required',{authority:'source-layer'}),
  asset('css-v3712','/raidops-v3712.css?v=3.7.12','progress','progress','progress-data-integrity-overlay','visual-equivalence-required',{authority:'source-layer'}),
  asset('css-v3713','/raidops-v3713.css?v=3.8.5','progress','progress','progress-readability-overlay','visual-equivalence-required',{authority:'source-layer'}),
  asset('css-v386','/raidops-v386.css?v=3.8.6','players','players','player-dossier-overlay','visual-equivalence-required',{authority:'source-layer'}),
  asset('css-v390','/raidops-v390.css?v=3.9.0','data-platform','cross-screen','shared-card-rhythm-data-activity-shell-overlay','visual-equivalence-required',{authority:'source-layer'}),
  asset('css-v392','/raidops-v392.css?v=3.9.2','players','players','players-dossier-reliability-hotfix-overlay','visual-equivalence-required',{authority:'source-layer'}),
]);

export const ACTIVE_STYLES=Object.freeze([
  asset('golden-css','/main.css','golden-shell','shell','immutable-golden-base','never',{authority:'base'}),
  asset('active-css-bundle','/raidops-active.css?v=3.9.2-css1','compatibility-cascade','cross-screen','generated-exact-compatibility-cascade','regenerate-from-source-manifest',{authority:'generated-bundle'}),
]);

export const ACTIVE_LOCAL_SCRIPTS=Object.freeze([
  asset('golden-runtime','/main.js','golden-shell','shell','immutable-golden-runtime','never',{authority:'base'}),
  asset('wcl-bootstrap','/wcl-bootstrap-v389.js?v=3.8.9.1','bootstrap','bootstrap','request-safety-shell-release-bridge','migrate-to-source-module',{authority:'primary'}),
  asset('data-hub','/data-hub-v390.js?v=3.9.0','data-platform','data-platform','data-mode-cache-activity-live-operations','migrate-to-source-module',{authority:'primary'}),
  asset('knowledge-reindex','/knowledge-reindex-v390.js?v=3.9.0','knowledge','knowledge','browser-derived-snapshot-invalidation','migrate-to-source-module',{authority:'primary'}),
  asset('wcl-legacy-runtime','/wcl-runtime.js?v=3.8.5','legacy-wcl-runtime','wcl-compatibility','legacy-wcl-screen-writers-and-compatibility','decompose-per-domain-before-retirement',{authority:'compatibility'}),
  asset('command-center-history-bridge','/command-center-history-bridge-v4.js?v=4.0.0-migration1','command-center','command-center','command-center-progression-and-history-writer','move-to-command-center-source-owner',{authority:'migration-bridge'}),
  asset('encounter-intelligence','/encounter-intelligence-v375.js?v=3.8.5','mechanics-corpus','mechanics','encounter-corpus-intelligence-ui','migrate-to-source-module',{authority:'primary',family:'encounter-intelligence'}),
  asset('progress-runtime','/progress-runtime-v3713.js?v=3.8.5','progress','progress','canonical-strategic-progress-owner','migrate-to-source-module',{authority:'primary',family:'progress-runtime'}),
  asset('iris-runtime','/iris-runtime-v3713.js?v=3.8.9.1','iris','iris','cross-screen-intelligence-and-operations-bridge','migrate-to-source-module',{authority:'primary',family:'iris-runtime'}),
  asset('player-intelligence','/player-intelligence-v392.js?v=3.9.2','players','players','canonical-player-dossier-owner','migrate-to-source-module',{authority:'primary',family:'player-intelligence'}),
]);

export const ACTIVE_EXTERNAL_SCRIPTS=Object.freeze([
  asset('wowhead-tooltips','https://wow.zamimg.com/js/tooltips.js','reference-enrichment','wowhead-reference','tooltip-reference-enrichment','provider-reference-only',{authority:'reference-only'}),
]);

export const RUNTIME_FAMILIES=Object.freeze([
  Object.freeze({id:'encounter-intelligence',pattern:/^encounter-intelligence-v\d+\.js$/,activeFile:'encounter-intelligence-v375.js',owner:'mechanics-corpus'}),
  Object.freeze({id:'progress-runtime',pattern:/^progress-runtime-v\d+\.js$/,activeFile:'progress-runtime-v3713.js',owner:'progress'}),
  Object.freeze({id:'iris-runtime',pattern:/^iris-runtime-v\d+\.js$/,activeFile:'iris-runtime-v3713.js',owner:'iris'}),
  Object.freeze({id:'player-intelligence',pattern:/^player-intelligence-v\d+\.js$/,activeFile:'player-intelligence-v392.js',owner:'players'}),
]);

export const HISTORICAL_ONLY_ASSETS=Object.freeze([
  '/raidops-v32.css','/raidops-v33.css','/raidops-v371.css','/raidops-v372.css',
  '/encounter-intelligence-v371.js','/encounter-intelligence-v372.js','/encounter-intelligence-v373.js','/encounter-intelligence-v374.js',
  '/progress-runtime-v378.js','/progress-runtime-v379.js','/progress-runtime-v3710.js','/progress-runtime-v3711.js','/progress-runtime-v3712.js',
  '/iris-runtime-v376.js','/iris-runtime-v377.js','/iris-runtime-v378.js','/iris-runtime-v379.js','/iris-runtime-v3710.js','/iris-runtime-v3711.js','/iris-runtime-v3712.js',
  '/player-intelligence-v386.js',
]);

export const ACTIVE_ASSET_MANIFEST=Object.freeze({
  version:ACTIVE_ASSET_MANIFEST_VERSION,
  styles:ACTIVE_STYLES,
  cssBundleSources:CSS_BUNDLE_SOURCES,
  localScripts:ACTIVE_LOCAL_SCRIPTS,
  externalScripts:ACTIVE_EXTERNAL_SCRIPTS,
  runtimeFamilies:RUNTIME_FAMILIES,
  historicalOnly:HISTORICAL_ONLY_ASSETS,
});
