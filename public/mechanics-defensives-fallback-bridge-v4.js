(() => {
  const VERSION='4.0.0-migration1';
  const legacy=typeof window.applyMechanicsAndDefensives==='function'?window.applyMechanicsAndDefensives:null;

  if(!legacy){
    console.warn('[AvoiD v4] Mechanics/Defensive fallback bridge could not find the legacy writer.');
    return;
  }

  const headings=()=>Array.from(document.querySelectorAll('.page-banner h2'));
  const active=label=>headings().some(node=>node.textContent.trim()===label);
  const stats=()=>Array.from(document.querySelectorAll('.stats-row .stat'));

  function setPending(card,reason){
    const label=card.querySelector('label')?.textContent.trim();
    if(!label)return;
    const value=card.querySelector('div > b');
    const delta=card.querySelector('div > em');
    const meta=card.querySelector(':scope > small');
    if(value)value.textContent='—';
    if(delta)delta.textContent='PENDING';
    if(meta)meta.textContent=reason;
  }

  function applyMechanicsFallback(){
    // Preserve the historical selector exactly during the shadow checkpoint.
    if(!active('Mechanics'))return;
    stats().forEach(card=>setPending(card,'Encounter rule pack required'));
  }

  function applyDefensiveAuditFallback(){
    if(!active('Defensive Audit'))return;
    stats().forEach(card=>setPending(card,'Cooldown reconstruction required'));
  }

  function applySplitFallback(){
    applyMechanicsFallback();
    applyDefensiveAuditFallback();
  }

  applySplitFallback.__avoidV4SplitFallback=true;
  applySplitFallback.__avoidLegacyFallback=legacy;
  window.applyMechanicsAndDefensives=applySplitFallback;
  window.__AVOID_MECHANICS_DEFENSIVES_FALLBACK_OWNER__=Object.freeze({
    version:VERSION,
    writerPolicy:'split-screen-fallback-writer',
    mechanicsOwner:'apps/web/src/features/mechanics/Mechanics.js',
    defensiveAuditOwner:'apps/web/src/features/defensive-audit/DefensiveAudit.js',
    historicalWriter:'applyMechanicsAndDefensives',
    directRequests:0,
    timers:0,
    observers:0,
  });

  console.info(`[AvoiD Raid Ops] Mechanics/Defensive fallback bridge ${VERSION}`);
})();
