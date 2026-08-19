(() => {
  const VERSION='4.0.0-migration5-shadow1';
  const headings=()=>Array.from(document.querySelectorAll('.page-banner h2'));
  const active=label=>headings().some(node=>node.textContent.trim()===label);

  function applyDefensiveAuditFallback(){
    if(!active('Defensive Audit'))return;
    window.__AVOID_DEFENSIVE_AUDIT_SOURCE_RUNTIME__?.shadow?.();
  }

  function applySplitFallback(){
    applyDefensiveAuditFallback();
  }

  applySplitFallback.__avoidV4SplitFallback=true;
  applySplitFallback.__avoidLegacyFallbackPhysicallyRetired=true;
  window.applyMechanicsAndDefensives=applySplitFallback;

  window.__AVOID_MECHANICS_DEFENSIVES_FALLBACK_OWNER__=Object.freeze({
    version:VERSION,
    writerPolicy:'defensive-source-parity-shadow-trigger',
    activeOwner:'public/mechanics-defensives-fallback-bridge-v4.js',
    mechanicsSourceOwner:'apps/web/src/features/mechanics/Mechanics.js',
    mechanicsRuntimeSource:'apps/web/src/features/mechanics/runtime.js',
    mechanicsRuntimeTransport:'public/mechanics-runtime.js',
    mechanicsPresentationOwnerLive:true,
    defensiveAuditSourceOwner:'apps/web/src/features/defensive-audit/DefensiveAudit.js',
    defensiveAuditRuntimeSource:'apps/web/src/features/defensive-audit/runtime.js',
    defensiveAuditRuntimeTransport:'public/defensive-audit-runtime.js',
    historicalWriters:Object.freeze(['applyMechanicsAndDefensives','applyTelemetryMechanics','applyIntelligenceMechanics','applyTelemetryDefensives','applyIntelligenceDefensives']),
    fallbackLegacyPhysicallyRetired:true,
    defensiveParityShadow:true,
    directRequests:0,
    timers:0,
    observers:0,
  });

  console.info(`[AvoiD Raid Ops] Mechanics/Defensive ownership bridge ${VERSION}`);
})();
