(() => {
  const RELEASE='3.8.2';
  const performanceDoesNotScore=true;
  let selectedKey=null;
  let lastRosterSignature='';
  let lastMatrixSignature='';

  const q=(s,r=document)=>r?.querySelector?.(s)||null;
  const qa=(s,r=document)=>Array.from(r?.querySelectorAll?.(s)||[]);
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const norm=v=>String(v||'').trim().toLowerCase();
  const finite=v=>Number.isFinite(Number(v))?Number(v):null;
  const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
  const fmtPct=v=>finite(v)==null?'—':`${Number(v).toFixed(Number(v)%1?1:0)}%`;
  const fmtDate=v=>finite(v)==null?'—':new Date(Number(v)).toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'});
  const fmtCompact=v=>{const n=finite(v);if(n==null)return'—';if(Math.abs(n)>=1e6)return`${(n/1e6).toFixed(n>=1e7?1:2)}M`;if(Math.abs(n)>=1e3)return`${(n/1e3).toFixed(1)}K`;return String(Math.round(n));};
  const roleOf=p=>String(p?.role||p?.reliabilityProfile?.identity?.role||'DPS').toUpperCase();
  const outputValue=p=>{const bp=p?.bestPull||p||{};return roleOf(p)==='HEAL'?finite(bp.hps):finite(bp.dps);};
  const outputText=p=>{const value=outputValue(p);return value==null?'—':`${fmtCompact(value)} ${roleOf(p)==='HEAL'?'HPS':'DPS'}`;};
  const profileValue=p=>finite(p?.reliabilityProfile?.value);
  const scoreText=v=>finite(v)==null?'PENDING':String(Math.round(Number(v)));
  const toneFor=v=>finite(v)==null?'pending':Number(v)>=85?'good':Number(v)>=70?'warn':'bad';
  const profileKey=p=>p?.reliabilityProfile?.identity?.key||`actor:${p?.actorId??norm(p?.name)}`;

  function data(){
    return{
      telemetry:window.__AVOID_WCL_TELEMETRY__||null,
      intelligence:window.__AVOID_WCL_INTELLIGENCE__||null,
      history:window.__AVOID_WCL_HISTORY__||null
    };
  }

  function mergedPlayers(){
    const {telemetry,intelligence}=data();
    const raw=Array.isArray(telemetry?.players)?telemetry.players:[];
    const profiles=Array.isArray(intelligence?.reliability?.profiles)?intelligence.reliability.profiles:[];
    const byActor=new Map(profiles.map(x=>[Number(x?.identity?.actorId),x]));
    const byName=new Map(profiles.map(x=>[norm(x?.identity?.name),x]));
    const seen=new Set();
    const players=raw.map(p=>{
      const profile=byActor.get(Number(p.actorId))||byName.get(norm(p.name))||null;
      if(profile)seen.add(profileKey({reliabilityProfile:profile,actorId:p.actorId,name:p.name}));
      return{...p,reliabilityProfile:profile};
    });
    for(const profile of profiles){
      const key=profile?.identity?.key||`actor:${profile?.identity?.actorId}`;
      if(seen.has(key))continue;
      players.push({
        actorId:profile?.identity?.actorId,
        name:profile?.identity?.name||'Unknown raider',
        className:profile?.identity?.className||null,
        spec:profile?.identity?.spec||null,
        role:profile?.identity?.role||null,
        bestPull:null,
        encounter:{pulls:profile?.participation?.pullsAttended||0,deaths:0,meaningfulDeaths:0,firstDeaths:0,interrupts:0,dispels:0},
        reliabilityProfile:profile
      });
    }
    return players;
  }

  function attendanceFor(p){
    const {history}=data();
    const rows=Array.isArray(history?.playerAttendance?.players)?history.playerAttendance.players:[];
    const key=profileKey(p);
    return rows.find(x=>x.key===key)||rows.find(x=>norm(x.name)===norm(p.name))||null;
  }

  function matrixFor(p){
    const {intelligence}=data();
    const rows=Array.isArray(intelligence?.playerMatrix)?intelligence.playerMatrix:[];
    return rows.find(x=>Number(x.actorId)===Number(p.actorId))||rows.find(x=>norm(x.name)===norm(p.name))||null;
  }

  function component(p,key){return p?.reliabilityProfile?.components?.[key]||null;}
  function observedFailures(p){
    const fromProfile=finite(p?.reliabilityProfile?.evidenceSummary?.mechanicUnscoredFailures);
    if(fromProfile!=null)return fromProfile;
    return finite(matrixFor(p)?.failures)||0;
  }

  function miniBar(value,{performance=false,pending=false}={}){
    if(pending||finite(value)==null)return'<span class="minibar player-pending-bar" aria-label="Pending evidence"><u style="width:0%"></u></span>';
    const tone=performance?'info':toneFor(value);
    return`<span class="minibar"><u class="${tone}" style="width:${clamp(Number(value))}%"></u></span>`;
  }

  function performancePercent(p,players){
    const value=outputValue(p);if(value==null)return null;
    const role=roleOf(p);
    const peers=players.map(x=>roleOf(x)===role?outputValue(x):null).filter(Number.isFinite);
    const max=peers.length?Math.max(...peers):null;
    return max&&max>0?clamp(100*value/max):0;
  }

  function playerSubtitle(p){
    return[ p.spec||p.className||'Unknown', roleOf(p), outputText(p) ].filter(Boolean).join(' · ');
  }

  function renderRoster(players){
    const panel=q('.player-list');if(!panel)return;
    const title=q('.panel-title',panel);
    const subtitle=q('.panel-title p',panel);if(subtitle)subtitle.textContent=`Current encounter roster · ${players.length} raiders`;
    let host=q('.player-list-scroll',panel);
    if(!host){
      qa(':scope > button',panel).forEach(x=>x.remove());
      host=document.createElement('div');host.className='player-list-scroll';
      title?.insertAdjacentElement('afterend',host);
      if(!title)panel.append(host);
    }
    const signature=players.map(p=>`${profileKey(p)}:${profileValue(p)??'p'}:${attendanceFor(p)?.pullAttendancePct??'a'}`).join('|');
    if(signature!==lastRosterSignature){
      lastRosterSignature=signature;
      host.replaceChildren();
      for(const p of players){
        const key=profileKey(p),button=document.createElement('button');
        button.type='button';button.dataset.playerKey=key;
        const attendance=attendanceFor(p);
        const rel=profileValue(p);
        button.innerHTML=`<i>${esc(String(p.name||'?')[0])}</i><span><b>${esc(p.name)}</b><small>${esc(playerSubtitle(p))}</small></span><strong>${rel==null?'—':Math.round(rel)}</strong><em>${attendance?`${esc(fmtPct(attendance.pullAttendancePct))} att`:`${esc(p?.reliabilityProfile?.participation?.pullsAttended??p?.encounter?.pulls??'—')} pulls`}</em>`;
        button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();selectedKey=key;renderSelection(players);});
        host.append(button);
      }
    }
    if(!selectedKey||!players.some(p=>profileKey(p)===selectedKey))selectedKey=profileKey(players[0]);
    qa('button',host).forEach(b=>b.classList.toggle('selected',b.dataset.playerKey===selectedKey));
  }

  function stat(label,value,flag,meta,tone=''){
    const emClass=tone&&tone!=='pending'?tone:'';
    return`<div class="stat"><label>${esc(label)}</label><div><b>${esc(value)}</b>${flag?`<em class="${emClass}">${esc(flag)}</em>`:''}</div><small>${esc(meta||'')}</small></div>`;
  }

  function componentMeta(p,key){
    const c=component(p,key),sample=c?.sample||{};
    if(!c)return'No evidence model loaded';
    if(key==='mechanics'){
      const failures=observedFailures(p),opps=finite(sample.opportunityCount)||0;
      return c.value!=null?`${opps} scoreable opportunities · ${sample.failures||0} failures`:`${failures} classified failures · ${opps} scoreable opportunities`;
    }
    if(key==='survival'){
      const enc=p.encounter||p;
      return`${enc.firstDeaths??0} first · ${enc.meaningfulDeaths??0} meaningful deaths · ${sample.opportunityCount||0} scored pulls`;
    }
    if(key==='defensives')return`${sample.opportunityCount||0} confirmed availability opportunities`;
    if(key==='duties')return`${sample.opportunityCount||0} proven assigned opportunities`;
    return c.reason||'';
  }

  function evidenceCard(label,value,meta,tone=''){
    return`<div class="player-evidence-card ${tone}"><label>${esc(label)}</label><b>${esc(value)}</b><small>${esc(meta)}</small></div>`;
  }

  function playerDetailRoot(){return q('.player-detail-v382,.player-detail');}
  function renderDetail(p){
    const detail=playerDetailRoot();if(!detail||!p)return;
    detail.classList.remove('player-detail');detail.classList.add('player-detail-v382');
    const profile=p.reliabilityProfile||{};
    const mechanics=component(p,'mechanics'),survival=component(p,'survival'),defensives=component(p,'defensives'),duties=component(p,'duties');
    const attendance=attendanceFor(p);
    const reportPulls=profile?.participation?.pullsAttended??p?.encounter?.pulls??0;
    const encounterPulls=data().intelligence?.analysisPopulation?.eligiblePulls??data().telemetry?.encounter?.completedPulls??reportPulls;
    const rel=profileValue(p),confidence=String(profile?.confidence?.level||profile?.publication?.confidence||'low').toUpperCase();
    const reasons=Array.isArray(profile?.publication?.reasons)?profile.publication.reasons:[];
    const failures=observedFailures(p);
    const badgeTone=rel==null?'warn':toneFor(rel);
    const firstSeen=attendance?.firstIndexedAt?fmtDate(attendance.firstIndexedAt):'Current indexed report';
    const attendanceValue=attendance?.pullAttendancePct!=null?fmtPct(attendance.pullAttendancePct):`${reportPulls}/${encounterPulls}`;
    const attendanceMeta=attendance
      ?`${attendance.pullsAttended}/${attendance.pullsEligible} pulls · ${attendance.sessionsAttended}/${attendance.sessionsEligible} raid nights · first indexed ${firstSeen}`
      :`${reportPulls}/${encounterPulls} current-report pulls · longitudinal history pending`;
    const publicationValue=profile?.publication?.publishable?'PUBLISHED':'PENDING';
    const publicationMeta=reasons.length?reasons.slice(0,3).join(' · '):'Evidence gates satisfied';
    const mechanicsEvidence=mechanics?.sample?.opportunityCount?`${mechanics.sample.opportunityCount} scoreable`:`${failures} classified failures`;
    const mechanicsEvidenceMeta=mechanics?.value!=null?componentMeta(p,'mechanics'):'Failures are retained but do not score without a proven clean denominator';
    const dutiesValue=duties?.value!=null?String(Math.round(duties.value)):'PENDING';
    const dutiesMeta=componentMeta(p,'duties');

    detail.innerHTML=`
      <div class="player-identity-v382">
        <i>${esc(String(p.name||'?')[0])}</i>
        <span><span class="badge ${badgeTone}">${rel==null?'RELIABILITY PENDING':`${Math.round(rel)} RELIABILITY`}</span><h2>${esc(p.name)}</h2><p>${esc([p.spec||p.className||'Unknown',roleOf(p),'AvoiD raider'].join(' · '))}</p></span>
        <b>${rel==null?'—':Math.round(rel)}<small>RELIABILITY · ${esc(confidence)} CONF.</small></b>
      </div>
      <div class="player-scores-v382">
        ${stat('PERFORMANCE',outputText(p),'CONTEXT','Best-pull output · never changes Reliability','info')}
        ${stat('MECHANICS',scoreText(mechanics?.value),mechanics?.value==null?'PENDING':'SCORED',componentMeta(p,'mechanics'),toneFor(mechanics?.value))}
        ${stat('SURVIVAL',scoreText(survival?.value),survival?.value==null?'PENDING':'SCORED',componentMeta(p,'survival'),toneFor(survival?.value))}
        ${stat('DEFENSIVES',scoreText(defensives?.value),defensives?.value==null?'PENDING':'SCORED',componentMeta(p,'defensives'),toneFor(defensives?.value))}
      </div>
      <div class="player-evidence-section">
        <div class="player-evidence-heading"><div><h3>Raider evidence dossier</h3><p>Reliability evidence, participation and separate performance context</p></div><span>MODEL ${esc(profile?.modelVersion||'1.1.0')}</span></div>
        <div class="player-evidence-grid">
          ${evidenceCard('CURRENT REPORT',`${reportPulls}/${encounterPulls} pulls`,'Player-specific denominator · analytical pulls only')}
          ${evidenceCard('RAID ATTENDANCE',attendanceValue,attendanceMeta,attendance?.pullAttendancePct!=null?'observed':'pending')}
          ${evidenceCard('MECHANIC EVIDENCE',mechanicsEvidence,mechanicsEvidenceMeta,failures?'warn':'')}
          ${evidenceCard('ASSIGNED DUTIES',dutiesValue,dutiesMeta,duties?.value==null?'pending':toneFor(duties?.value))}
          ${evidenceCard('CONFIDENCE',confidence,`${profile?.confidence?.effectiveOpportunities??0} effective opportunities · ${fmtPct((profile?.confidence?.evidenceCoverage??0)*100)} evidence coverage`,confidence==='HIGH'?'good':confidence==='MEDIUM'?'warn':'pending')}
          ${evidenceCard('PUBLICATION',publicationValue,publicationMeta,profile?.publication?.publishable?'good':'pending')}
        </div>
      </div>
      <div class="player-evidence-summary"><span class="badge info">EVIDENCE STATUS</span><p>${esc(profile?.explanation?.summary||`Reliability is ${publicationValue.toLowerCase()}. ${failures} classified failures are preserved as evidence; unproven clean executions are never fabricated.`)} ${performanceDoesNotScore?'Performance is shown separately and contributes 0 points to Reliability.':''}</p></div>`;
  }

  function renderSelection(players){
    const selected=players.find(p=>profileKey(p)===selectedKey)||players[0];
    if(!selected)return;
    selectedKey=profileKey(selected);
    qa('.player-list-scroll > button').forEach(b=>b.classList.toggle('selected',b.dataset.playerKey===selectedKey));
    renderDetail(selected);
  }

  function matrixCell(value,meta,barValue,{performance=false,pending=false}={}){
    return`<span><b>${esc(value)}</b><small>${esc(meta)}</small>${miniBar(barValue,{performance,pending})}</span>`;
  }

  function matrixRoot(){return q('.reliability-table-v382,.reliability-table');}
  function renderMatrix(players){
    const table=matrixRoot();if(!table)return;
    table.classList.remove('reliability-table');table.classList.add('reliability-table-v382');
    const panel=table.closest('.panel');const subtitle=q('.panel-title p',panel);
    if(subtitle)subtitle.textContent=`Full encounter roster · ${players.length} raiders · Performance is context only`;
    const signature=players.map(p=>`${profileKey(p)}:${profileValue(p)??'p'}:${component(p,'mechanics')?.value??'m'}:${component(p,'survival')?.value??'s'}:${component(p,'defensives')?.value??'d'}`).join('|');
    if(signature===lastMatrixSignature&&table.children.length===players.length+1)return;
    lastMatrixSignature=signature;
    table.replaceChildren();
    const head=document.createElement('div');head.className='rt-head';head.innerHTML='<span>PLAYER</span><span>PERFORMANCE</span><span>MECHANICS</span><span>SURVIVAL</span><span>DEFENSIVES</span><span>STATUS</span>';table.append(head);
    for(const p of players){
      const row=document.createElement('div');row.dataset.playerKey=profileKey(p);
      const m=component(p,'mechanics'),s=component(p,'survival'),d=component(p,'defensives'),rel=profileValue(p),enc=p.encounter||p;
      const failures=observedFailures(p),performanceBar=performancePercent(p,players);
      const status=rel==null?'PENDING':String(Math.round(rel));
      const statusTone=rel==null?'info':toneFor(rel);
      row.innerHTML=`
        <span><b>${esc(p.name)}</b><small>${esc(p.spec||p.className||'Unknown')} · ${esc(roleOf(p))}</small></span>
        ${matrixCell(outputText(p),'best-pull context',performanceBar,{performance:true,pending:performanceBar==null})}
        ${matrixCell(scoreText(m?.value),m?.value==null?`${failures} classified failure${failures===1?'':'s'}`:`${m?.sample?.opportunityCount||0} opportunities`,m?.value,{pending:m?.value==null})}
        ${matrixCell(scoreText(s?.value),`${enc.firstDeaths??0} first · ${enc.meaningfulDeaths??0} meaningful`,s?.value,{pending:s?.value==null})}
        ${matrixCell(scoreText(d?.value),`${d?.sample?.opportunityCount||0} confirmed opportunities`,d?.value,{pending:d?.value==null})}
        <span class="badge ${statusTone}">${esc(status)}</span>`;
      row.addEventListener('click',()=>{selectedKey=profileKey(p);renderSelection(players);playerDetailRoot()?.scrollIntoView?.({block:'nearest',behavior:'smooth'});});
      table.append(row);
    }
  }

  function renderBanner(players){
    const banner=q('.banner-stat');if(!banner||norm(q('label',banner)?.textContent)!=='roster reliability')return;
    const published=players.map(profileValue).filter(Number.isFinite);
    const b=q('b',banner),small=q('small',banner);
    if(b)b.textContent=published.length?String(Math.round(published.reduce((a,c)=>a+c,0)/published.length)):'—';
    if(small)small.textContent=published.length?`${published.length}/${players.length} published · role-aware`:`${players.length} raiders · Reliability evidence gates active`;
  }

  function isPlayersPage(){return qa('.page-banner h2').some(x=>x.textContent.trim()==='Player Intelligence');}
  function render(){
    if(!isPlayersPage())return;
    const players=mergedPlayers();if(!players.length)return;
    renderRoster(players);renderSelection(players);renderMatrix(players);renderBanner(players);
    document.documentElement.dataset.playerIntelligenceRelease=RELEASE;
  }

  document.addEventListener('click',event=>{if(event.target?.closest?.('nav button'))setTimeout(render,120);},true);
  window.addEventListener('popstate',()=>setTimeout(render,80));
  window.addEventListener('load',render,{once:true});
  document.addEventListener('DOMContentLoaded',render,{once:true});
  setInterval(render,900);
})();
