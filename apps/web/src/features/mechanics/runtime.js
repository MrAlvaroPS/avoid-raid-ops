(() => {
  'use strict';

  const VERSION='4.0.0-migration4-shadow1';
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
  const fmtCompact=value=>{
    const n=Number(value);
    if(!Number.isFinite(n))return '—';
    if(Math.abs(n)>=1_000_000)return `${(n/1_000_000).toFixed(n>=10_000_000?1:2)}M`;
    if(Math.abs(n)>=1_000)return `${(n/1_000).toFixed(1)}K`;
    return Math.round(n).toString();
  };
  const panelByTitle=title=>qsa('.panel').find(panel=>qsa('.panel-title h3',panel).some(h=>h.textContent.trim()===title))||null;
  const mechanicsActive=()=>qsa('.page-banner h2').some(node=>node.textContent.trim()==='Mechanics Library');
  const telemetryState=()=>window.__AVOID_WCL_TELEMETRY__||null;
  const intelligenceState=()=>window.__AVOID_WCL_INTELLIGENCE__||null;
  const setPanelSubtitle=(title,value)=>text(panelByTitle(title)?.querySelector('.panel-title p'),value);
  const confidenceLabel=value=>{
    const v=String(value||'unknown').toUpperCase();
    return ['CONFIRMED','HIGH','MEDIUM','LOW'].includes(v)?v:'UNKNOWN';
  };
  const intelligenceMechanicMap=intelligence=>new Map((intelligence?.mechanics?.mechanics||[]).map(m=>[m.key,m]));

  function applyTelemetryMechanics(){
    const telemetry=telemetryState();
    if(!telemetry?.mechanics||!mechanicsActive())return;
    const mbanner=document.querySelector('.page-banner');
    if(mbanner){
      text(mbanner.querySelector('.badge'),'OBSERVED ENCOUNTER DATA');
      text(mbanner.querySelector(':scope > div > p'),'Real WCL encounter abilities, interrupts, debuffs and deaths. Failure and wipe-impact classification waits for the boss rule pack.');
    }

    const banner=document.querySelector('.banner-stat');
    if(banner?.querySelector('label')?.textContent.trim()==='MECHANICAL ACCURACY'){
      text(banner.querySelector('b'),'—');
      text(banner.querySelector('small'),'boss rule pack pending');
    }

    setPanelSubtitle('Encounter mechanic catalogue',`${telemetry.encounter?.completedPulls??'—'} pulls · observed WCL abilities by damage taken`);
    const items=telemetry.mechanics.observedAbilities||[];
    qsa('.mechanic-table > button').forEach((row,idx)=>{
      const m=items[idx];
      if(!m){row.style.display='none';return;}
      row.style.display='';
      const cells=[...row.children];
      if(cells[0]){text(cells[0].querySelector('i'),String(m.name||'?')[0]);text(cells[0].querySelector('b'),m.name);}
      if(cells[1])text(cells[1],'Damage taken · WCL');
      if(cells[2])text(cells[2],fmtDuration(m.firstCastMs));
      if(cells[3])text(cells[3],'—');
      if(cells[4])text(cells[4],'—');
      if(cells[5])text(cells[5],'OBSERVED');
    });

    const chainPanel=qsa('.panel').find(panel=>panel.querySelector('.cause-flow'));
    if(chainPanel){
      text(chainPanel.querySelector('.panel-title h3'),`${items[0]?.name||'Selected ability'} · classification pending`);
      text(chainPanel.querySelector('.panel-title p'),'Observed damage/casts are real; trigger → cascade → wipe causality requires the encounter rule pack.');
      const boxes=qsa('.cause-flow > div',chainPanel);
      if(boxes[0]){
        text(boxes[0].querySelector('label'),'OBSERVED');
        text(boxes[0].querySelector('b'),items[0]?.name||'WCL ability');
        text(boxes[0].querySelector('small'),items[0]?`${fmtCompact(items[0].totalDamageTaken)} damage taken in selected encounter`:'—');
      }
      if(boxes[1]){
        text(boxes[1].querySelector('label'),'CAUSALITY');
        text(boxes[1].querySelector('b'),'Not inferred yet');
        text(boxes[1].querySelector('small'),'Temporal event graph + boss rules required');
      }
      if(boxes[2]){
        text(boxes[2].querySelector('label'),'OUTCOME');
        text(boxes[2].querySelector('b'),`${telemetry.mechanics.firstDeathsDetected??telemetry.deaths?.firstDeathCount??0} first deaths`);
        text(boxes[2].querySelector('small'),`${telemetry.mechanics.meaningfulDeathsDetected??telemetry.deaths?.meaningfulCount??0} deaths before WCL wipe cutoff`);
      }
      const summary=chainPanel.querySelector('.cause-summary');
      if(summary){
        text(summary.querySelector('.badge'),'EVIDENCE ONLY');
        text(summary.querySelector('p'),'No wipe-impact percentage is asserted until mechanic failure predicates and death chains are validated.');
      }
    }

    const assignment=panelByTitle('Assignment compliance');
    if(assignment){
      const data=[
        ['Interrupts detected',telemetry.mechanics.interruptsDetected,'WCL Interrupts table'],
        ['Dispels detected',telemetry.mechanics.dispelsDetected,'WCL Dispels table'],
        ['Meaningful deaths',telemetry.mechanics.meaningfulDeathsDetected??telemetry.deaths?.meaningfulCount,`WCL Death events · wipeCutoff ${telemetry.deaths?.wipeCutoff??5}`],
        ['Debuff rows',telemetry.mechanics.debuffRows,'WCL Debuffs table'],
        ['Cast rows',telemetry.mechanics.castRows,'WCL Casts table'],
      ];
      const rows=qsa('.assignment-list > div',assignment);
      const max=Math.max(1,...data.map(entry=>Number(entry[1])||0));
      rows.forEach((row,idx)=>{
        const entry=data[idx];if(!entry)return;
        text(row.querySelector('span b'),entry[0]);
        text(row.querySelector('span small'),entry[2]);
        const bar=row.querySelector('div i, .progress i, i');
        if(bar?.style)bar.style.width=`${Math.max(4,Math.min(100,(Number(entry[1])||0)/max*100))}%`;
        text(row.querySelector('strong'),String(entry[1]??0));
      });
    }
  }

  function applyIntelligenceMechanics(){
    const intelligence=intelligenceState();
    const telemetry=telemetryState();
    if(intelligence?.status!=='ready'||!mechanicsActive())return;
    const analysis=intelligence.mechanics;
    const mechanics=(analysis?.mechanics||[]).slice().sort((a,b)=>(Number(b.linkedDeaths)||0)-(Number(a.linkedDeaths)||0)||(Number(b.failures)||0)-(Number(a.failures)||0)||(Number(b.severity)||0)-(Number(a.severity)||0));

    const banner=document.querySelector('.banner-stat');
    if(banner?.querySelector('label')?.textContent.trim()==='MECHANICAL ACCURACY'){
      const value=analysis?.summary?.mechanicalAccuracy;
      text(banner.querySelector('b'),Number.isFinite(Number(value))?Math.round(Number(value)):'—');
      text(banner.querySelector('small'),Number.isFinite(Number(value))?`${analysis.summary.failedOccurrences} failed executions · ${analysis.summary.opportunities} normalized opportunities`:analysis?.summary?.pendingDenominators?.length?`Pending denominators: ${analysis.summary.pendingDenominators.length}`:'Insufficient normalized opportunities');
    }

    const catalogue=panelByTitle('Encounter mechanic catalogue');
    if(catalogue){
      text(catalogue.querySelector('.panel-title p'),`${intelligence.encounter?.pulls||0} pulls · Belo'ren rule pack ${intelligence.rulePack?.version||''}`);
      const heads=qsa('.mt-head span',catalogue);
      if(heads[2])text(heads[2],'EXECUTIONS');
      if(heads[3])text(heads[3],'FAILED');
      if(heads[4])text(heads[4],'LINKED DEATHS');
      qsa('.mechanic-table > button',catalogue).forEach((row,idx)=>{
        const mechanic=mechanics[idx];
        if(!mechanic){row.style.display='none';return;}
        row.style.display='';
        const cells=[...row.children];
        if(cells[0]){text(cells[0].querySelector('i'),String(mechanic.name||'?')[0]);text(cells[0].querySelector('b'),mechanic.name);}
        if(cells[1])text(cells[1],String(mechanic.category||'mechanic').replaceAll('-',' '));
        if(cells[2])text(cells[2],mechanic.opportunities>0?String(mechanic.opportunities):'OBSERVED');
        if(cells[3])text(cells[3],mechanic.scoreable&&mechanic.denominatorStatus==='normalized'?String(mechanic.failedOccurrences??mechanic.failures??0):mechanic.scoreable?'PENDING':'—');
        if(cells[4])text(cells[4],String(mechanic.linkedDeaths||0));
        if(cells[5]){
          const status=(mechanic.linkedDeaths||0)>0&&mechanic.severity>=4?'CRITICAL':mechanic.scoreable&&mechanic.denominatorStatus!=='normalized'?'PENDING':(mechanic.failedOccurrences||mechanic.failures||0)>0?'UNSTABLE':mechanic.scoreable&&mechanic.opportunities>0?'CLEAN':'OBSERVED';
          text(cells[5],status);
        }
      });
    }

    const blocker=intelligence?.blocker?.blocker;
    const detail=blocker?intelligenceMechanicMap(intelligence).get(blocker.key):null;
    const chainPanel=qsa('.panel').find(panel=>panel.querySelector('.cause-flow'));
    if(chainPanel&&blocker){
      text(chainPanel.querySelector('.panel-title h3'),`${blocker.name} · evidence chain`);
      text(chainPanel.querySelector('.panel-title p'),'Failed execution → temporal death association → progression blocker signal');
      const boxes=qsa('.cause-flow > div',chainPanel);
      if(boxes[0]){
        text(boxes[0].querySelector('label'),'TRIGGER');
        text(boxes[0].querySelector('b'),`${blocker.failedOccurrences??blocker.failures} / ${blocker.opportunities||'?'} failed executions`);
        text(boxes[0].querySelector('small'),`${blocker.recentFailures} occurred in the latest 5 analytical pulls`);
      }
      if(boxes[1]){
        text(boxes[1].querySelector('label'),'DEATH LINK');
        text(boxes[1].querySelector('b'),`${blocker.linkedDeaths} meaningful deaths`);
        text(boxes[1].querySelector('small'),'Within the 10s evidence window · temporal association');
      }
      if(boxes[2]){
        text(boxes[2].querySelector('label'),'RECURRENCE');
        text(boxes[2].querySelector('b'),`${blocker.recurrence} analytical pulls affected`);
        text(boxes[2].querySelector('small'),detail?.expectedAction||'Expected action loaded from rule pack');
      }
      const summary=chainPanel.querySelector('.cause-summary');
      if(summary){
        text(summary.querySelector('.badge'),`${confidenceLabel(intelligence.blocker.confidence)} BLOCKER`);
        text(summary.querySelector('p'),`${blocker.name} is currently the strongest evidence-ranked progression blocker. This is a derived association, not proof of causation.`);
      }
    }

    const assignment=panelByTitle('Assignment compliance');
    if(assignment){
      text(assignment.querySelector('.panel-title h3'),'Execution evidence');
      text(assignment.querySelector('.panel-title p'),'Real WCL events classified by the encounter rule pack');
      const data=[
        ['Normalized executions',analysis?.summary?.opportunities||0,'Scoreable mechanic opportunities with valid denominators'],
        ['Failed executions',analysis?.summary?.failedOccurrences||0,'Occurrence-normalized rule-derived WCL evidence'],
        ['Death-linked chains',analysis?.summary?.linkedDeaths||0,'Meaningful deaths with temporal evidence'],
        ['Interrupts observed',telemetry?.mechanics?.interruptsDetected||0,'Encounter-level WCL interrupt events'],
        ['Meaningful deaths',telemetry?.deaths?.meaningfulCount||0,'WCL deaths before wipe cutoff'],
      ];
      const rows=qsa('.assignment-list > div',assignment);
      const max=Math.max(1,...data.map(entry=>Number(entry[1])||0));
      rows.forEach((row,idx)=>{
        const entry=data[idx];if(!entry)return;
        text(row.querySelector('span b'),entry[0]);
        text(row.querySelector('span small'),entry[2]);
        const bar=row.querySelector('div i, .progress i, i');
        if(bar?.style)bar.style.width=`${Math.max(4,Math.min(100,(Number(entry[1])||0)/max*100))}%`;
        text(row.querySelector('strong'),String(entry[1]));
      });
    }
  }

  const snapshot=()=>{
    if(!mechanicsActive())return null;
    const catalogue=panelByTitle('Encounter mechanic catalogue');
    const chain=qsa('.panel').find(panel=>panel.querySelector('.cause-flow'));
    const assignment=panelByTitle('Assignment compliance')||panelByTitle('Execution evidence');
    return JSON.stringify({
      banner:document.querySelector('.page-banner')?.textContent||'',
      bannerStat:document.querySelector('.banner-stat')?.textContent||'',
      catalogue:catalogue?.textContent||'',
      catalogueDisplay:qsa('.mechanic-table > button',catalogue).map(row=>row.style.display||''),
      chain:chain?.textContent||'',
      assignment:assignment?.textContent||'',
    });
  };

  let checks=0,mismatches=0,lastMismatch=null;
  const publish=()=>{
    window.__AVOID_MECHANICS_SOURCE_RUNTIME_STATE__=Object.freeze({
      version:VERSION,
      sourceOwner:'apps/web/src/features/mechanics/runtime.js',
      transport:'public/mechanics-runtime.js',
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
    if(!mechanicsActive())return;
    applyTelemetryMechanics();
    applyIntelligenceMechanics();
    const expected=snapshot();
    queueMicrotask(()=>{
      if(!mechanicsActive())return;
      const actual=snapshot();
      checks+=1;
      if(actual!==expected){
        mismatches+=1;
        lastMismatch={at:Date.now(),expectedLength:expected?.length||0,actualLength:actual?.length||0};
        console.warn('[AvoiD v4 Mechanics parity] source-runtime output differs from legacy final DOM');
      }
      publish();
    });
  }

  window.applyTelemetryMechanics=applyTelemetryMechanics;
  window.applyIntelligenceMechanics=applyIntelligenceMechanics;
  window.__AVOID_MECHANICS_SOURCE_RUNTIME__=Object.freeze({
    version:VERSION,
    sourceOwner:'apps/web/src/features/mechanics/runtime.js',
    transport:'public/mechanics-runtime.js',
    applyTelemetryMechanics,
    applyIntelligenceMechanics,
    shadow,
  });
  publish();
})();
