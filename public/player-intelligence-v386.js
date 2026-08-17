(()=>{
  'use strict';
  const VERSION='3.8.6';
  let selectedActorId=null;
  let lastSignature='';

  const qa=(s,r=document)=>r?Array.from(r.querySelectorAll(s)):[];
  const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=String(text);return x;};
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
  const pct=v=>num(v)==null?'—':`${num(v).toFixed(0)}%`;
  const compact=v=>{const n=num(v);if(n==null)return'—';if(Math.abs(n)>=1e6)return`${(n/1e6).toFixed(n>=1e7?1:2)}M`;if(Math.abs(n)>=1e3)return`${(n/1e3).toFixed(1)}K`;return String(Math.round(n));};
  const clean=v=>String(v||'').trim().toLowerCase();
  const live=()=>({
    telemetry:typeof telemetry!=='undefined'?telemetry:null,
    intelligence:typeof intelligence!=='undefined'?intelligence:null,
    history:typeof historyData!=='undefined'?historyData:null,
    payload:typeof payload!=='undefined'?payload:null
  });

  function isPlayersPage(){return qa('.page-banner h2').some(x=>x.textContent.trim()==='Player Intelligence');}
  function roleOf(p){const role=String(p?.role||'').toUpperCase();return role==='HEAL'?'HEAL':role==='TANK'?'TANK':'DPS';}
  function outputOf(p){
    try{if(typeof playerOutput==='function')return playerOutput(p);}catch{}
    const enc=p?.encounter||p||{};const role=roleOf(p);
    const value=role==='HEAL'?(enc.hps??p.hps):(enc.dps??p.dps);
    return `${compact(value)} ${role==='HEAL'?'HPS':'DPS'}`;
  }
  function outputNumber(p){const enc=p?.encounter||p||{};return num(roleOf(p)==='HEAL'?(enc.hps??p.hps):(enc.dps??p.dps))||0;}
  function profileMap(i){return new Map((i?.reliability?.profiles||[]).map(p=>[Number(p.identity?.actorId),p]));}
  function matrixMap(i){return new Map((i?.playerMatrix||[]).map(p=>[Number(p.actorId),p]));}
  function attendanceMap(h){
    const map=new Map();
    for(const row of h?.playerAttendance?.players||[])map.set(clean(row.identity?.name),row);
    return map;
  }
  function profileStatus(profile){
    if(profile?.value!=null)return{value:String(Math.round(profile.value)),label:'RELIABILITY',tone:'good'};
    if(profile?.status==='data-error')return{value:'!',label:'DATA ERROR',tone:'bad'};
    return{value:'—',label:'RELIABILITY · PENDING',tone:'pending'};
  }
  function dimension(profile,key){return profile?.components?.[key]||null;}
  function dimText(component){return component?.value!=null?String(Math.round(component.value)):'—';}
  function dimMeta(component,fallback='Evidence incomplete'){
    if(component?.value!=null)return `${component.effectiveOpportunities?.toFixed?.(1)??component.opportunities??0} effective opportunities`;
    return component?.why||component?.explanation||fallback;
  }
  function playerFacts(player,matrix){
    const enc=player?.encounter||player||{};
    return{
      firstDeaths:Number(enc.firstDeaths||0),
      meaningfulDeaths:Number(enc.meaningfulDeaths||0),
      interrupts:Number(enc.interrupts||0),
      dispels:Number(enc.dispels||0),
      failures:Number(matrix?.failures||0),
      recentFailures:Number(matrix?.recentFailures||0),
      linkedDeaths:Number(matrix?.linkedDeaths||0)
    };
  }

  function patchVersion(){
    const stamp=document.querySelector('.division b');
    if(stamp)stamp.textContent=`v${VERSION}`;
  }

  function buildRosterList(players,profiles,matrices){
    const panel=document.querySelector('.player-list');if(!panel)return;
    qa(':scope > button',panel).forEach(x=>x.remove());
    panel.classList.add('player-list-v386');
    for(const p of players){
      const profile=profiles.get(Number(p.actorId));const matrix=matrices.get(Number(p.actorId));const facts=playerFacts(p,matrix);
      const button=el('button',Number(p.actorId)===Number(selectedActorId)?'selected':'');button.type='button';button.dataset.actorId=String(p.actorId);
      const icon=el('i','',String(p.name||'?')[0]);
      const copy=el('span');copy.append(el('b','',p.name));copy.append(el('small','',[p.spec,roleOf(p),outputOf(p)].filter(Boolean).join(' · ')));
      const evidence=el('strong','',profile?.value!=null?String(Math.round(profile.value)):'—');
      const signal=el('em',facts.firstDeaths>1?'bad-text':facts.failures>0?'warn-text':'good-text',profile?.value!=null?'READY':facts.failures?`${facts.failures} obs.`:'PENDING');
      button.append(icon,copy,evidence,signal);
      button.addEventListener('click',()=>{selectedActorId=Number(p.actorId);render(true);});
      panel.append(button);
    }
  }

  function stat(label,value,meta,tone=''){
    const box=el('div',`pi386-stat ${tone}`);box.append(el('label','',label),el('b','',value),el('small','',meta));return box;
  }
  function badge(text,tone='pending'){return el('span',`pi386-badge ${tone}`,text);}
  function track(value,status='pending'){
    const root=el('span',`pi386-track ${status}`);const bar=el('i');bar.style.width=value==null?'0%':`${Math.max(2,Math.min(100,value))}%`;root.append(bar);return root;
  }

  function buildDetail(player,profile,matrix,attendance,intel){
    const panel=document.querySelector('.player-detail');if(!panel)return;
    panel.replaceChildren();panel.classList.add('player-detail-v386');
    const facts=playerFacts(player,matrix);const status=profileStatus(profile);
    const pulls=Number(profile?.participation?.pullsAttended||0);const eligible=Number(intel?.analysisPopulation?.eligiblePulls||intel?.encounter?.pulls||0);

    const head=el('div','pi386-head');
    const ident=el('div','pi386-identity');ident.append(el('i','',String(player.name||'?')[0]));
    const names=el('span');names.append(badge(profile?.value!=null?'PUBLISHED':'WCL + SHADOW MODEL',profile?.value!=null?'good':'info'),el('h2','',player.name),el('p','',[player.spec,roleOf(player),player.itemLevel?`ilvl ${player.itemLevel}`:null].filter(Boolean).join(' · ')));ident.append(names);
    const score=el('div',`pi386-score ${status.tone}`);score.append(el('b','',status.value),el('small','',status.label));head.append(ident,score);panel.append(head);

    const scores=el('div','pi386-scores');
    scores.append(
      stat('PERFORMANCE',outputOf(player),'Observed output · never part of Reliability'),
      stat('MECHANICS',dimText(dimension(profile,'mechanics')),`${facts.failures} classified failures observed`,facts.failures?'warn':''),
      stat('SURVIVAL',dimText(dimension(profile,'survival')),`${facts.firstDeaths} first · ${facts.meaningfulDeaths} meaningful deaths`,facts.firstDeaths>1?'bad':''),
      stat('DEFENSIVES',dimText(dimension(profile,'defensives')),'Availability reconstruction required')
    );panel.append(scores);

    const body=el('div','pi386-body');
    const reliability=el('section','pi386-card');
    const rt=el('div','pi386-card-title');rt.append(el('h3','','Reliability evidence'),badge(String(profile?.confidence?.level||profile?.confidence||'low').toUpperCase()+' CONFIDENCE',profile?.confidence?.level==='high'?'good':'pending'));reliability.append(rt);
    const evidence=el('div','pi386-evidence-grid');
    evidence.append(
      stat('CLASSIFIED FAILURES',facts.failures,facts.recentFailures?`${facts.recentFailures} in recent analytical pulls`:'No recent recurrence signal'),
      stat('DEATH-LINKED',facts.linkedDeaths,'Temporal association only; not automatic blame'),
      stat('INTERRUPTS',facts.interrupts,'Observed WCL count; assignment not inferred'),
      stat('DISPELS',facts.dispels,'Observed WCL count; assignment not inferred')
    );reliability.append(evidence);
    const mechanics=Object.entries(matrix?.mechanics||{}).sort((a,b)=>b[1]-a[1]);
    const mechBox=el('div','pi386-mechanics');mechBox.append(el('h4','','Observed mechanic incidents'));
    if(mechanics.length){for(const [key,count] of mechanics.slice(0,5)){const row=el('div');row.append(el('span','',key.replaceAll('-',' ')),el('b','',count));mechBox.append(row);}}
    else mechBox.append(el('p','','No player-attributed mechanic failure is present in the selected report. This does not create clean successes without a complete denominator.'));
    reliability.append(mechBox);

    const attendanceCard=el('section','pi386-card');attendanceCard.append(el('div','pi386-card-title')).firstChild.append(el('h3','','Raid attendance'));
    const current=el('div','pi386-attendance-current');current.append(stat('CURRENT REPORT',`${pulls}/${eligible||pulls} pulls`,eligible?pct(100*pulls/eligible):'Current indexed encounter scope'));
    attendanceCard.append(current);
    if(attendance){
      const historyGrid=el('div','pi386-evidence-grid');
      historyGrid.append(
        stat('RAID NIGHTS',`${attendance.sessionsAttended}/${attendance.eligibleSessions}`,`${pct(attendance.sessionAttendancePct)} indexed-night presence`),
        stat('PULL PRESENCE',`${attendance.pullsAttended}/${attendance.eligiblePulls}`,`${pct(attendance.pullPresencePct)} since first indexed appearance`),
        stat('FIRST INDEXED',attendance.firstIndexedAt?new Date(attendance.firstIndexedAt).toLocaleDateString():'—','Beginning of measurable attendance scope'),
        stat('LAST INDEXED',attendance.lastIndexedAt?new Date(attendance.lastIndexedAt).toLocaleDateString():'—','Most recent comparable indexed appearance')
      );attendanceCard.append(historyGrid);
      attendanceCard.append(el('p','pi386-disclosure','Attendance means observed WCL presence in comparable indexed raid sessions from the player’s first appearance. It is not a guild-membership, bench or excused-absence register.'));
    }else{
      attendanceCard.append(el('div','pi386-pending-block','Longitudinal attendance is loading or no comparable history with actor identities is available yet. Current-report pull presence remains factual.'));
    }
    body.append(reliability,attendanceCard);panel.append(body);

    const explain=el('section','pi386-explain');
    explain.append(badge(profile?.value!=null?'WHY THIS SCORE':'WHY PENDING',profile?.value!=null?'good':'pending'));
    explain.append(el('p','',profile?.explanation?.summary||'Reliability remains pending until player-specific mechanics denominators, complete Survival evidence and confirmed defensive availability pass the publication gates.'));
    const blockers=profile?.explanation?.blockers||profile?.publication?.reasons||[];
    if(blockers.length){const list=el('ul');for(const item of blockers.slice(0,8))list.append(el('li','',item));explain.append(list);}
    const observed=profile?.explanation?.observedNotScored||[];
    if(observed.length){const note=el('div','pi386-observed');note.append(el('b','','OBSERVED · NOT SCORED'),el('p','',observed.join(' · ')));explain.append(note);}
    panel.append(explain);
  }

  function buildMatrix(players,profiles,matrices){
    const table=document.querySelector('.reliability-table');if(!table)return;
    table.replaceChildren();table.classList.add('reliability-table-v386');
    const head=el('div','pi386-matrix-head');for(const label of ['PLAYER','OUTPUT · NOT SCORE','MECHANICS','SURVIVAL','DEFENSIVES','STATUS'])head.append(el('span','',label));table.append(head);
    const groupMax=new Map();for(const p of players){const role=roleOf(p);groupMax.set(role,Math.max(groupMax.get(role)||0,outputNumber(p)));}
    for(const p of players){
      const profile=profiles.get(Number(p.actorId));const matrix=matrices.get(Number(p.actorId));const facts=playerFacts(p,matrix);const row=el('button','pi386-matrix-row');row.type='button';row.dataset.actorId=String(p.actorId);if(Number(p.actorId)===Number(selectedActorId))row.classList.add('selected');
      const name=el('span','pi386-matrix-player');name.append(el('b','',p.name),el('small','',[p.spec,roleOf(p)].filter(Boolean).join(' · ')));
      const perf=el('span');perf.append(el('b','',outputOf(p)),track(groupMax.get(roleOf(p))?100*outputNumber(p)/groupMax.get(roleOf(p)):0,'performance'));
      const componentCell=(key,meta)=>{const c=dimension(profile,key);const cell=el('span');cell.append(el('b','',dimText(c)),track(c?.value==null?null:c.value,c?.value==null?'pending':'scored'),el('small','',meta));return cell;};
      const mechanics=componentCell('mechanics',`${facts.failures} observed`);
      const survival=componentCell('survival',`${facts.firstDeaths} first · ${facts.meaningfulDeaths} meaningful`);
      const defensives=componentCell('defensives','availability pending');
      const st=profileStatus(profile);const status=badge(profile?.value!=null?'RELIABLE':profile?.status==='data-error'?'DATA ERROR':'PENDING',st.tone);
      row.append(name,perf,mechanics,survival,defensives,status);row.addEventListener('click',()=>{selectedActorId=Number(p.actorId);render(true);});table.append(row);
    }
    const panel=table.closest('.panel');const sub=panel?.querySelector('.panel-title p');if(sub)sub.textContent=`All ${players.length} raiders · output is deliberately separate from Reliability`;
  }

  function render(force=false){
    patchVersion();if(!isPlayersPage())return;
    const state=live();const players=state.telemetry?.players||[];if(!players.length)return;
    const profiles=profileMap(state.intelligence);const matrices=matrixMap(state.intelligence);const attendance=attendanceMap(state.history);
    if(selectedActorId==null||!players.some(p=>Number(p.actorId)===Number(selectedActorId)))selectedActorId=Number(players[0].actorId);
    const signature=[players.map(p=>p.actorId).join(','),state.intelligence?.generatedAt,state.history?.generatedAt,selectedActorId].join('|');
    if(!force&&signature===lastSignature)return;lastSignature=signature;
    buildRosterList(players,profiles,matrices);
    const player=players.find(p=>Number(p.actorId)===Number(selectedActorId))||players[0];
    buildDetail(player,profiles.get(Number(player.actorId)),matrices.get(Number(player.actorId)),attendance.get(clean(player.name)),state.intelligence);
    buildMatrix(players,profiles,matrices);
    const banner=document.querySelector('.banner-stat');if(banner){const label=banner.querySelector('label');if(label)label.textContent='ROSTER RELIABILITY';const published=(state.intelligence?.reliability?.profiles||[]).filter(p=>p.value!=null);const b=banner.querySelector('b');if(b)b.textContent=published.length?String(Math.round(published.reduce((s,p)=>s+Number(p.value||0),0)/published.length)):'—';const small=banner.querySelector('small');if(small)small.textContent=published.length?`${published.length}/${players.length} publishable profiles`:`${players.length} profiles · evidence gates pending`;}
  }

  const observer=new MutationObserver(()=>render(false));
  const start=()=>{observer.observe(document.body,{childList:true,subtree:true});render(true);setInterval(()=>render(false),1500);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
