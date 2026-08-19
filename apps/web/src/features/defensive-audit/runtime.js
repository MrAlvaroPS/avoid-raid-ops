(() => {
  'use strict';

  const VERSION='4.0.0-migration5-shadow1';
  const qsa=(selector,root=document)=>root?[...root.querySelectorAll(selector)]:[];
  const text=(node,value)=>{
    if(!node||value===undefined||value===null)return;
    const next=String(value);
    if(node.textContent!==next)node.textContent=next;
  };
  const fmtDuration=value=>{
    const n=Number(value);
    if(!Number.isFinite(n))return '—';
    const total=Math.max(0,Math.round(n/1000));
    return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;
  };
  const panelByTitle=title=>qsa('.panel').find(panel=>qsa('.panel-title h3',panel).some(h=>h.textContent.trim()===title))||null;
  const defensiveAuditActive=()=>qsa('.page-banner h2').some(node=>node.textContent.trim()==='Defensive Audit');
  const telemetryState=()=>window.__AVOID_WCL_TELEMETRY__||null;
  const intelligenceState=()=>window.__AVOID_WCL_INTELLIGENCE__||null;
  const statByLabel=(label,root=document)=>qsa('.stat',root).find(card=>card.querySelector(':scope > label')?.textContent.trim()===label)||null;
  const setStat=(label,values,root=document)=>{
    const card=statByLabel(label,root);
    if(!card)return false;
    if('value' in values)text(card.querySelector('div > b'),values.value);
    if('delta' in values)text(card.querySelector('div > em'),values.delta);
    if('meta' in values)text(card.querySelector(':scope > small'),values.meta);
    return true;
  };
  const setPendingStat=(label,reason,root=document)=>setStat(label,{value:'—',delta:'PENDING',meta:reason},root);
  const setPanelSubtitle=(title,value)=>text(panelByTitle(title)?.querySelector('.panel-title p'),value);
  const confidenceLabel=value=>{
    const v=String(value||'unknown').toUpperCase();
    return ['CONFIRMED','HIGH','MEDIUM','LOW'].includes(v)?v:'UNKNOWN';
  };
  const playerNameById=(actorId,telemetry)=>{
    const id=Number(actorId);
    return (telemetry?.players||[]).find(player=>Number(player.actorId)===id)?.name||`Actor ${actorId}`;
  };

  function applyTelemetryDefensives(){
    const telemetry=telemetryState();
    if(!telemetry?.players?.length||!defensiveAuditActive())return;
    const dbanner=document.querySelector('.page-banner');
    if(dbanner){
      text(dbanner.querySelector('.badge'),'OBSERVED DEFENSIVE DATA');
      text(dbanner.querySelector(':scope > div > p'),'Deaths and observed consumable/cast data from WCL. Defensive availability and preventability remain pending until cooldown reconstruction.');
    }

    const banner=document.querySelector('.banner-stat');
    if(banner?.querySelector('label')?.textContent.trim()==='PREVENTABLE DEATHS'){
      text(banner.querySelector('b'),'—');
      text(banner.querySelector('small'),`${telemetry.deaths?.firstDeathCount??0} first deaths · ${telemetry.deaths?.meaningfulCount??0} before wipe cutoff`);
    }

    setPendingStat('PERSONAL COVERAGE','Defensive catalogue + cooldown reconstruction required');
    setPendingStat('HEALTHSTONE USE','Uses detectable; eligible-opportunity rate pending');
    setPendingStat('HEALING POTION USE','Uses detectable; eligible-opportunity rate pending');
    setPendingStat('DIED WITH PERSONAL','Availability cannot yet be asserted');
    setPendingStat('DIED WITH CONSUMABLE','Inventory cannot be proven by WCL');

    const panel=panelByTitle('Player defensive accountability');
    if(panel){
      setPanelSubtitle('Player defensive accountability','Current report · observed WCL uses; availability model pending');
      const rows=qsa('.audit-table > div:not(.at-head)',panel);
      rows.forEach((row,idx)=>{
        const player=telemetry.players[idx];
        if(!player){row.style.display='none';return;}
        row.style.display='';
        const cells=[...row.children];
        const use=telemetry.consumables?.detectedUsesByPlayerName?.[String(player.name).toLowerCase()]||{healthstone:0,potion:0};
        if(cells[0]){
          text(cells[0].querySelector('i'),String(player.name)[0]);
          text(cells[0].querySelector('b'),player.name);
        }
        if(cells[1]){
          text(cells[1].querySelector('b'),'Rule pack pending');
          text(cells[1].querySelector('small'),'Buff/cast data loaded');
        }
        if(cells[2])text(cells[2],'—');
        if(cells[3])text(cells[3].querySelector('b')||cells[3],'—');
        if(cells[4])text(cells[4].querySelector('b')||cells[4],String(use.healthstone||0));
        if(cells[5])text(cells[5].querySelector('b')||cells[5],String(use.potion||0));
        if(cells[6]){
          const encounter=player.encounter||player;
          text(cells[6],`${encounter.firstDeaths??0} first · ${encounter.meaningfulDeaths??0} meaningful`);
        }
      });
    }

    const controls=document.querySelector('.audit-controls');
    if(controls)text(controls.querySelector('.badge'),'WINDOW CLASSIFICATION PENDING');

    const plan=panelByTitle('Defensive plan vs execution');
    if(plan){
      text(plan.querySelector('.panel-title p'),'Assignment plan / cooldown catalogue not ingested yet');
      qsa('.cd-plan > div',plan).forEach((row,idx)=>{
        text(row.querySelector('time'),'—');
        text(row.querySelector('span b'),idx===0?'Raid cooldown plan pending':'—');
        text(row.querySelector('span small'),'No assignment source connected');
        text(row.querySelector('em'),'—');
        text(row.querySelector('.badge'),'PENDING');
      });
    }

    const replay=qsa('.panel').find(candidate=>candidate.querySelector('.death-replay'));
    if(replay){
      text(replay.querySelector('.panel-title h3'),'Death replay · event window pending');
      text(replay.querySelector('.panel-title p'),`Deaths are normalized into raw, wipeCutoff ${telemetry.deaths?.wipeCutoff??5}, and first-death scopes; ±10s replay is next.`);
      qsa('.death-replay > div',replay).forEach((row,idx)=>{
        text(row.querySelector('time'),'—');
        text(row.querySelector('span'),idx===0?'Real death events connected':'Detailed event context pending');
        text(row.querySelector('b'),idx===0?String(telemetry.bestPullEvents?.deathCount??0):'—');
      });
      const verdict=replay.closest('article.panel')?.querySelector('.verdict');
      if(verdict){
        text(verdict.querySelector('.badge'),'CAUSALITY PENDING');
        text(verdict.querySelector('p'),'No death is classified as preventable until pre-death damage, mitigation, resources and cooldown availability are reconstructed.');
      }
    }
  }

  function applyIntelligenceDefensives(){
    const intelligence=intelligenceState();
    const telemetry=telemetryState();
    if(intelligence?.status!=='ready'||!defensiveAuditActive())return;
    const chains=(intelligence.deathChains?.chains||[]).filter(chain=>chain.probableCause);
    const replay=qsa('.panel').find(panel=>panel.querySelector('.death-replay'));
    const chain=chains.slice().sort((a,b)=>(Number(b.deathAtMs)||0)-(Number(a.deathAtMs)||0))[0];
    if(replay&&chain){
      text(replay.querySelector('.panel-title h3'),`Death evidence · ${chain.player||playerNameById(chain.actorId,telemetry)}`);
      text(replay.querySelector('.panel-title p'),`Pull ${chain.fightId} · probable cause window ${Math.round((intelligence.deathChains?.windowMs||10000)/1000)}s`);
      const rows=qsa('.death-replay > div',replay);
      rows.forEach(row=>row.style.display='none');
      const evidence=chain.evidence||[];
      evidence.slice(0,Math.max(0,rows.length-1)).reverse().forEach((item,idx)=>{
        const row=rows[idx];
        if(!row)return;
        row.style.display='';
        text(row.querySelector('time'),fmtDuration((chain.fightRelativeMs||0)-(item.deltaMs||0)));
        text(row.querySelector('span'),item.mechanicName||item.reason||'Mechanic evidence');
        text(row.querySelector('b'),`${Math.round((item.deltaMs||0)/100)/10}s before`);
      });
      const deathRow=rows[Math.min(evidence.length,rows.length-1)];
      if(deathRow){
        deathRow.style.display='';
        deathRow.className='death';
        text(deathRow.querySelector('time'),fmtDuration(chain.fightRelativeMs));
        text(deathRow.querySelector('span'),`${chain.player||playerNameById(chain.actorId,telemetry)} dies`);
        text(deathRow.querySelector('b'),chain.killingBlow||'DEATH');
      }
      const verdict=replay.querySelector('.verdict');
      if(verdict){
        text(verdict.querySelector('.badge'),`${confidenceLabel(chain.confidence)} CAUSE SIGNAL`);
        text(verdict.querySelector('p'),`${chain.probableCause?.mechanicName||'Mechanic'} is the highest-ranked preceding classified event. Defensive availability is not yet inferred, so this is not labelled preventable.`);
      }
    }

    const plan=panelByTitle('Defensive plan vs execution');
    if(plan){
      text(plan.querySelector('.panel-title h3'),'Defensive availability');
      text(plan.querySelector('.panel-title p'),'Not inferred in v3.4.2 · requires versioned cooldown catalogue + assignments');
      qsa('.cd-plan > div',plan).forEach((row,idx)=>{
        text(row.querySelector('time'),'—');
        text(row.querySelector('span b'),idx===0?'Observed mechanic windows':'Cooldown reconstruction pending');
        text(row.querySelector('span small'),idx===0?`${intelligence.mechanics?.summary?.failedOccurrences||0} normalized failed executions in analytical pulls`:'No readiness claim made');
        text(row.querySelector('em'),'—');
        text(row.querySelector('.badge'),'PENDING');
      });
    }
  }

  const snapshot=()=>{
    if(!defensiveAuditActive())return null;
    const accountability=panelByTitle('Player defensive accountability');
    const plan=panelByTitle('Defensive plan vs execution')||panelByTitle('Defensive availability');
    const replay=qsa('.panel').find(panel=>panel.querySelector('.death-replay'));
    return JSON.stringify({
      banner:document.querySelector('.page-banner')?.textContent||'',
      bannerStat:document.querySelector('.banner-stat')?.textContent||'',
      stats:document.querySelector('.stats-row')?.textContent||'',
      accountability:accountability?.textContent||'',
      accountabilityDisplay:qsa('.audit-table > div:not(.at-head)',accountability).map(row=>row.style.display||''),
      controls:document.querySelector('.audit-controls')?.textContent||'',
      plan:plan?.textContent||'',
      replay:replay?.textContent||'',
      replayDisplay:qsa('.death-replay > div',replay).map(row=>row.style.display||''),
      replayClasses:qsa('.death-replay > div',replay).map(row=>row.className||''),
    });
  };

  let checks=0,mismatches=0,lastMismatch=null;
  const publish=()=>{
    window.__AVOID_DEFENSIVE_AUDIT_SOURCE_RUNTIME_STATE__=Object.freeze({
      version:VERSION,
      sourceOwner:'apps/web/src/features/defensive-audit/runtime.js',
      transport:'public/defensive-audit-runtime.js',
      mode:'parity-shadow',
      checks,
      mismatches,
      lastMismatch,
      directRequests:0,
      timers:0,
      observers:0,
    });
  };

  function shadow(){
    if(!defensiveAuditActive())return;
    applyTelemetryDefensives();
    applyIntelligenceDefensives();
    const expected=snapshot();
    queueMicrotask(()=>{
      if(!defensiveAuditActive())return;
      const actual=snapshot();
      checks+=1;
      if(actual!==expected){
        mismatches+=1;
        lastMismatch={at:Date.now(),expectedLength:expected?.length||0,actualLength:actual?.length||0};
        console.warn('[AvoiD v4 Defensive Audit parity] source-runtime output differs from legacy final DOM');
      }
      publish();
    });
  }

  window.applyTelemetryDefensives=applyTelemetryDefensives;
  window.applyIntelligenceDefensives=applyIntelligenceDefensives;
  window.__AVOID_DEFENSIVE_AUDIT_SOURCE_RUNTIME__=Object.freeze({
    version:VERSION,
    sourceOwner:'apps/web/src/features/defensive-audit/runtime.js',
    transport:'public/defensive-audit-runtime.js',
    applyTelemetryDefensives,
    applyIntelligenceDefensives,
    shadow,
  });
  publish();
})();
