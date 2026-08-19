(() => {
  const VERSION='4.0.0-migration5-owner1';

  function applySplitFallback(){}

  applySplitFallback.__avoidV4SplitFallback=true;
  applySplitFallback.__avoidLegacyFallbackPhysicallyRetired=true;
  window.applyMechanicsAndDefensives=applySplitFallback;

  window.__AVOID_MECHANICS_DEFENSIVES_FALLBACK_OWNER__=Object.freeze({
    version:VERSION,
    writerPolicy:'post-owner-retirement-hold-noop',
    activeOwner:'public/mechanics-defensives-fallback-bridge-v4.js',
    mechanicsSourceOwner:'apps/web/src/features/mechanics/Mechanics.js',
    mechanicsRuntimeSource:'apps/web/src/features/mechanics/runtime.js',
    mechanicsRuntimeTransport:'public/mechanics-runtime.js',
    mechanicsPresentationOwnerLive:true,
    defensiveAuditSourceOwner:'apps/web/src/features/defensive-audit/DefensiveAudit.js',
    defensiveAuditRuntimeSource:'apps/web/src/features/defensive-audit/runtime.js',
    defensiveAuditRuntimeTransport:'public/defensive-audit-runtime.js',
    defensiveAuditPresentationOwnerLive:true,
    historicalWriters:Object.freeze(['applyMechanicsAndDefensives','applyTelemetryMechanics','applyIntelligenceMechanics','applyTelemetryDefensives','applyIntelligenceDefensives']),
    fallbackLegacyPhysicallyRetired:true,
    defensiveParityShadow:false,
    directRequests:0,
    timers:0,
    observers:0,
  });

  console.info(`[AvoiD Raid Ops] Mechanics/Defensive ownership bridge ${VERSION}`);
})();
