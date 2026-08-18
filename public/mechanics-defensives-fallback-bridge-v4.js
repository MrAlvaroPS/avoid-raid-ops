(() => {
  const VERSION='4.0.0-migration4-owner1';
  const defensiveWriters=[
    'applyTelemetryDefensives',
    'applyIntelligenceDefensives',
  ];
  const legacy=Object.fromEntries(defensiveWriters.map(name=>[name,typeof window[name]==='function'?window[name]:null]));

  if(defensiveWriters.some(name=>typeof legacy[name]!=='function')){
    const missing=defensiveWriters.filter(name=>typeof legacy[name]!=='function');
    console.warn(`[AvoiD v4] Defensive bridge missing legacy writers: ${missing.join(', ')}`);
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

  function applyDefensiveAuditFallback(){
    if(!active('Defensive Audit'))return;
    stats().forEach(card=>setPending(card,'Cooldown reconstruction required'));
  }

  function applySplitFallback(){
    applyDefensiveAuditFallback();
  }

  function screenWriter(name,label){
    return function(...args){
      if(!active(label))return;
      return legacy[name].apply(this,args);
    };
  }

  applySplitFallback.__avoidV4SplitFallback=true;
  applySplitFallback.__avoidLegacyFallbackPhysicallyRetired=true;
  window.applyMechanicsAndDefensives=applySplitFallback;
  window.applyTelemetryDefensives=screenWriter('applyTelemetryDefensives','Defensive Audit');
  window.applyIntelligenceDefensives=screenWriter('applyIntelligenceDefensives','Defensive Audit');

  window.__AVOID_MECHANICS_DEFENSIVES_FALLBACK_OWNER__=Object.freeze({
    version:VERSION,
    writerPolicy:'defensive-fallback-and-writer-shadow',
    activeOwner:'public/mechanics-defensives-fallback-bridge-v4.js',
    mechanicsSourceOwner:'apps/web/src/features/mechanics/Mechanics.js',
    mechanicsRuntimeSource:'apps/web/src/features/mechanics/runtime.js',
    mechanicsRuntimeTransport:'public/mechanics-runtime.js',
    mechanicsPresentationOwnerLive:true,
    defensiveAuditSourceOwner:'apps/web/src/features/defensive-audit/DefensiveAudit.js',
    historicalWriters:Object.freeze(['applyMechanicsAndDefensives','applyTelemetryMechanics','applyIntelligenceMechanics',...defensiveWriters]),
    fallbackLegacyPhysicallyRetired:true,
    defensiveWriterShadow:true,
    directRequests:0,
    timers:0,
    observers:0,
  });

  console.info(`[AvoiD Raid Ops] Mechanics/Defensive ownership bridge ${VERSION}`);
})();
