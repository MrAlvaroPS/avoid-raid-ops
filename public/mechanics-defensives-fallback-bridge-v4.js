(() => {
  const VERSION='4.0.0-migration2';
  const historicalNames=[
    'applyMechanicsAndDefensives',
    'applyTelemetryMechanics',
    'applyIntelligenceMechanics',
    'applyTelemetryDefensives',
    'applyIntelligenceDefensives',
  ];
  const legacy=Object.fromEntries(historicalNames.map(name=>[name,typeof window[name]==='function'?window[name]:null]));

  if(historicalNames.some(name=>typeof legacy[name]!=='function')){
    const missing=historicalNames.filter(name=>typeof legacy[name]!=='function');
    console.warn(`[AvoiD v4] Mechanics/Defensive bridge missing legacy writers: ${missing.join(', ')}`);
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

  function screenWriter(name,label){
    return function(...args){
      if(!active(label))return;
      return legacy[name].apply(this,args);
    };
  }

  applySplitFallback.__avoidV4SplitFallback=true;
  applySplitFallback.__avoidLegacyFallback=legacy.applyMechanicsAndDefensives;
  window.applyMechanicsAndDefensives=applySplitFallback;
  window.applyTelemetryMechanics=screenWriter('applyTelemetryMechanics','Mechanics Library');
  window.applyIntelligenceMechanics=screenWriter('applyIntelligenceMechanics','Mechanics Library');
  window.applyTelemetryDefensives=screenWriter('applyTelemetryDefensives','Defensive Audit');
  window.applyIntelligenceDefensives=screenWriter('applyIntelligenceDefensives','Defensive Audit');

  window.__AVOID_MECHANICS_DEFENSIVES_FALLBACK_OWNER__=Object.freeze({
    version:VERSION,
    writerPolicy:'split-screen-writer-shadow',
    activeOwner:'public/mechanics-defensives-fallback-bridge-v4.js',
    mechanicsSourceOwner:'apps/web/src/features/mechanics/Mechanics.js',
    defensiveAuditSourceOwner:'apps/web/src/features/defensive-audit/DefensiveAudit.js',
    historicalWriters:Object.freeze([...historicalNames]),
    directRequests:0,
    timers:0,
    observers:0,
  });

  console.info(`[AvoiD Raid Ops] Mechanics/Defensive ownership bridge ${VERSION}`);
})();
