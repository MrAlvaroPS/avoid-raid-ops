const DEFAULT_REPORT = "28d9xF7GchL6ZPYt";
const DEFAULT_GUILD = "788166";

let payload = null;
let applying = false;
let lastFetchAt = 0;

const params = new URLSearchParams(location.search);
const reportCode = params.get("report") || DEFAULT_REPORT;
const guildId = params.get("guild") || DEFAULT_GUILD;
const encounterId = params.get("encounter");

const endpoint = new URL("/api/wcl/report", location.origin);
endpoint.searchParams.set("report", reportCode);
endpoint.searchParams.set("guild", guildId);
if (encounterId) endpoint.searchParams.set("encounter", encounterId);

const telemetryEndpoint = new URL("/api/wcl/telemetry", location.origin);
telemetryEndpoint.searchParams.set("report", reportCode);
if (encounterId) telemetryEndpoint.searchParams.set("encounter", encounterId);
if (params.get("debug") === "1") telemetryEndpoint.searchParams.set("debug", "1");

const historyEndpoint = new URL("/api/wcl/history", location.origin);
historyEndpoint.searchParams.set("report", reportCode);
historyEndpoint.searchParams.set("guild", guildId);
if (encounterId) historyEndpoint.searchParams.set("encounter", encounterId);

const statusEndpoint = new URL("/api/wcl/status", location.origin);
statusEndpoint.searchParams.set("report", reportCode);
if (encounterId) statusEndpoint.searchParams.set("encounter", encounterId);

const intelligenceEndpoint = new URL("/api/wcl/intelligence", location.origin);
intelligenceEndpoint.searchParams.set("report", reportCode);
if (encounterId) intelligenceEndpoint.searchParams.set("encounter", encounterId);

let telemetry = null;
let historyData = null;
let intelligence = null;
let selectedPlayerIndex = 0;

const qsa = (sel, root = document) => root ? Array.from(root.querySelectorAll(sel)) : [];

function fmtPct(v, digits = 1) {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(digits)}%` : "—";
}

function fmtCompact(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

function fmtDuration(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return "—";
  const total = Math.max(0, Math.round(n / 1000));
  const min = Math.floor(total / 60);
  const sec = String(total % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

function fmtSeconds(ms) {
  const n = Number(ms);
  return Number.isFinite(n) ? `${(n / 1000).toFixed(1)}s` : "—";
}

function text(el, value) {
  if (!el || value === undefined || value === null) return;
  const next = String(value);
  if (el.textContent !== next) el.textContent = next;
}

function ownText(el) {
  if (!el) return "";
  return Array.from(el.childNodes)
    .filter(n => n.nodeType === Node.TEXT_NODE)
    .map(n => n.textContent || "")
    .join("")
    .trim();
}

function findOwnText(value, root = document) {
  return qsa("*", root).find(el => ownText(el) === value) || null;
}

function panelByTitle(title) {
  return qsa(".panel").find(panel =>
    qsa(".panel-title h3", panel).some(h => h.textContent.trim() === title)
  ) || null;
}

function statByLabel(label, root = document) {
  return qsa(".stat", root).find(card =>
    card.querySelector(":scope > label")?.textContent.trim() === label
  ) || null;
}

function setStat(label, values, root = document) {
  const card = statByLabel(label, root);
  if (!card) return false;
  if ("value" in values) text(card.querySelector("div > b"), values.value);
  if ("delta" in values) {
    const em = card.querySelector("div > em");
    if (em) text(em, values.delta);
  }
  if ("meta" in values) {
    const small = card.querySelector(":scope > small");
    if (small) text(small, values.meta);
  }
  return true;
}

function setPendingStat(label, reason = "Analysis layer pending", root = document) {
  setStat(label, { value: "—", delta: "PENDING", meta: reason }, root);
}

function applyShell() {
  if (!payload?.ok) return;

  const guild = payload.guild || payload.reportGuild;
  const report = payload.report;
  const encounter = payload.encounter;

  const wcl = document.querySelector(".wcl");
  if (wcl) {
    text(wcl.querySelector("b"), `${encounter.completedPulls} pulls indexed`);
    text(wcl.querySelector("small"), `WCL synced · ${new Date(payload.generatedAt).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}`);
  }

  const crumbs = qsa(".breadcrumbs span");
  if (crumbs[0] && guild?.name) text(crumbs[0], guild.name.toUpperCase());
  if (crumbs[1] && report?.zone?.name) text(crumbs[1], report.zone.name.toUpperCase());

  const selectors = qsa(".selectors button");
  if (selectors[0]) text(selectors[0], `${encounter.name}⌄`);
  if (selectors[1]) text(selectors[1], `${encounter.difficultyName}⌄`);
  if (selectors[2]) text(selectors[2], `Current report⌄`);
  qsa("nav button").forEach(btn=>{if(btn.textContent.includes("Defensive Audit")){const em=btn.querySelector("em");if(em)em.style.display="none";}});

  const stamp = document.querySelector(".avoid-stamp");
  if (stamp && guild) {
    text(stamp.querySelector("span"), guild.name.toUpperCase());
    const compact = guild.server?.region?.compactName || guild.server?.region?.slug?.toUpperCase() || "EU";
    text(stamp.querySelector("b"), `${compact} · ${(guild.server?.name || "").toUpperCase()}`);
  }

  const footer = document.querySelector("footer span");
  if (footer) text(footer, "Progress intelligence · Live Warcraft Logs data");

  const sync = wcl?.querySelector("button");
  if (sync && !sync.dataset.wclBound) {
    sync.dataset.wclBound = "1";
    sync.addEventListener("click", async () => {
      text(wcl.querySelector("small"), "Syncing Warcraft Logs…");
      await fetchData(true);
    });
  }
}

function applyCommandCenter() {
  if (!findOwnText("Command Center")) return;
  const o = payload.overview;
  const e = payload.encounter;
  const best = o.bestPull;

  const hero = document.querySelector(".overview-hero");
  if (hero && best) {
    const h2 = hero.querySelector(".hero-copy h2");
    if (h2) {
      const maxPhase = Number(e.maxObservedPhase || 1);
      const phaseLabel = maxPhase >= 3 ? `${o.phaseConversion?.percentages?.["3"] ?? 0}% reached Phase 3.` : `${maxPhase} phases observed · P${maxPhase} conversion ${o.phaseConversion?.percentages?.[String(maxPhase)] ?? 0}%.`;
      const nextHero = `Best pull: ${fmtPct(best.fightPercentage)}<br><span>${phaseLabel}</span>`;
      if (h2.innerHTML !== nextHero) h2.innerHTML = nextHero;
    }
    text(
      hero.querySelector(".hero-copy > p"),
      `${e.completedPulls} completed pulls loaded from Warcraft Logs. Progression, deaths, throughput and roster data are now live for this report.`
    );

    const ring = hero.querySelector(".kill-ring");
    if (ring) {
      const killed = Number(e.kills) > 0;
      text(ring.querySelector("strong"), killed ? "100" : "—");
      const badge = ring.querySelector(".badge");
      if (badge) text(badge, killed ? "KILLED" : "MODEL PENDING");
    }
  }

  setStat("BEST PULL", {
    value: fmtPct(best?.fightPercentage),
    delta: best?.kill ? "KILL" : "WCL",
    meta: best ? `Pull ${best.pullNumber} · ${fmtDuration(best.durationMs)}` : "No completed pull"
  });

  const hasP3 = Number(e.maxObservedPhase || 1) >= 3;
  const p3 = o.phaseConversion?.percentages?.["3"];
  const p3count = o.phaseConversion?.counts?.["3"];
  setStat("P3 CONVERSION", {
    value: hasP3 ? `${p3 ?? 0}%` : "N/A",
    delta: hasP3 ? "WCL" : "2-PHASE",
    meta: hasP3 ? `${p3count ?? 0} of ${o.phaseConversion?.denominator ?? 0} pulls` : `Encounter has ${e.maxObservedPhase} observed phases`
  });

  setPendingStat("KILL-READY PULLS", "Needs kill-time / peer model");

  setStat("EARLY DEATHS", {
    value: o.earlyDeaths ?? "—",
    delta: o.earlyDeaths == null ? "PENDING" : "WCL",
    meta: o.earlyDeathDefinition || "Death table unavailable"
  });

  setStat("RAID DPS", {
    value: fmtCompact(o.raidDps),
    delta: o.raidDps == null ? "PENDING" : "BEST PULL",
    meta: o.raidDps == null ? "Summary table unavailable" : `Pull ${best?.pullNumber ?? "—"}`
  });

  window.applyProgressCurve?.();

  const progressionPanel = panelByTitle("Progression intelligence");
  if (progressionPanel) {
    text(progressionPanel.querySelector(".panel-title p"),"WCL fightPercentage · selected report");
    const signal = progressionPanel.querySelector(".signal");
    const b = signal?.querySelector("b");
    const p = signal?.querySelector("p");
    if (o.breakthrough) {
      text(b, `Breakthrough detected at Pull ${o.breakthrough.pullNumber}`);
      text(p, `Median fight outcome improved ${o.breakthrough.improvementPctPoints} percentage points and the gain was sustained in ${o.breakthrough.maintained} of the next ${o.breakthrough.sample} pulls.`);
    } else {
      text(b, "No repeatable breakthrough detected yet");
      text(p, "The current report does not yet meet the blueprint threshold for a confirmed progression breakpoint.");
    }
  }

  const blocker = panelByTitle("Current blocker");
  if (blocker) {
    const main = blocker.querySelector(".blocker-main");
    text(main?.querySelector(".badge"), "RULE PACK PENDING");
    text(main?.querySelector("h3"), "Root-cause analysis not enabled yet");
    text(main?.querySelector("p"), "The report is connected. This card will activate after boss mechanics, defensive cooldown rules and death-chain analysis are added.");
    setPendingStat("LINKED DEATHS", "Rule pack required", blocker);
    setPendingStat("UNUSED DEFENSIVES", "Cooldown model required", blocker);
    setPendingStat("AVG RAID HP", "Resource snapshots required", blocker);
  }

  const what = panelByTitle("What changed?");
  if (what) {
    const titleSub = what.querySelector(".panel-title p");
    text(titleSub, "Multi-report comparison not loaded yet");
    qsa(".change", what).forEach(row => {
      text(row.querySelector("strong"), "—");
      const label = row.querySelector("label")?.textContent.trim();
      const b = row.querySelector("span > b");
      const p = row.querySelector("span > p");
      if (label === "BIGGEST GAIN") {
        text(b, "Waiting for previous-night baseline");
        text(p, "This becomes real once we ingest multiple Avoid reports for the same encounter.");
      } else if (label === "NEW REGRESSION") {
        text(b, "No cross-night comparison yet");
        text(p, "No regression is asserted from a single report.");
      } else if (label === "ROSTER EFFECT") {
        text(b, "Roster association pending");
        text(p, "Requires matched pulls across roster changes.");
      }
    });
  }

  const phasePanel = panelByTitle("Phase control");
  if (phasePanel) {
    qsa(".phase-row", phasePanel).forEach((row, idx) => {
      const phase = idx + 1;
      const exists = phase <= Number(e.maxObservedPhase || 1);
      const pct = o.phaseConversion?.percentages?.[String(phase)] ?? 0;
      const count = o.phaseConversion?.counts?.[String(phase)] ?? 0;
      text(row.querySelector("div > b"), `P${phase}`);
      text(row.querySelector("div > strong"), exists ? `${pct}%` : "N/A");
      text(row.querySelector("small"), exists ? `${count}/${o.phaseConversion?.denominator ?? 0} pulls reached` : "Phase not present in encounter");
      const bar = row.querySelector(".bar i, .progress i, i[style]");
      if (bar && bar.style) bar.style.width = exists ? `${pct}%` : "0%";
    });
  }

  const wipe = panelByTitle("Wipe signatures");
  if (wipe) {
    text(wipe.querySelector(".wipe-ring b"), e.completedPulls);
    qsa(".wipe-summary p b", wipe).forEach(x => text(x, "—"));
    const sub = wipe.querySelector(".panel-title p");
    text(sub, "Classifier pending · no wipe signature is asserted from raw deaths alone");
    const wipeRows=qsa(".wipe-summary p",wipe);
    const pendingLabels=["Mechanic classifier","Cascade classifier","Defensive classifier","Throughput classifier"];
    wipeRows.forEach((row,idx)=>{const span=row.querySelector("span"); if(span){const icon=span.querySelector("i"); span.childNodes.forEach(n=>{if(n.nodeType===Node.TEXT_NODE)n.nodeValue=""}); span.append(document.createTextNode(pendingLabels[idx]||"Classifier pending")); if(icon)span.prepend(icon);} text(row.querySelector("b"),"—");});
  }

  const peer = panelByTitle("Peer benchmark");
  if (peer) {
    const sub = peer.querySelector(".panel-title p");
    text(sub, "Peer kill sample not loaded yet");
    text(peer.querySelector(".peer-rank b"), "—");
    clearSyntheticChart(peer.querySelector(".peer-rank"), "Peer cohort not ingested");
    qsa(".peer-line",peer).forEach(row=>{text(row.querySelector("b"),"—");const small=row.querySelector("small");if(small)text(small,"Peer sample pending");});
  }
}

function setCompareCell(row, colIndex, value) {
  const children = Array.from(row.children);
  if (children[colIndex]) text(children[colIndex], value);
}

function applyPullLab() {
  const heading=qsa(".page-banner h2").find(x=>x.textContent.trim()==="Pull Lab"); if(!heading)return;
  const pi=telemetry?.pullIntelligence; const a=pi?.latest; const b=pi?.previous; if(!a||!b){const title=panelByTitle("Why pull 25 was better")?.querySelector(".panel-title h3");if(title)text(title,"Pull delta · insufficient data");return;}
  const select=document.querySelector(".pull-select");const picks=qsa("b",select);if(picks[0])text(picks[0],`#${a.pullNumber} · ${fmtPct(a.fightPercentage)}`);if(picks[1])text(picks[1],`#${b.pullNumber} · ${fmtPct(b.fightPercentage)}`);
  const sync=document.querySelector(".sync-timeline");if(sync){const labels=qsa(":scope > label",sync);if(labels[0])text(labels[0],`#${a.pullNumber}`);if(labels[1])text(labels[1],`#${b.pullNumber}`);const tracks=qsa(":scope > div",sync);[a,b].forEach((pull,idx)=>{const tr=tracks[idx];if(!tr)return;const bars=qsa("i",tr);bars.forEach((bar,j)=>{const st=pull.stages?.[j];if(!st){bar.style.display="none";return;}bar.style.display="";const dur=Math.max(1,pull.durationMs);const left=Math.max(0,Number(st.startTime??0)-Number(pull.stages?.[0]?.startTime??0));const end=Math.max(left,Number(st.endTime??left)-Number(pull.stages?.[0]?.startTime??0));bar.style.left=`${100*left/dur}%`;bar.style.width=`${100*(end-left)/dur}%`;});qsa("u.death",tr).forEach((d,k)=>{if(k>0||pull.firstDeathMs==null){d.style.display="none";}else{d.style.display="";d.style.left=`${Math.min(99,100*pull.firstDeathMs/Math.max(1,pull.durationMs))}%`;}});});const footer=qsa(":scope > small span",sync);if(footer.length>=4){text(footer[0],"0:00");text(footer[1],a.stages?.[1]?.startTime!=null?`S2 · ${fmtDuration(Number(a.stages[1].startTime)-Number(a.stages[0].startTime))}`:"S2 · —");text(footer[2],a.stages?.[2]?.startTime!=null?`S3 · ${fmtDuration(Number(a.stages[2].startTime)-Number(a.stages[0].startTime))}`:"S3 · —");text(footer[3],fmtDuration(a.durationMs));}}
  const deltaPanel=qsa("article.panel").find(p=>p.querySelector(".delta-list"));if(deltaPanel){text(deltaPanel.querySelector(".panel-title h3"),`Pull ${a.pullNumber} vs Pull ${b.pullNumber}`);text(deltaPanel.querySelector(".panel-title p"),"Real WCL delta analysis · no root-cause claims");const rows=qsa(".delta-list p",deltaPanel);const signals=[...(pi.currentVsPrevious?.improvements||[]).slice(0,2),...(pi.currentVsPrevious?.regressions||[]).slice(0,2)];rows.forEach((row,idx)=>{const sig=signals[idx];text(row.querySelector(".badge"),sig?pullSignalDelta(sig):"—");text(row.querySelector("span > b"),sig?.label||"No additional classified signal");text(row.querySelector("span > small"),sig?describePullSignal(sig):"Awaiting mechanic/defensive rule packs for deeper causality.");row.classList.toggle("pending",!sig);});}
  const table=panelByTitle("Pull metrics comparator")?.querySelector(".compare-table");if(table){const head=table.querySelector(".ct-head"),h=head?Array.from(head.children):[];if(h[1])text(h[1],`#${a.pullNumber} · ${fmtPct(a.fightPercentage)}`);if(h[2])text(h[2],`#${b.pullNumber} · ${fmtPct(b.fightPercentage)}`);if(h[4])text(h[4],"LAST 5 MEDIAN");const base=pi.baselines?.last5||{};for(const row of qsa(":scope > div:not(.ct-head)",table)){const metric=row.children[0]?.textContent.trim();if(metric==="Duration"){setCompareCell(row,1,fmtDuration(a.durationMs));setCompareCell(row,2,fmtDuration(b.durationMs));setCompareCell(row,3,`${((a.durationMs-b.durationMs)/1000)>=0?"+":""}${((a.durationMs-b.durationMs)/1000).toFixed(0)}s`);setCompareCell(row,4,"—");}else if(metric==="Raid DPS"){setCompareCell(row,1,fmtCompact(a.raidDps));setCompareCell(row,2,fmtCompact(b.raidDps));const pc=Number(a.raidDps)&&Number(b.raidDps)?(Number(a.raidDps)/Number(b.raidDps)-1)*100:null;setCompareCell(row,3,Number.isFinite(pc)?`${pc>=0?"+":""}${pc.toFixed(1)}%`:"—");setCompareCell(row,4,fmtCompact(base.raidDps));}else if(metric==="Raid HPS"){setCompareCell(row,1,fmtCompact(a.raidHps));setCompareCell(row,2,fmtCompact(b.raidHps));setCompareCell(row,3,"OBSERVED");setCompareCell(row,4,fmtCompact(base.raidHps));}else if(metric==="First death"){setCompareCell(row,1,fmtDuration(a.firstDeathMs));setCompareCell(row,2,fmtDuration(b.firstDeathMs));setCompareCell(row,3,a.firstDeathMs!=null&&b.firstDeathMs!=null?`${((a.firstDeathMs-b.firstDeathMs)/1000)>=0?"+":""}${((a.firstDeathMs-b.firstDeathMs)/1000).toFixed(0)}s`:"—");setCompareCell(row,4,fmtDuration(base.firstDeathMs));}else if(metric==="Avoidable damage"){text(row.children[0],"Meaningful deaths");setCompareCell(row,1,String(a.meaningfulDeaths??"—"));setCompareCell(row,2,String(b.meaningfulDeaths??"—"));setCompareCell(row,3,Number.isFinite(Number(a.meaningfulDeaths))&&Number.isFinite(Number(b.meaningfulDeaths))?String(Number(a.meaningfulDeaths)-Number(b.meaningfulDeaths)):"—");setCompareCell(row,4,base.meaningfulDeaths==null?"—":String(base.meaningfulDeaths));}else{setCompareCell(row,1,"—");setCompareCell(row,2,"—");setCompareCell(row,3,"PENDING");setCompareCell(row,4,"—");}}}
}

function applyDamageHealing() {
  const heading = qsa(".page-banner h2").find(x => x.textContent.trim() === "Damage & Healing");
  if (!heading) return;

  const o = payload.overview;
  const best = o.bestPull;
  const banner=document.querySelector(".page-banner"); if(banner){text(banner.querySelector(".badge"),"WCL THROUGHPUT");text(banner.querySelector(":scope > div > p"),"Real Avoid output from the selected report. Peer kill benchmarking remains explicitly pending.");}

  setStat("AVOID RAID DPS", {
    value: fmtCompact(o.raidDps),
    delta: o.raidDps == null ? "PENDING" : "BEST PULL",
    meta: best ? `Pull ${best.pullNumber}` : "—"
  });
  setStat("AVOID RAID HPS", {
    value: fmtCompact(o.raidHps),
    delta: o.raidHps == null ? "PENDING" : "BEST PULL",
    meta: best ? `Pull ${best.pullNumber}` : "—"
  });
  setStat("EXECUTE DPS", {
    value: fmtCompact(o.executeDps),
    delta: o.executeDps == null ? "PENDING" : "P3",
    meta: "P3 only"
  });
  setStat("OVERHEAL", {
    value: fmtPct(o.overhealPct),
    delta: o.overhealPct == null ? "PENDING" : "WCL",
    meta: "Best-pull healing table"
  });
  setPendingStat("HEALING DEATH GAP", "Needs HP resource snapshots");

  const chart = document.querySelector(".bigchart");
  if (chart) {
    const sub = chart.querySelector(".panel-title p");
    text(sub, `Pull ${best?.pullNumber ?? "—"} · WCL graph connected (render normalization next)`);
    const footerP = chart.querySelector(".chart-footer p");
    text(footerP, "The chart component is preserved; exact WCL time-series rendering will be activated after validating this report's graph JSON shape.");
  }
}

function applyComposition() {
  const heading = qsa(".page-banner h2").find(x => x.textContent.trim() === "Composition Intelligence");
  if (!heading) return;

  // Composition fit / peer comparisons must not remain fictional.
  const banner = document.querySelector(".banner-stat");
  if (banner?.querySelector("label")?.textContent.trim() === "COMPOSITION FIT") {
    text(banner.querySelector("b"), "—");
    text(banner.querySelector("small"), "peer sample pending");
  }

  setPendingStat("TANKS", "Role mapping validation next");
  setPendingStat("HEALERS", "Role mapping validation next");
  setPendingStat("MELEE DPS", "Role mapping validation next");
  setPendingStat("RANGED DPS", "Role mapping validation next");
  setPendingStat("UNIQUE RAID BUFFS", "Utility catalogue required");
}

function applyLive() {
  const rosterPanel=document.querySelector(".roster-intelligence-panel");if(rosterPanel)rosterPanel.style.display="none";
  const heading=qsa(".live-command h2").find(x=>x.textContent.trim()==="Raid Night Control Room");if(!heading)return;
  const liveCommand=document.querySelector(".live-command");if(liveCommand){text(liveCommand.querySelector(".badge"),"● WCL CLOSED-PULL FEED");text(liveCommand.querySelector(":scope > div > p"),"Each closed WCL pull becomes an immediate factual delta brief. Root cause and next-pull prescriptions activate only when their evidence engines are ready.");}
  const pi=telemetry?.pullIntelligence,latest=pi?.latest,prev=pi?.previous,cmp=pi?.currentVsPrevious;const meta=qsa(".stream-meta span");if(meta[0])meta[0].innerHTML=`<i></i>WCL REPORT <b>${payload.report.code}</b>`;if(meta[1])meta[1].innerHTML=`LAST SYNC <b>${new Date(telemetry?.generatedAt||payload.generatedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</b>`;if(meta[2])meta[2].innerHTML=`QUEUE <b>0 closed-pull jobs</b>`;
  const streamButton=document.querySelector(".stream-button");if(streamButton){text(streamButton,"WCL POLLING ACTIVE");streamButton.disabled=true;}
  const rail=document.querySelector(".pull-rail");if(rail){const excludedCount=pi?.analysisPopulation?.excludedPulls?.length??pi?.excludedPulls?.length??0;text(rail.querySelector(".rail-head b"),`${pi?.pulls?.length??payload.encounter.completedPulls} analytical${excludedCount?` · ${excludedCount} reset excluded`:""}`);const buttons=qsa(":scope > button:not(.incoming)",rail);const pulls=(pi?.pulls||[]).slice(-buttons.length).reverse();buttons.forEach((btn,idx)=>{const p=pulls[idx];if(!p){btn.style.display="none";return;}btn.style.display="";const spans=btn.querySelector("span");text(spans?.querySelector("b"),`PULL ${p.pullNumber}`);text(spans?.querySelector("small"),`${fmtDuration(p.durationMs)} · Stage ${p.stageCount}`);text(btn.querySelector("strong"),fmtPct(p.fightPercentage));text(btn.querySelector("i"),p.pullNumber===latest?.pullNumber?"LATEST":p.pullNumber===pi?.best?.pullNumber?"BEST":"WCL");btn.classList.toggle("selected",p.pullNumber===latest?.pullNumber);});const incoming=rail.querySelector(".incoming span:last-child");if(incoming){text(incoming.querySelector("b"),"POLLING");text(incoming.querySelector("small"),"Waiting for next closed WCL fight");}}
  const headline=document.querySelector(".pull-headline");if(headline&&latest){text(headline.querySelector(".pull-id"),`PULL ${latest.pullNumber}`);const badge=headline.querySelector(".badge");if(badge)text(badge,`${fmtPct(latest.fightPercentage)} WCL PROGRESS`);text(headline.querySelector("h2"),`Stage ${latest.stageCount} · ${fmtDuration(latest.durationMs)}`);const p=headline.querySelector("p");if(p){p.innerHTML=`First death: <b>${fmtDuration(latest.firstDeathMs)}</b> · ${latest.meaningfulDeaths} meaningful deaths`;}const score=headline.querySelector(".execution-score strong");if(score)text(score,"—");const sl=headline.querySelector(".execution-score span");if(sl)sl.innerHTML="EXECUTION<br>SCORE PENDING";}
  const stats=document.querySelector(".live-stats");if(stats&&latest){const cards=qsa(".stat",stats);if(cards[0]){text(cards[0].querySelector("label"),"BOSS REMAINING");text(cards[0].querySelector("div > b"),fmtPct(latest.bossPercentage));text(cards[0].querySelector("div > em"),"WCL");text(cards[0].querySelector("small"),`fight progress ${fmtPct(latest.fightPercentage)}`);}if(cards[1]){text(cards[1].querySelector("label"),"RAID DPS");text(cards[1].querySelector("div > b"),fmtCompact(latest.raidDps));text(cards[1].querySelector("div > em"),cmp?.sameStage&&prev?.raidDps?`${((latest.raidDps/prev.raidDps-1)*100)>=0?"+":""}${((latest.raidDps/prev.raidDps-1)*100).toFixed(1)}%`:"OBSERVED");text(cards[1].querySelector("small"),cmp?.sameStage?"same-stage vs previous":"stage differs from previous");}if(cards[2]){text(cards[2].querySelector("label"),"RAID HPS");text(cards[2].querySelector("div > b"),fmtCompact(latest.raidHps));text(cards[2].querySelector("div > em"),"OBSERVED");text(cards[2].querySelector("small"),"demand context, not scored");}if(cards[3]){text(cards[3].querySelector("label"),"FIRST DEATH");text(cards[3].querySelector("div > b"),fmtDuration(latest.firstDeathMs));text(cards[3].querySelector("div > em"),"WCL");text(cards[3].querySelector("small"),`${latest.meaningfulDeaths} meaningful deaths`);}}
  const brief=document.querySelector(".rl-brief");if(brief&&latest){text(brief.querySelector(".brief-label b"),"PULL BRIEF");text(brief.querySelector(".brief-label small"),"Generated from closed-pull WCL facts");const imp=cmp?.improvements?.[0],reg=cmp?.regressions?.[0];text(brief.querySelector(".brief-copy h3"),cmp?`Pull ${latest.pullNumber}: ${imp?"gain detected":"no confirmed gain"}${reg?" · regression detected":""}`:`Pull ${latest.pullNumber} synced`);text(brief.querySelector(".brief-copy p"),cmp?`${imp?`${imp.label}: ${pullSignalDelta(imp)}. `:""}${reg?`${reg.label}: ${pullSignalDelta(reg)}. `:""}Root cause is intentionally not inferred until the encounter rule pack and defensive engine are active.`:"Need a previous completed pull for delta analysis.");text(brief.querySelector(".badge"),"FACTUAL DELTA");}
  const improved=panelByTitle("What improved"),regressed=panelByTitle("What regressed");const fillSignals=(panel,signals,empty)=>{if(!panel)return;const rows=qsa(".live-signals p",panel),list=Array.isArray(signals)?signals:[];rows.forEach((row,idx)=>{const sig=list[idx];if(!sig&&idx>0){row.style.display="none";return;}row.style.display="";text(row.querySelector("strong"),sig?pullSignalDelta(sig):"—");text(row.querySelector("span b"),sig?.label||empty);text(row.querySelector("span small"),sig?describePullSignal(sig):"No defensible directional signal in the current comparison.");});};const comparisonSub=prev?`Pull ${latest?.pullNumber} vs Pull ${prev.pullNumber}${cmp?.skippedRawPulls?` · ${cmp.skippedRawPulls} called-wipe/reset skipped`:""}`:"Need previous analytical pull";if(improved){text(improved.querySelector(".panel-title p"),comparisonSub);fillSignals(improved,cmp?.improvements,"No confirmed improvement");}if(regressed){text(regressed.querySelector(".panel-title p"),comparisonSub);fillSignals(regressed,cmp?.regressions,"No confirmed regression");}
  const timeline=panelByTitle("Pull timeline");if(timeline){text(timeline.querySelector(".panel-title p"),"Latest pull stage/death markers · per-pull graph ingestion pending");clearSyntheticChart(timeline.querySelector(".raid-chart"),"Per-pull WCL graph not loaded for latest pull");const calls=qsa(".timeline-calls > span",timeline);calls.forEach(x=>x.style.display="none");if(latest){const stages=latest.stages||[];stages.slice(1,3).forEach((st,idx)=>{const el=calls[idx];if(!el||st.startTime==null)return;el.style.display="";el.style.left=`${Math.min(96,100*(Number(st.startTime)-Number(stages[0]?.startTime||0))/Math.max(1,latest.durationMs))}%`;el.innerHTML=`<i class="info"></i>STAGE ${idx+2}`;});if(latest.firstDeathMs!=null&&calls[3]){calls[3].style.display="";calls[3].style.left=`${Math.min(96,100*latest.firstDeathMs/Math.max(1,latest.durationMs))}%`;calls[3].innerHTML=`<i class="bad"></i>FIRST DEATH`;}}}
  const raiders=qsa(".live-raiders > div:not(.lr-head)");const watched=(telemetry?.players||[]).slice().sort((x,y)=>(y.encounter?.firstDeaths||0)-(x.encounter?.firstDeaths||0)||(y.encounter?.meaningfulDeaths||0)-(x.encounter?.meaningfulDeaths||0)).slice(0,raiders.length);raiders.forEach((row,idx)=>{const p=watched[idx];if(!p){row.style.display="none";return;}row.style.display="";row.className="";const cells=Array.from(row.children),enc=p.encounter||p,use=telemetry?.consumables?.detectedUsesByPlayerName?.[String(p.name).toLowerCase()]||{};if(cells[0]){text(cells[0].querySelector("i"),String(p.name)[0]);text(cells[0].querySelector("b"),p.name);}if(cells[1])text(cells[1],`${enc.firstDeaths??0} first deaths`);if(cells[2])text(cells[2],`${enc.interrupts??0} interrupts`);if(cells[3])text(cells[3],"PENDING");if(cells[4])text(cells[4],`HS ${use.healthstone||0} · POT ${use.potion||0}`);if(cells[5])text(cells[5],"OBSERVED");});const rr=panelByTitle("Raider review");if(rr)text(rr.querySelector(".panel-title p"),"Encounter-level facts · no per-player blame/causality yet");
  const next=document.querySelector(".next-pull");if(next){text(next.querySelector(".next-title .badge"),"NEXT PULL");text(next.querySelector(".next-title h3"),"Three calls unlock with causality");text(next.querySelector(".next-title p"),"v3.3 will not manufacture prescriptive calls from raw correlations.");const items=qsa("ol li",next);const messages=[["Protect the confirmed gain",cmp?.improvements?.[0]?`${cmp.improvements[0].label}: ${pullSignalDelta(cmp.improvements[0])}.`:"No confirmed gain to preserve yet."],["Mechanic call pending","Belo'ren rule pack is required to distinguish real mechanic failures from observed damage."],["Defensive call pending","Cooldown availability and lethal-window reconstruction are required before naming missed personals."]];items.forEach((li,i)=>{const m=messages[i];text(li.querySelector("b"),m[0]);text(li.querySelector("small"),m[1]);});}
  const note=document.querySelector(".prototype-note");if(note){text(note.querySelector(".badge"),"DATA TRUTH");text(note.querySelector("p"),"LIVE uses real closed-pull WCL facts and polls for new fights. Root-cause, Reliability and prescriptive calls stay PENDING until their engines are evidence-complete.");}
}


function fmtDeltaPctPoints(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}pp`;
}

function setPanelSubtitle(title, value) {
  const panel = panelByTitle(title);
  const p = panel?.querySelector(".panel-title p");
  if (p) text(p, value);
}

function telemetryPlayerNameMap() {
  return telemetry?.players || [];
}

function roleLabel(p) {
  const role = p?.role || "";
  if (role === "HEAL") return "HEAL";
  if (role === "TANK") return "TANK";
  return "DPS";
}

function playerOutput(p) {
  if (!p) return "—";
  const bp = p.bestPull || p;
  if (p.role === "HEAL") return `${fmtCompact(bp.hps)} HPS`;
  return `${fmtCompact(bp.dps)} DPS`;
}

function reliabilityValue(p) {
  const raw = p?.reliability?.value;
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.round(value) : null;
}

function reliabilityText(p) {
  const value = reliabilityValue(p);
  return value == null ? "—" : String(value);
}

function reliabilityMeta(p) {
  const value = reliabilityValue(p);
  if (value != null) return p?.reliability?.confidence ? `${String(p.reliability.confidence).toUpperCase()} CONF.` : "CALCULATED";
  return "PENDING";
}

function applyTelemetryDamageHealing() {
  if (!telemetry?.throughput) return;
  const heading = qsa(".page-banner h2").find(x => x.textContent.trim() === "Damage & Healing");
  if (!heading) return;

  const t = telemetry.throughput;
  const phases = t.phases || {};
  const bars = document.querySelector(".benchmark-bars");
  if (bars) {
    const rows = qsa(":scope > .benchbar", bars);
    const phaseData = [
      ["P1 DAMAGE", phases.p1?.dps],
      ["P2 DAMAGE", phases.p2?.dps],
      ["P3 DAMAGE", phases.p3?.dps],
      ["P1 HEALING", phases.p1?.hps],
      ["P2 HEALING", phases.p2?.hps],
      ["P3 HEALING", phases.p3?.hps]
    ];
    const max = Math.max(1, ...phaseData.map(x => Number(x[1]) || 0));
    rows.forEach((row, idx) => {
      const d = phaseData[idx];
      if (!d) return;
      text(row.querySelector("label"), d[0]);
      const tracks = qsa("div i, div u", row);
      if (tracks[0]?.style) tracks[0].style.width = `${Math.max(0, Math.min(100, (Number(d[1])||0)/max*100))}%`;
      if (tracks[1]?.style) tracks[1].style.width = "0%";
      text(row.querySelector("b"), fmtCompact(d[1]));
      text(row.querySelector("small"), "—");
    });
    const legend = bars.closest(".panel")?.querySelector(".bench-legend");
    const spans = qsa("span", legend);
    if (spans[0]) text(spans[0], "Avoid · real WCL");
    if (spans[1]) text(spans[1], "Peer sample pending");
  }

  const diagnostics = panelByTitle("Output diagnostics");
  if (diagnostics) {
    const cards = qsa(".diag", diagnostics);
    if (cards[0]) {
      text(cards[0].querySelector(".badge"), "OBSERVED");
      text(cards[0].querySelector("b"), "Best-pull damage loaded");
      text(cards[0].querySelector("p"), `${fmtCompact(t.best?.dps)} raid DPS from WCL. Kill sufficiency is not asserted without enrage/peer model.`);
    }
    if (cards[1]) {
      text(cards[1].querySelector(".badge"), "OBSERVED");
      text(cards[1].querySelector("b"), "Best-pull healing loaded");
      text(cards[1].querySelector("p"), `${fmtCompact(t.best?.hps)} raid HPS from WCL. HPS alone is not treated as healing sufficiency.`);
    }
    if (cards[2]) {
      text(cards[2].querySelector(".badge"), "PENDING");
      text(cards[2].querySelector("b"), "Preventable spike deaths");
      text(cards[2].querySelector("p"), "Needs HP resources, mitigation model and death classification.");
    }
    if (cards[3]) {
      text(cards[3].querySelector(".badge"), "PENDING");
      text(cards[3].querySelector("b"), "Cooldown stacking");
      text(cards[3].querySelector("p"), "Buff intervals are loaded; raid-CD classification and assignment plan are next.");
    }
  }

  const benchPanel=panelByTitle("Avoid vs kill benchmark"); if(benchPanel){text(benchPanel.querySelector(".panel-title h3"),"Phase output");text(benchPanel.querySelector(".panel-title p"),"Phase-normalized Avoid output · peer sample pending");}
  const chart=document.querySelector(".bigchart .raid-chart");
  const mode=document.querySelector(".mode-toggle button.active")?.textContent?.trim().toLowerCase()==="healing"?"healing":"damage";
  const graph=mode==="healing"?telemetry.graphs?.healing:telemetry.graphs?.damage;
  const rendered=renderWclGraph(chart,graph,mode);
  setPanelSubtitle("Raid damage timeline", `Pull ${telemetry.bestPull?.pullNumber ?? "—"} · ${rendered?"real WCL time series":"graph unavailable"}`);
  setPanelSubtitle("Raid healing timeline", `Pull ${telemetry.bestPull?.pullNumber ?? "—"} · ${rendered?"real WCL time series":"graph unavailable"}`);
  const footer=document.querySelector(".bigchart .chart-footer"); if(footer){const spans=qsa(":scope > span",footer);if(spans[0])text(spans[0],"AVOID · WCL");if(spans[1])text(spans[1],"PEER SAMPLE PENDING");const fp=footer.querySelector("p");if(fp)fp.innerHTML=`<b>Observed WCL graph</b> · Peer and mechanic overlays are intentionally disabled until their cohorts/rule packs exist.`;}
}

function classifyMelee(p) {
  const cls = String(p.className || "").toLowerCase();
  const spec = String(p.spec || "").toLowerCase();
  if (p.role === "TANK" || p.role === "HEAL") return null;
  const meleeClasses = ["death knight","demon hunter","monk","paladin","rogue","warrior"];
  if (meleeClasses.some(x => cls.includes(x))) return "MELEE";
  if (cls.includes("shaman") && (spec.includes("enh") || spec.includes("mejora"))) return "MELEE";
  if (cls.includes("druid") && (spec.includes("feral") || spec.includes("feral"))) return "MELEE";
  if (cls.includes("hunter") && spec.includes("survival")) return "MELEE";
  return "RANGED";
}

const WOW_CLASSES = ["DeathKnight","DemonHunter","Druid","Evoker","Hunter","Mage","Monk","Paladin","Priest","Rogue","Shaman","Warlock","Warrior"];
const WOW_CLASS_LABELS = {DeathKnight:"Death Knight",DemonHunter:"Demon Hunter",Druid:"Druid",Evoker:"Evoker",Hunter:"Hunter",Mage:"Mage",Monk:"Monk",Paladin:"Paladin",Priest:"Priest",Rogue:"Rogue",Shaman:"Shaman",Warlock:"Warlock",Warrior:"Warrior"};
const WOW_CLASS_COLORS = {DeathKnight:"#C41E3A",DemonHunter:"#A330C9",Druid:"#FF7C0A",Evoker:"#33937F",Hunter:"#AAD372",Mage:"#3FC7EB",Monk:"#00FF98",Paladin:"#F48CBA",Priest:"#FFFFFF",Rogue:"#FFF468",Shaman:"#0070DD",Warlock:"#8788EE",Warrior:"#C69B6D"};
const CLASS_UTILITY_GAPS = {Monk:"Mystic Touch (physical-damage vulnerability)"};
function classKey(value){ return String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase(); }
function cleanTalentName(value){ const s=String(value??"").trim(); return s&&!/^(?:spell\s+(?:null|undefined)|null|undefined|node\s+\d+|entry\s+\d+)$/i.test(s)?s:""; }
function hasResolvedTalent(t){ return Boolean(cleanTalentName(t?.name)) || (Number.isFinite(Number(t?.spellId))&&Number(t.spellId)>0); }
function classDisplay(value){ const wanted=classKey(value); const canonical=WOW_CLASSES.find(c=>classKey(c)===wanted); return canonical ? WOW_CLASS_LABELS[canonical] : (value || "Unknown"); }

function rosterCharacterMeta(p) {
  const ch=p?.character||{};
  const talents=Array.isArray(ch.talents)?ch.talents:[];
  const resolvedTalents=talents.filter(hasResolvedTalent);
  return {
    gearCount:Number(ch.gearCount)||0,
    powerGearCount:Number(ch.powerGearCount)||0,
    recordedItemLevelMean:Number.isFinite(Number(ch.recordedItemLevelMean))?Number(ch.recordedItemLevelMean):null,
    talentCount:Number(ch.talentCount)||0,
    talentPoints:Number(ch.talentPoints)||0,
    resolvedTalentCount:resolvedTalents.length,
    buildFingerprint:ch.buildFingerprint||null,
    talentImportCode:typeof ch.talentImportCode==="string"&&ch.talentImportCode.trim()?ch.talentImportCode.trim():null,
    talentWowheadUrl:typeof ch.talentWowheadUrl==="string"&&ch.talentWowheadUrl.trim()?ch.talentWowheadUrl.trim():null,
    gear:Array.isArray(ch.gear)?ch.gear:[],
    talents,
    resolvedTalents
  };
}

function removeRosterIntelligenceOutsideComposition() {
  const isComposition=qsa(".page-banner h2").some(x=>x.textContent.trim()==="Composition Intelligence");
  const panel=document.querySelector(".roster-intelligence-panel");
  if(panel) panel.style.display=isComposition?"":"none";
}

function buildRosterIntelligencePanel(players) {
  const existing=document.querySelector(".roster-intelligence-panel"); const classPanel=document.querySelector(".spec-grid")?.closest("article.panel"); if(!classPanel)return existing;
  const panel=existing||document.createElement("article"); if(!existing){panel.className="panel roster-intelligence-panel";classPanel.insertAdjacentElement("afterend",panel);} panel.style.display=""; panel.replaceChildren();
  const title=document.createElement("div");title.className="panel-title";const idx=document.createElement("i");idx.textContent="04";const tc=document.createElement("div");const h3=document.createElement("h3");h3.textContent="Roster intelligence";const sub=document.createElement("p");sub.textContent="Real WCL character facts · item links/tooltips by Wowhead · Reliability shared with Players";tc.append(h3,sub);title.append(idx,tc);panel.append(title);
  const counts={};for(const p of players){const key=classKey(p.className);if(key)counts[key]=(counts[key]||0)+1;}const missing=WOW_CLASSES.filter(c=>!counts[classKey(c)]);const ilvls=players.map(p=>Number(p.itemLevel)).filter(Number.isFinite);const avg=ilvls.length?ilvls.reduce((a,b)=>a+b,0)/ilvls.length:null;const coverage=telemetry?.playerProfiles?.coverage;
  const resolvedProfiles=players.filter(p=>{const m=rosterCharacterMeta(p);return Boolean(m.talentImportCode)||m.resolvedTalentCount>0;}).length;const summary=document.createElement("div");summary.className="roster-intel-summary";for(const [label,value] of [["RAIDERS",players.length],["CLASSES",`${Object.keys(counts).length}/${WOW_CLASSES.length}`],["AVG ILVL",avg==null?"—":avg.toFixed(1)],["MISSING",missing.length?missing.map(classDisplay).join(", "):"None"],["GEAR DATA",coverage?`${coverage.withGear}/${coverage.roster}`:"—"],["TALENTS RESOLVED",`${resolvedProfiles}/${players.length}`]]){const box=document.createElement("div"),l=document.createElement("label"),b=document.createElement("b");l.textContent=label;b.textContent=String(value);box.append(l,b);summary.append(box);}panel.append(summary);
  const table=document.createElement("div");table.className="composition-roster-table";const head=document.createElement("div");head.className="crt-head";for(const label of ["PLAYER","CLASS / SPEC","ROLE","ILVL","GEAR","TALENTS","OUTPUT","RELIABILITY"]){const x=document.createElement("span");x.textContent=label;head.append(x);}table.append(head);
  const roleRank={TANK:0,HEAL:1,DPS:2};const sorted=players.slice().sort((a,b)=>(roleRank[a.role]??9)-(roleRank[b.role]??9)||String(a.className).localeCompare(String(b.className))||String(a.name).localeCompare(String(b.name)));
  for(const p of sorted){const meta=rosterCharacterMeta(p),enc=p.encounter||p;const row=document.createElement("div");row.className="crt-row";row.dataset.actorId=String(p.actorId);const main=document.createElement("button");main.type="button";main.className="crt-main";
    const player=document.createElement("span");player.className="crt-player";const icon=document.createElement("i");icon.textContent=String(p.name||"?")[0];const pc=document.createElement("span"),pb=document.createElement("b"),ps=document.createElement("small");pb.textContent=p.name;ps.textContent=`${enc.firstDeaths??0} first deaths · ${enc.interrupts??0} interrupts`;pc.append(pb,ps);player.append(icon,pc);
    const cs=document.createElement("span"),csb=document.createElement("b"),css=document.createElement("small");csb.textContent=classDisplay(p.className);css.textContent=p.spec||"Unknown spec";cs.append(csb,css);const role=document.createElement("span");role.className=`crt-role ${String(p.role||"").toLowerCase()}`;role.textContent=roleLabel(p);const ilvl=document.createElement("b");ilvl.textContent=p.itemLevel??"—";
    const gear=document.createElement("span"),gb=document.createElement("b"),gs=document.createElement("small");gb.textContent=meta.gearCount?`${meta.gearCount} equipped`:"—";gs.textContent=meta.gearCount?`WCL character ilvl ${p.itemLevel??"—"}`:"CombatantInfo pending";gear.append(gb,gs);
    const talents=document.createElement("span"),tb=document.createElement("b"),ts=document.createElement("small");tb.textContent=meta.talentImportCode?"Exact build":meta.resolvedTalentCount?`${meta.resolvedTalentCount} resolved`:"—";ts.textContent=meta.talentImportCode?"WCL import code · Wowhead":meta.resolvedTalentCount?"Named talents from WCL/Wowhead":meta.talentCount?"Raw node IDs hidden":"CombatantInfo pending";talents.append(tb,ts);const output=document.createElement("b");output.textContent=playerOutput(p);const rel=document.createElement("span");rel.className="crt-reliability";const rb=document.createElement("b"),rs=document.createElement("small");rb.textContent=reliabilityText(p);rs.textContent=reliabilityMeta(p);rel.append(rb,rs);main.append(player,cs,role,ilvl,gear,talents,output,rel);
    const detail=document.createElement("div");detail.className="crt-detail";detail.hidden=true;const gearBlock=document.createElement("div"),gh=document.createElement("h4");gh.textContent="EQUIPMENT · BEST PULL COMBATANT INFO";gearBlock.append(gh);const gearList=document.createElement("div");gearList.className="crt-chips gear-list";
    if(meta.gear.length){for(const item of meta.gear){const chip=document.createElement("span");chip.className="crt-data-chip gear-chip";const sl=document.createElement("small");sl.textContent=item.slot||"Item";const link=makeWowheadLink(item.wowhead,item.name|| (item.id!=null?`Item #${item.id}`:"Item"));const m=document.createElement("em");m.textContent=item.itemLevel?`ilvl ${item.itemLevel}`:"";chip.append(sl,link,m);gearList.append(chip);}}else{const empty=document.createElement("p");empty.textContent="WCL did not expose normalized gear for this player in the selected CombatantInfo slice.";gearList.append(empty);}gearBlock.append(gearList);
    const talentBlock=document.createElement("div"),th=document.createElement("h4");th.textContent="TALENTS · BEST PULL BUILD";talentBlock.append(th);const talentList=document.createElement("div");talentList.className="crt-chips talents";
    if(meta.talentImportCode){
      const chip=document.createElement("span");chip.className="crt-data-chip talent-chip talent-build-link";
      const ref={url:meta.talentWowheadUrl||`https://www.wowhead.com/talent-calc/blizzard/${encodeURIComponent(meta.talentImportCode)}`};
      const link=makeWowheadLink(ref,"Open exact talent build on Wowhead");
      const m=document.createElement("em");m.textContent="WCL talent import code";
      chip.append(link,m);talentList.append(chip);
    }else if(meta.resolvedTalents.length){
      for(const t of meta.resolvedTalents){const spellId=Number(t?.spellId);const name=cleanTalentName(t?.name);if(!name&&!(Number.isFinite(spellId)&&spellId>0))continue;const chip=document.createElement("span");chip.className="crt-data-chip talent-chip";const label=name||`Spell ${spellId}`;const link=makeWowheadLink(t.wowhead,label);const m=document.createElement("em");m.textContent=t.rank!=null?`rank ${t.rank}`:"";chip.append(link,m);talentList.append(chip);}
    }else{
      const empty=document.createElement("p");empty.textContent=meta.talentCount?"WCL exposed only opaque trait node IDs for this pull. They are hidden until a canonical talent import code or named spell is available.":"Talent data is not present in the selected pull.";
      talentList.append(empty);
    }talentBlock.append(talentList);detail.append(gearBlock,talentBlock);
    main.addEventListener("click",ev=>{if(ev.target?.closest?.("a"))return;detail.hidden=!detail.hidden;row.classList.toggle("expanded",!detail.hidden);if(!detail.hidden)setTimeout(refreshWowheadLinks,0);});row.append(main,detail);table.append(row);
  }
  panel.append(table);setTimeout(refreshWowheadLinks,0);return panel;
}

function applyTelemetryComposition() {
  if (!telemetry?.players?.length) return;
  const heading = qsa(".page-banner h2").find(x => x.textContent.trim() === "Composition Intelligence");
  if (!heading) return;
  const cbanner=document.querySelector(".page-banner"); if(cbanner){text(cbanner.querySelector(".badge"),"WCL ROSTER INTELLIGENCE");text(cbanner.querySelector(":scope > div > p"),"Current roster, roles, item level and CombatantInfo from WCL. Peer composition and build prevalence are pending.");}

  const players = telemetry.players;
  const tanks = players.filter(p => p.role === "TANK").length;
  const healers = players.filter(p => p.role === "HEAL").length;
  const melee = players.filter(p => classifyMelee(p) === "MELEE").length;
  const ranged = players.filter(p => classifyMelee(p) === "RANGED").length;

  setStat("TANKS", { value:tanks, delta:"WCL", meta:"Selected best-pull roster" });
  setStat("HEALERS", { value:healers, delta:"WCL", meta:"Selected best-pull roster" });
  setStat("MELEE DPS", { value:melee, delta:"WCL", meta:"Spec/class derived" });
  setStat("RANGED DPS", { value:ranged, delta:"WCL", meta:"Spec/class derived" });
  setPendingStat("UNIQUE RAID BUFFS", "Utility catalogue not enabled");

  const banner = document.querySelector(".banner-stat");
  if (banner?.querySelector("label")?.textContent.trim() === "COMPOSITION FIT") { text(banner.querySelector("b"), "—"); text(banner.querySelector("small"), "peer kill sample pending"); }

  const role = panelByTitle("Role distribution");
  if (role) {
    text(role.querySelector(".panel-title p"),"Current best-pull roster · peer overlay pending");
    const total = Math.max(1, players.length);
    const vals = [["TANK", tanks],["HEALER", healers],["MELEE", melee],["RANGED", ranged]];
    const rows = qsa(".role-comp > div", role).filter(x => x.querySelector("label"));
    rows.forEach((row, idx) => { const d=vals[idx]; if(!d)return; const pct=100*d[1]/total; text(row.querySelector("label"),d[0]); const tracks=qsa("div i, div u",row); if(tracks[0]?.style)tracks[0].style.width=`${Math.min(100,pct*2)}%`; if(tracks[1]?.style)tracks[1].style.width="0%"; text(row.querySelector("b"),`${pct.toFixed(0)}%`); text(row.querySelector("small"),"—"); });
    const legend=qsa(".bench-legend span",role);if(legend[0])text(legend[0],"Avoid · WCL");if(legend[1])text(legend[1],"Peer sample pending");
    const insight=role.querySelector(".insight-box"); if(insight){text(insight.querySelector(".badge"),"REAL ROSTER");text(insight.querySelector("p"),`${tanks} tanks · ${healers} healers · ${melee} melee · ${ranged} ranged. Roster Intelligence below now exposes each player, gear/talent coverage and Reliability.`);}
  }

  const counts={}; for(const p of players){const k=classKey(p.className);if(k)counts[k]=(counts[k]||0)+1;}
  const classPanel=document.querySelector(".spec-grid")?.closest("article.panel");if(classPanel)text(classPanel.querySelector(".panel-title p"),"Current roster class counts · peer representation pending");
  const specGrid=document.querySelector(".spec-grid");
  if(specGrid){
    specGrid.replaceChildren();
    for(const cls of WOW_CLASSES){
      const own=counts[classKey(cls)]||0;
      const row=document.createElement("div");
      const label=document.createElement("span"),dot=document.createElement("i");dot.style.background=WOW_CLASS_COLORS[cls];label.append(dot,document.createTextNode(classDisplay(cls)));
      const bars=document.createElement("div");bars.className="spec-bars";const ownBar=document.createElement("i"),peerBar=document.createElement("u");ownBar.style.width=`${Math.min(100,own*42)}%`;ownBar.style.background=WOW_CLASS_COLORS[cls];peerBar.style.width="0%";bars.append(ownBar,peerBar);
      const value=document.createElement("b");value.textContent=String(own);const peer=document.createElement("small");peer.textContent="—";
      row.append(label,bars,value,peer);specGrid.append(row);
    }
  }

  const verdict=panelByTitle("Composition verdict");
  if(verdict){text(verdict.querySelector(".panel-title p"),"Observed roster facts · recommendations wait for Reliability + peer cohorts");const cards=qsa(".diag",verdict);const missing=WOW_CLASSES.filter(c=>!counts[classKey(c)]);const utilityGaps=missing.map(c=>CLASS_UTILITY_GAPS[c]).filter(Boolean);const coverageText=missing.length?`Missing: ${missing.map(classDisplay).join(", ")}.${utilityGaps.length?` Raid utility gap: ${utilityGaps.join(" · ")}.`:""}`:`All ${WOW_CLASSES.length} retail classes are represented in this roster.`;const messages=[["OBSERVED","Current roster",`${players.length} players: ${tanks} tank / ${healers} heal / ${melee} melee / ${ranged} ranged.`],[missing.length?"WARN":"OBSERVED","Class coverage",coverageText],["PENDING","Peer role comparison","Requires matched public first-kill sample."],["PENDING","Composition recommendation","Will combine player Reliability, gear/talents, utility and peer kills; no recommendation is asserted yet."]];cards.forEach((c,idx)=>{const m=messages[idx];if(!m)return;text(c.querySelector(".badge"),m[0]);text(c.querySelector("b"),m[1]);text(c.querySelector("p"),m[2]);});}

  buildRosterIntelligencePanel(players);
}

function applyLiveStatus(status) {
  if (!status?.ok) return;
  const heading = qsa(".live-command h2").find(x => x.textContent.trim() === "Raid Night Control Room");
  if (!heading) return;

  const meta = qsa(".stream-meta span");
  if (meta[0]) meta[0].innerHTML = `<i></i>WCL REPORT <b>${status.report.code}</b>`;
  if (meta[1]) meta[1].innerHTML = `LAST CHECK <b>${new Date(status.generatedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"})}</b>`;
  if (meta[2]) meta[2].innerHTML = `QUEUE <b>${status.encounter?.latestFight?.inProgress ? "1 active pull" : "0 pulls"}</b>`;

  const badge = document.querySelector(".live-command .badge");
  if (badge) text(badge, status.encounter?.latestFight?.inProgress ? "● LIVE PULL" : "● WCL CONNECTED");

  const rail = document.querySelector(".rail-head b");
  if (rail) text(rail, `${status.encounter?.totalPulls ?? 0} total`);
}

function applyTelemetryCoreCorrections() {
  if (!telemetry?.ok) return;
  if (telemetry.deaths && findOwnText("Command Center")) {
    setStat("EARLY DEATHS", {
      value: telemetry.deaths.earlyDeaths ?? "—",
      delta: telemetry.deaths.earlyDeaths == null ? "PENDING" : "EVENTS",
      meta: telemetry.deaths.earlyDeaths == null ? "Death event analysis unavailable" : `First death before stage ${telemetry.deaths.targetEarlyStage ?? 3} · WCL events`
    });
  }
}


function refreshWowheadLinks() {
  try {
    if (window.WH?.Tooltips?.refreshLinks) window.WH.Tooltips.refreshLinks();
    else if (window.$WowheadPower?.refreshLinks) window.$WowheadPower.refreshLinks();
  } catch (e) { console.warn("[AvoiD Wowhead]", e); }
}

function makeWowheadLink(ref, fallbackText) {
  const a=document.createElement("a");
  a.className="wowhead-link"; a.target="_blank"; a.rel="noreferrer noopener";
  a.textContent=fallbackText || "Open Wowhead";
  if (ref?.url) a.href=ref.url; else a.href=`https://www.wowhead.com/search?q=${encodeURIComponent(fallbackText||"")}`;
  if (ref?.dataWowhead) a.dataset.wowhead=ref.dataWowhead;
  return a;
}

function pullSignalDelta(signal) {
  if (!signal || signal.delta == null) return "—";
  const d=Number(signal.delta);
  if (!Number.isFinite(d)) return "—";
  if (signal.key === "progress") return `${d<=0?"+":""}${(-d).toFixed(1)}pp deeper`;
  if (signal.key === "firstDeath") return `${d>=0?"+":""}${(d/1000).toFixed(1)}s`;
  if (signal.key === "meaningfulDeaths") return `${d>0?"+":""}${d.toFixed(0)}`;
  if (signal.key === "stage") return `${d>=0?"+":""}${d.toFixed(0)}`;
  if (signal.key === "raidDps" || signal.key === "raidHps") {
    const base=Number(signal.baseline); return base?`${(d/base*100)>=0?"+":""}${(d/base*100).toFixed(1)}%`:"—";
  }
  return String(d);
}

function describePullSignal(signal) {
  if (!signal) return "No comparable data.";
  if (signal.key === "progress") return `WCL fightPercentage ${fmtPct(signal.current)} vs ${fmtPct(signal.baseline)}. Lower means deeper encounter progress.`;
  if (signal.key === "firstDeath") return `First friendly death ${fmtDuration(signal.current)} vs ${fmtDuration(signal.baseline)}.`;
  if (signal.key === "meaningfulDeaths") return `${signal.current} deaths before WCL wipe cutoff vs ${signal.baseline}.`;
  if (signal.key === "stage") return `Reached stage ${signal.current} vs stage ${signal.baseline}.`;
  if (signal.key === "raidDps") return signal.status === "observed" ? `Raid DPS ${fmtCompact(signal.current)} vs ${fmtCompact(signal.baseline)}; not scored because stage reach differs.` : `Same-stage raid DPS ${fmtCompact(signal.current)} vs ${fmtCompact(signal.baseline)}.`;
  if (signal.key === "raidHps") return `Raid HPS ${fmtCompact(signal.current)} vs ${fmtCompact(signal.baseline)}; shown as demand context, not as better/worse.`;
  return signal.evidence || "WCL observation.";
}

function renderWclGraph(chart, graph, mode="damage") {
  if (!chart) return false;
  const series=graph?.data?.series || graph?.series || [];
  const total=series.find(x=>String(x.id)==="Total"||String(x.name).toLowerCase()==="total") || null;
  const values=(total?.data||[]).map(Number).filter(Number.isFinite);
  const svg=chart.querySelector(".linechart, svg");
  if (!svg || values.length<2) {
    qsa("polyline,polygon",chart).forEach(el=>el.setAttribute("points",""));
    qsa(".event",chart).forEach(el=>el.style.display="none");
    return false;
  }
  const max=Math.max(1,...values); const min=Math.min(0,...values);
  const points=values.map((v,i)=>{const x=3+i/(values.length-1)*94;const y=86-(v-min)/(max-min||1)*76;return `${x},${y}`}).join(" ");
  const poly=svg.querySelector("polyline"); const area=svg.querySelector("polygon");
  if(poly)poly.setAttribute("points",points);
  if(area)area.setAttribute("points",`3,86 ${points} 97,86`);
  qsa(".event",chart).forEach(el=>el.style.display="none");
  const y=qsa(".chart-y span",chart); if(y[0])text(y[0],fmtCompact(max)); if(y[1])text(y[1],fmtCompact(max/2)); if(y[2])text(y[2],"0");
  return true;
}

function clearSyntheticChart(root, message) {
  if (!root) return;
  qsa("polyline,polygon",root).forEach(el=>el.setAttribute("points",""));
  qsa(".event",root).forEach(el=>el.style.display="none");
  root.dataset.dataTruth="pending";
  if (message) root.title=message;
}

function applyPullIntelligenceToCommand() {
  if (!findOwnText("Command Center")) return;
  const pi=telemetry?.pullIntelligence; const cmp=pi?.currentVsPrevious; const what=panelByTitle("What changed?");
  if (!what || !pi?.latest) return;
  text(what.querySelector(".panel-title p"), cmp?`Pull ${pi.latest.pullNumber} vs Pull ${pi.previous?.pullNumber} · factual WCL deltas`:"Need at least two completed pulls");
  const rows=qsa(".change",what); const imp=cmp?.improvements?.[0]; const reg=cmp?.regressions?.[0];
  const set=(row,label,sig,fallback)=>{if(!row)return;text(row.querySelector("label"),label);text(row.querySelector("b"),sig?.label||fallback);text(row.querySelector("p"),sig?describePullSignal(sig):"No defensible directional signal in this comparison.");text(row.querySelector("strong"),sig?pullSignalDelta(sig):"—");};
  set(rows[0],"BIGGEST GAIN",imp,"No confirmed gain");
  set(rows[1],"BIGGEST REGRESSION",reg,"No confirmed regression");
  if(rows[2]){text(rows[2].querySelector("label"),"ROSTER CHANGE");text(rows[2].querySelector("b"),cmp?.rosterChanged?"Roster changed":"Same roster fingerprint");text(rows[2].querySelector("p"),cmp?.rosterChanged?"Roster membership differs between the two pulls; no causal effect is inferred.":"No roster-membership change detected between these two pulls.");text(rows[2].querySelector("strong"),cmp?.rosterChanged?"YES":"NO");}
}

function finishDataTruthBoot(errorMessage = null) {
  const boot=document.getElementById("raidops-boot");
  if(errorMessage){
    if(boot){boot.classList.add("error");text(boot.querySelector("b"),"WCL DATA ERROR");text(boot.querySelector("span"),String(errorMessage).slice(0,180));text(boot.querySelector("small"),"Golden mock content is intentionally hidden until real telemetry is available.");}
    return;
  }
  document.documentElement.classList.remove("raidops-booting");
  if(boot)boot.remove();
}

function applyDataTruthScrub() {
  const forbidden=["Nether Eruption","Cosmic Shard","Fractured Dominion","King's Command","Void Collapse","Astral Scar","Krynn","Veyra","Thorne","Mirael","Ravok","Sylen","AVD-7K2P9"];
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const hits=[]; while(walker.nextNode()){const n=walker.currentNode;if(forbidden.some(x=>String(n.nodeValue||"").includes(x)))hits.push(n);}
  for(const n of hits){n.nodeValue="PENDING";}
  document.body.dataset.dataTruth="real-derived-or-pending";
}


function confidenceLabel(value) {
  const v=String(value||"unknown").toUpperCase();
  return ["CONFIRMED","HIGH","MEDIUM","LOW"].includes(v)?v:"UNKNOWN";
}

function intelligenceMechanicMap() {
  return new Map((intelligence?.mechanics?.mechanics||[]).map(m=>[m.key,m]));
}

function playerNameById(actorId) {
  const id=Number(actorId);
  return (telemetry?.players||[]).find(p=>Number(p.actorId)===id)?.name || `Actor ${actorId}`;
}

function applyIntelligenceCommandCenter() {
  if(!intelligence?.status||intelligence.status!=="ready") return;
  const blockerPanel=panelByTitle("Current blocker");
  const blocker=intelligence?.blocker?.blocker;
  if(!blockerPanel||!blocker) return;
  const details=intelligenceMechanicMap().get(blocker.key);
  const main=blockerPanel.querySelector(".blocker-main");
  text(main?.querySelector(".badge"), `${confidenceLabel(intelligence.blocker.confidence)} CONFIDENCE`);
  text(main?.querySelector("h3"), blocker.name);
  text(main?.querySelector("p"),
    `${blocker.failedOccurrences??blocker.failures} failed executions / ${blocker.opportunities||"?"} observed opportunities across ${blocker.recurrence} analytical pulls · ${blocker.recentFailures} failed executions in the latest 5 analytical pulls · ${blocker.linkedDeaths} meaningful deaths temporally linked. ${details?.expectedAction||""}`.trim()
  );
  const cards=qsa(".blocker-metrics .stat",blockerPanel);
  const metrics=[
    ["LINKED DEATHS",blocker.linkedDeaths,"TEMPORAL","Meaningful deaths with matching mechanic evidence"],
    ["RECENT FAILURES",blocker.recentFailures,"LAST 5","Failed mechanic executions in latest 5 analytical pulls"],
    ["AFFECTED PULLS",blocker.recurrence,"REPORT",`${blocker.failedOccurrences??blocker.failures} failed executions / ${blocker.opportunities||"?"} opportunities`]
  ];
  cards.forEach((card,idx)=>{
    const m=metrics[idx];if(!m)return;
    text(card.querySelector(":scope > label"),m[0]);
    text(card.querySelector("div > b"),String(m[1]));
    text(card.querySelector("div > em"),m[2]);
    text(card.querySelector(":scope > small"),m[3]);
  });
  text(blockerPanel.querySelector(".panel-title p"),`Belo'ren rule pack · ${intelligence.analysisPopulation?.eligiblePulls??intelligence.encounter?.pulls??0} analytical pulls · called-wipes excluded`);

  const hero=document.querySelector(".overview-hero");
  if(hero){
    const p=hero.querySelector(".hero-copy p");
    if(p)text(p,`${blocker.name} is the strongest current blocker signal. ${blocker.recentFailures} failed executions in the latest 5 analytical pulls; ${blocker.linkedDeaths} meaningful deaths are temporally linked.`);
  }
}

function latestPullActorSignals() {
  const failures=intelligence?.latestPull?.failures||[];
  const chains=intelligence?.latestPull?.deathChains||[];
  const map=new Map();
  for(const f of failures){
    if(f.actorId==null)continue;
    const id=Number(f.actorId),row=map.get(id)||{actorId:id,name:playerNameById(id),failures:[],chains:[]};
    row.failures.push(f);map.set(id,row);
  }
  for(const c of chains){
    if(c.actorId==null)continue;
    const id=Number(c.actorId),row=map.get(id)||{actorId:id,name:c.player||playerNameById(id),failures:[],chains:[]};
    row.chains.push(c);map.set(id,row);
  }
  return [...map.values()].sort((a,b)=>b.chains.length-a.chains.length||b.failures.length-a.failures.length);
}

function applyIntelligenceLive() {
  if(intelligence?.status!=="ready")return;
  const rosterPanel=document.querySelector(".roster-intelligence-panel");if(rosterPanel)rosterPanel.style.display="none";
  const heading=qsa(".live-command h2").find(x=>x.textContent.trim()==="Raid Night Control Room");
  if(!heading)return;

  const blocker=intelligence?.blocker?.blocker;
  const detail=blocker?intelligenceMechanicMap().get(blocker.key):null;
  const brief=document.querySelector(".rl-brief");
  if(brief&&blocker){
    text(brief.querySelector(".brief-label b"),"RAID LEADER BRIEF");
    text(brief.querySelector(".brief-label small"),"Closed-pull delta + Belo'ren classified evidence");
    text(brief.querySelector(".brief-copy h3"),`${blocker.name} · current blocker`);
    const latest=telemetry?.pullIntelligence?.latest,prev=telemetry?.pullIntelligence?.previous,cmp=telemetry?.pullIntelligence?.currentVsPrevious;
    const gain=cmp?.improvements?.[0],reg=cmp?.regressions?.[0];
    text(brief.querySelector(".brief-copy p"),
      `${blocker.recentFailures} failed executions in the latest 5 analytical pulls · ${blocker.linkedDeaths} meaningful deaths linked. ${gain?`Best confirmed gain vs Pull ${prev?.pullNumber}: ${gain.label} ${pullSignalDelta(gain)}. `:""}${reg?`Regression: ${reg.label} ${pullSignalDelta(reg)}. `:""}${detail?.expectedAction||""}`.trim()
    );
    text(brief.querySelector(".badge"),`${confidenceLabel(intelligence.blocker.confidence)} EVIDENCE`);
  }

  const rr=panelByTitle("Raider review");
  if(rr){
    text(rr.querySelector(".panel-title p"),"Latest pull only · players with classified mechanic/death evidence");
    const heads=qsa(".lr-head span",rr);
    const labels=["RAIDER","LATEST PULL","MECHANIC","DEATH LINK","EVIDENCE","RL NOTE"];
    heads.forEach((h,i)=>text(h,labels[i]||h.textContent));
    const rows=qsa(".live-raiders > div:not(.lr-head)",rr);
    const signals=latestPullActorSignals();
    rows.forEach((row,idx)=>{
      const s=signals[idx];
      if(!s){row.style.display="none";return;}
      row.style.display="";
      row.className=s.chains.length?"bad":"";
      const cells=Array.from(row.children);
      if(cells[0]){text(cells[0].querySelector("i"),String(s.name||"?")[0]);text(cells[0].querySelector("b"),s.name);}
      if(cells[1])text(cells[1],`${s.failures.length} failure${s.failures.length===1?"":"s"}`);
      if(cells[2])text(cells[2],[...new Set(s.failures.map(f=>f.mechanicName))].slice(0,2).join(" · ")||"Death evidence");
      if(cells[3])text(cells[3],s.chains.length?`${s.chains.length} linked death${s.chains.length===1?"":"s"}`:"None linked");
      if(cells[4])text(cells[4],s.chains[0]?.confidence?confidenceLabel(s.chains[0].confidence):confidenceLabel(s.failures[0]?.confidence));
      if(cells[5])text(cells[5],s.chains.length?"Review chain":"Fix classified mechanic");
    });
  }

  const next=document.querySelector(".next-pull");
  if(next){
    const calls=intelligence.nextPullCalls||[];
    text(next.querySelector(".next-title .badge"),"NEXT PULL");
    text(next.querySelector(".next-title h3"),calls.length?`${calls.length} evidence-backed calls`:"No prescriptive call yet");
    text(next.querySelector(".next-title p"),calls.length?"Only calls supported by current WCL + rule-pack evidence are shown.":"Raid Ops will not manufacture a call without evidence.");
    const items=qsa("ol li",next);
    items.forEach((li,idx)=>{
      const call=calls[idx];
      text(li.querySelector("b"),call?.title||"No additional defensible call");
      text(li.querySelector("small"),call?.detail||"Keep observing the next closed pull.");
    });
  }
}

function applyIntelligence() {
  applyIntelligenceCommandCenter();
  window.applyIntelligenceMechanics?.();
  window.applyIntelligenceDefensives?.();
  applyIntelligenceLive();
}

function applySupplemental() {
  applyTelemetryCoreCorrections();
  window.applyTelemetryMechanics?.();
  applyTelemetryDamageHealing();
  applyTelemetryComposition();
  window.applyTelemetryDefensives?.();
  window.applyHistoryData?.();
  applyPullIntelligenceToCommand();
}


function applyAll() {
  if (!payload?.ok || applying) return;
  applying = true;
  try {
    removeRosterIntelligenceOutsideComposition();applyShell();applyCommandCenter();applyPullLab();applyDamageHealing();applyComposition();applyLive();applySupplemental();applyIntelligence();removeRosterIntelligenceOutsideComposition();applyDataTruthScrub();
  } finally { applying = false; }
}

function showError(message) {
  const wcl = document.querySelector(".wcl");
  if (wcl) {
    text(wcl.querySelector("b"), "WCL connection error");
    text(wcl.querySelector("small"), String(message).slice(0, 140));
  }
}

async function fetchJson(url) {
  const r = await fetch(url, { headers:{ "Accept":"application/json" } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

async function fetchData(force = false) {
  const now = Date.now();
  if (!force && now - lastFetchAt < 5000) return;
  lastFetchAt = now;

  try {
    const coreUrl = new URL(endpoint);
    if (force) coreUrl.searchParams.set("_", String(Date.now()));
    payload = await fetchJson(coreUrl);
    window.__AVOID_WCL__ = payload;
    applyAll();

    const tUrl = new URL(telemetryEndpoint);
    const hUrl = new URL(historyEndpoint);
    const iUrl = new URL(intelligenceEndpoint);
    if (force) {
      const stamp=String(Date.now());
      tUrl.searchParams.set("_", stamp);
      hUrl.searchParams.set("_", stamp);
      iUrl.searchParams.set("_", stamp);
    }

    const [tResult, hResult, iResult] = await Promise.allSettled([
      fetchJson(tUrl),
      fetchJson(hUrl),
      fetchJson(iUrl)
    ]);

    if (tResult.status === "fulfilled") {
      telemetry = tResult.value;
      window.__AVOID_WCL_TELEMETRY__ = telemetry;
    } else {
      console.warn("[AvoiD WCL telemetry]", tResult.reason);
      throw new Error(`Telemetry unavailable: ${tResult.reason?.message || tResult.reason || "unknown error"}`);
    }

    if (hResult.status === "fulfilled") {
      historyData = hResult.value;
      window.__AVOID_WCL_HISTORY__ = historyData;
    } else {
      console.warn("[AvoiD WCL history]", hResult.reason);
    }

    if (iResult.status === "fulfilled") {
      intelligence = iResult.value;
      window.__AVOID_WCL_INTELLIGENCE__ = intelligence;
    } else {
      intelligence = null;
      console.warn("[AvoiD WCL intelligence]", iResult.reason);
    }

    applyAll();
    finishDataTruthBoot();
  } catch (err) {
    console.error("[AvoiD Raid Ops WCL]", err);
    showError(err?.message || String(err));
    finishDataTruthBoot(err?.message || String(err));
  }
}

let reapplyScheduled = false;
function scheduleReapply() {
  if (!payload || reapplyScheduled) return;
  reapplyScheduled = true;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      reapplyScheduled = false;
      applyAll();
    });
  });
}

document.addEventListener("click", (event) => {
  if (event.target?.closest?.(".roster-intelligence-panel, .corpus-workbench")) return;
  scheduleReapply();
  if (event.target?.closest?.("nav button")) setTimeout(()=>applyAll(), 90);
}, true);

window.addEventListener("popstate", () => scheduleReapply());

let statusTimer = null;
async function pollLiveStatus() {
  try {
    const status = await fetchJson(statusEndpoint);
    window.__AVOID_WCL_STATUS__ = status;
    applyLiveStatus(status);

    const knownPulls = payload?.encounter?.pulls ?? 0;
    const seenPulls = status?.encounter?.totalPulls ?? knownPulls;
    if (seenPulls !== knownPulls && !status?.encounter?.latestFight?.inProgress) {
      await fetchData(true);
    }
  } catch (e) {
    console.warn("[AvoiD WCL status]", e);
  }
}

function startStatusPolling() {
  if (statusTimer) return;
  pollLiveStatus();
  statusTimer = setInterval(pollLiveStatus, 15000);
}

window.addEventListener("DOMContentLoaded", () => { fetchData(false); startStatusPolling(); });
if (document.readyState !== "loading") { fetchData(false); startStatusPolling(); }
