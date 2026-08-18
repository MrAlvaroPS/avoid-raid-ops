const responsibility=(id,domain,status,canonicalOwner,retirement,functions)=>Object.freeze({id,domain,status,canonicalOwner,retirement,functions:Object.freeze(functions)});

export const LEGACY_RUNTIME_OWNERSHIP_VERSION='legacy-runtime-ownership-v4';
export const LEGACY_RUNTIME_PATH='public/wcl-runtime.js';

export const LEGACY_RUNTIME_RESPONSIBILITIES=Object.freeze([
  responsibility('shared-dom-formatting','shared-ui','shared-helper','public/wcl-runtime.js','extract-to-browser-shared-module',[
    'fmtPct','fmtCompact','fmtDuration','fmtSeconds','text','ownText','findOwnText','panelByTitle','statByLabel','setStat','setPendingStat','setCompareCell','fmtDeltaPctPoints','setPanelSubtitle','pullSignalDelta','describePullSignal','renderWclGraph','clearSyntheticChart','refreshWowheadLinks','makeWowheadLink',
  ]),
  responsibility('shell-data-truth','shell','compatibility-guard','public/wcl-runtime.js','move-to-source-shell-and-data-truth-owner',[
    'applyShell','finishDataTruthBoot','applyDataTruthScrub','showError','scheduleReapply',
  ]),
  responsibility('command-center','command-center','compatibility-writer','public/wcl-runtime.js','move-to-command-center-source-owner',[
    'applyCommandCenter','applyTelemetryCoreCorrections','applyPullIntelligenceToCommand','applyIntelligenceCommandCenter',
  ]),
  responsibility('progress-compatibility-guard','progress','compatibility-guard','public/wcl-runtime.js','move-missing-history-policy-to-progress-owner',[
    'neutralizeMissingHistory',
  ]),
  responsibility('pull-lab','pull-lab','compatibility-writer','public/wcl-runtime.js','move-to-pull-lab-source-owner',[
    'applyPullLab',
  ]),
  responsibility('damage-healing','damage-healing','compatibility-writer','public/wcl-runtime.js','move-to-damage-healing-source-owner',[
    'applyDamageHealing','applyTelemetryDamageHealing',
  ]),
  responsibility('players','players','compatibility-support','public/player-intelligence-v392.js','separate-data-bridge-from-player-presentation-owner',[
    'applyPlayers','telemetryPlayerNameMap','roleLabel','playerOutput','reliabilityValue','reliabilityText','reliabilityMeta','applyTelemetryPlayers',
  ]),
  responsibility('mechanics-defensives','mechanics-defensives','compatibility-support','public/encounter-intelligence-v375.js','split-mechanics-and-defensives-before-retirement',[
    'applyMechanicsAndDefensives','applyTelemetryMechanics','applyTelemetryDefensives','applyIntelligenceMechanics','applyIntelligenceDefensives',
  ]),
  responsibility('composition','composition','compatibility-writer','public/wcl-runtime.js','move-to-composition-source-owner',[
    'applyComposition','classifyMelee','classKey','cleanTalentName','hasResolvedTalent','classDisplay','rosterCharacterMeta','removeRosterIntelligenceOutsideComposition','buildRosterIntelligencePanel','applyTelemetryComposition',
  ]),
  responsibility('live','live','compatibility-writer','public/wcl-runtime.js','move-to-live-source-owner',[
    'applyLive','applyLiveStatus','latestPullActorSignals','applyIntelligenceLive','pollLiveStatus','startStatusPolling',
  ]),
  responsibility('intelligence-bridge','iris-intelligence','compatibility-support','public/iris-runtime-v3713.js','split-domain-intelligence-bridges-before-retirement',[
    'confidenceLabel','intelligenceMechanicMap','playerNameById','applyIntelligence','applySupplemental',
  ]),
  responsibility('corpus-workbench','mechanics-corpus','compatibility-writer','public/encounter-intelligence-v375.js','move-workbench-controls-to-mechanics-owner-without-resuming-corpus',[
    'corpusCountdown','corpusContext','corpusRequest','refreshCorpusStatus','pollCorpus','corpusCell','corpusButton','applyCorpusWorkbench',
  ]),
  responsibility('network-orchestration','wcl-data-orchestration','compatibility-orchestrator','public/wcl-runtime.js','replace-with-domain-data-clients-after-writers-exit',[
    'applyAll','fetchJson','fetchData',
  ]),
]);

export const LEGACY_RUNTIME_PROGRESS_HISTORICAL_INTERCEPTS=Object.freeze(['applyProgressPage','applyProgressCurve','applyHistoryData','applyRealProgressMatrix']);
export const LEGACY_RUNTIME_PROGRESS_ACTIVE_INTERCEPTS=Object.freeze([]);
export const LEGACY_RUNTIME_PROGRESS_PHYSICALLY_RETIRED=Object.freeze(['applyProgressPage','applyProgressCurve','applyHistoryData','applyRealProgressMatrix']);

export const LEGACY_RUNTIME_OWNERSHIP=Object.freeze({
  version:LEGACY_RUNTIME_OWNERSHIP_VERSION,
  path:LEGACY_RUNTIME_PATH,
  responsibilities:LEGACY_RUNTIME_RESPONSIBILITIES,
  progressHistoricalIntercepts:LEGACY_RUNTIME_PROGRESS_HISTORICAL_INTERCEPTS,
  progressActiveIntercepts:LEGACY_RUNTIME_PROGRESS_ACTIVE_INTERCEPTS,
  progressPhysicallyRetired:LEGACY_RUNTIME_PROGRESS_PHYSICALLY_RETIRED,
});
