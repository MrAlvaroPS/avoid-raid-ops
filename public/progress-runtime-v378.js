(() => {
  const RELEASE = '3.7.8';
  const state = { range: 'all', selectedPull: null, signature: null };
  const qsa = (sel, root = document) => root ? [...root.querySelectorAll(sel)] : [];
  const qs = (sel, root = document) => root?.querySelector(sel) || null;
  const finite = v => Number.isFinite(Number(v));
  const clamp = v => Math.max(0, Math.min(100, Number(v) || 0));

  function active() {
    return qsa('.page-banner h2').some(x => x.textContent.trim() === 'Are we actually getting better?');
  }

  function panelByTitle(title) {
    return qsa('.panel').find(panel => qs('.panel-title h3', panel)?.textContent.trim() === title) || null;
  }

  function fmtPct(v, digits = 1) {
    return finite(v) ? `${Number(v).toFixed(digits)}%` : '—';
  }

  function fmtDuration(ms) {
    if (!finite(ms)) return '—';
    const total = Math.max(0, Math.round(Number(ms) / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  function fmtSeconds(ms, signed = false) {
    if (!finite(ms)) return '—';
    const n = Number(ms) / 1000;
    return `${signed && n > 0 ? '+' : ''}${n.toFixed(1)}s`;
  }

  function fmtCompact(v) {
    if (!finite(v)) return '—';
    const n = Number(v);
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return Math.round(n).toString();
  }

  function median(values) {
    const a = values.filter(finite).map(Number).sort((x, y) => x - y);
    if (!a.length) return null;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  function normalizePulls() {
    const core = window.__AVOID_WCL__;
    const telemetry = window.__AVOID_WCL_TELEMETRY__;
    const detailed = telemetry?.pullIntelligence?.pulls;
    const source = Array.isArray(detailed) && detailed.length ? detailed : (core?.progression || []);
    return source.map((p, i) => ({
      fightId: Number(p.fightId),
      pullNumber: finite(p.pullNumber) ? Number(p.pullNumber) : i + 1,
      fightPercentage: finite(p.fightPercentage) ? Number(p.fightPercentage) : null,
      bossPercentage: finite(p.bossPercentage) ? Number(p.bossPercentage) : null,
      durationMs: finite(p.durationMs) ? Number(p.durationMs) : null,
      stageCount: finite(p.stageCount ?? p.maxPhase) ? Number(p.stageCount ?? p.maxPhase) : 1,
      kill: Boolean(p.kill),
      firstDeathMs: finite(p.firstDeathMs ?? p.firstDeath?.fightRelativeMs) ? Number(p.firstDeathMs ?? p.firstDeath?.fightRelativeMs) : null,
      firstDeath: p.firstDeath || null,
      raidDps: finite(p.raidDps) ? Number(p.raidDps) : null,
      raidHps: finite(p.raidHps) ? Number(p.raidHps) : null,
      meaningfulDeaths: finite(p.meaningfulDeaths) ? Number(p.meaningfulDeaths) : null,
      rawDeaths: finite(p.rawDeaths) ? Number(p.rawDeaths) : null,
      rosterSize: finite(p.rosterSize) ? Number(p.rosterSize) : null,
      stages: p.stages || [],
    })).sort((a, b) => a.pullNumber - b.pullNumber);
  }

  function visiblePulls(pulls) {
    if (state.range === '10') return pulls.slice(-10);
    if (state.range === '20') return pulls.slice(-20);
    return pulls;
  }

  function personalBestPullNumbers(pulls) {
    const out = new Set();
    let best = Infinity;
    for (const p of pulls) {
      if (!finite(p.fightPercentage)) continue;
      if (p.kill || Number(p.fightPercentage) < best - 1e-9) {
        best = p.kill ? 0 : Number(p.fightPercentage);
        out.add(p.pullNumber);
      }
    }
    return out;
  }

  function rollingMedian(pulls, size = 5) {
    return pulls.map((_, i) => median(pulls.slice(Math.max(0, i - size + 1), i + 1).map(p => p.fightPercentage)));
  }

  function bestPull(pulls) {
    return pulls.filter(p => finite(p.fightPercentage)).slice().sort((a, b) => Number(a.fightPercentage) - Number(b.fightPercentage))[0] || null;
  }

  function previousPull(pulls, selected) {
    const idx = pulls.findIndex(p => p.pullNumber === selected?.pullNumber);
    return idx > 0 ? pulls[idx - 1] : null;
  }

  function currentNight(history) {
    return history?.currentNight || null;
  }

  function progressSignature(pulls) {
    const core = window.__AVOID_WCL__;
    const telemetry = window.__AVOID_WCL_TELEMETRY__;
    const history = window.__AVOID_WCL_HISTORY__;
    const last = pulls.at(-1);
    return [core?.report?.code, core?.generatedAt, telemetry?.generatedAt, history?.generatedAt, pulls.length, last?.pullNumber, last?.fightPercentage, state.range, state.selectedPull].join('|');
  }

  function needsRepair(pulls) {
    const visible = visiblePulls(pulls);
    const curve = qs('.pullcurve');
    const matrix = qs('.matrix');
    return !qs('.progress-commandbar') || !qs('.progress-pull-inspector') || !qs('.progress-rl-panel') ||
      !curve || qsa('circle.progress-point', curve).length !== visible.filter(p => finite(p.fightPercentage)).length ||
      !matrix || qsa('.progress-matrix-pull', matrix).length !== Math.min(8, pulls.length);
  }

  function statCards() {
    return qsa('.stats-row .stat');
  }

  function writeStat(card, label, value, delta, meta, tone = '') {
    if (!card) return;
    const l = qs(':scope > label', card); if (l) l.textContent = label;
    const b = qs('div > b', card); if (b) b.textContent = value;
    const em = qs('div > em', card); if (em) { em.textContent = delta; em.className = tone; }
    const small = qs(':scope > small', card); if (small) small.textContent = meta;
  }

  function renderBannerAndStats(pulls) {
    const core = window.__AVOID_WCL__;
    const history = window.__AVOID_WCL_HISTORY__;
    const banner = qs('.page-banner');
    if (banner) {
      const badge = qs('.badge', banner); if (badge) badge.textContent = 'LIVE PROGRESS';
      const copy = qs('p', banner); if (copy) copy.textContent = 'Every analytical pull is live from Warcraft Logs. Click any pull to inspect what changed before the next attempt.';
      const bs = qs('.banner-stat', banner);
      if (bs) {
        const label = qs('label', bs), value = qs('b', bs), small = qs('small', bs);
        const last5 = pulls.slice(-5), prev5 = pulls.slice(-10, -5);
        const a = median(last5.map(p => p.fightPercentage)), b = median(prev5.map(p => p.fightPercentage));
        if (label) label.textContent = 'RECENT MOMENTUM';
        if (finite(a) && finite(b)) {
          const gain = Number(b) - Number(a);
          if (value) { value.textContent = `${gain >= 0 ? '+' : ''}${gain.toFixed(1)}pp`; value.className = gain > .5 ? 'good-text' : gain < -.5 ? 'bad-text' : ''; }
          if (small) small.textContent = 'last 5 vs previous 5 · lower boss HP is deeper';
        } else {
          const best = bestPull(pulls);
          if (value) { value.textContent = fmtPct(best?.fightPercentage); value.className = ''; }
          if (small) small.textContent = 'best observed progress · more pulls needed for momentum';
        }
      }
    }

    const cards = statCards();
    const night = currentNight(history);
    const bests = personalBestPullNumbers(pulls);
    const early = core?.overview?.earlyDeaths;
    writeStat(cards[0], 'PULLS THIS NIGHT', String(night?.pulls ?? pulls.length), 'WCL', night ? `${night.sourceReports || 1} report${Number(night.sourceReports) === 1 ? '' : 's'} in current raid session` : 'Current connected report', 'good');
    writeStat(cards[1], 'MEDIAN BOSS HP', fmtPct(median(pulls.map(p => p.fightPercentage))), 'REPORT', 'Median remaining boss HP across analytical pulls');
    writeStat(cards[2], 'PULLS WITHOUT EARLY DEATH', finite(early) ? String(Math.max(0, pulls.length - Number(early))) : '—', finite(early) ? 'WCL' : 'PENDING', core?.overview?.earlyDeathDefinition || 'Death timing unavailable');
    writeStat(cards[3], 'STAGE 3 SURVIVAL', fmtSeconds(core?.overview?.p3SurvivalMedianMs), finite(core?.overview?.p3SurvivalMedianMs) ? 'MEDIAN' : 'N/A', 'Time survived after absolute stage 3 transition');
    writeStat(cards[4], 'NEW PERSONAL BESTS', String(bests.size), 'REPORT', 'Pulls that set a new deepest fightPercentage', 'good');
  }

  function chartPoint(p, i, length) {
    const x = length === 1 ? 50 : 3 + i / (length - 1) * 94;
    const y = 6 + clamp(p.fightPercentage) / 100 * 74;
    return { x, y };
  }

  function renderChart(pulls) {
    const panel = panelByTitle('All-pull progression');
    if (!panel) return;
    const title = qs('.panel-title', panel);
    if (title) {
      const sub = qs('p', title); if (sub) sub.textContent = 'Chronological WCL progress · rolling 5-pull median · click a pull';
      let bar = qs('.progress-commandbar', panel);
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'progress-commandbar';
        title.insertAdjacentElement('afterend', bar);
      }
      bar.innerHTML = `<span>VIEW</span>${[['all','ALL'],['20','LAST 20'],['10','LAST 10']].map(([k,l]) => `<button type="button" data-progress-range="${k}" class="${state.range === k ? 'active' : ''}">${l}</button>`).join('')}<em>${pulls.length} analytical pulls</em>`;
      qsa('[data-progress-range]', bar).forEach(btn => btn.addEventListener('click', () => {
        state.range = btn.dataset.progressRange;
        const v = visiblePulls(pulls);
        if (!v.some(p => p.pullNumber === state.selectedPull)) state.selectedPull = v.at(-1)?.pullNumber ?? null;
        render(true); setTimeout(() => render(true), 140);
      }));
    }

    const visible = visiblePulls(pulls);
    const curve = qs('.pullcurve', panel);
    if (!curve) return;
    const valid = visible.filter(p => finite(p.fightPercentage));
    const medians = rollingMedian(valid, 5);
    const pb = personalBestPullNumbers(pulls);
    const points = valid.map((p, i) => chartPoint(p, i, valid.length));
    const line = points.map(x => `${x.x},${x.y}`).join(' ');
    const mline = medians.map((v, i) => ({ ...chartPoint({ fightPercentage: v }, i, medians.length), v })).filter(x => finite(x.v)).map(x => `${x.x},${x.y}`).join(' ');
    const selected = valid.find(p => p.pullNumber === state.selectedPull);
    const selectedIndex = selected ? valid.findIndex(p => p.pullNumber === selected.pullNumber) : -1;
    const sx = selectedIndex >= 0 ? chartPoint(selected, selectedIndex, valid.length).x : null;
    curve.dataset.progressRuntime = RELEASE;
    curve.innerHTML = `<div class="axis"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div><svg viewBox="0 0 100 86" preserveAspectRatio="none" role="img" aria-label="Boss progress by pull">${[6,24.5,43,61.5,80].map(y => `<line x1="3" y1="${y}" x2="97" y2="${y}"></line>`).join('')}<polygon points="3,80 ${line} 97,80"></polygon>${sx == null ? '' : `<line class="progress-selected-line" x1="${sx}" y1="5" x2="${sx}" y2="80"></line>`}<polyline class="progress-main-line" points="${line}"></polyline><polyline class="progress-median-line" points="${mline}"></polyline>${valid.map((p, i) => { const pt = points[i]; const classes = ['progress-point', pb.has(p.pullNumber) ? 'pb' : '', p.pullNumber === state.selectedPull ? 'selected' : ''].filter(Boolean).join(' '); return `<circle class="${classes}" data-progress-pull="${p.pullNumber}" cx="${pt.x}" cy="${pt.y}" r="${p.pullNumber === state.selectedPull ? 1.8 : pb.has(p.pullNumber) ? 1.25 : .72}"><title>Pull ${p.pullNumber} · ${fmtPct(p.fightPercentage)} · Stage ${p.stageCount} · ${fmtDuration(p.durationMs)}</title></circle>`; }).join('')}</svg><div class="pull-labels"><span>PULL ${valid[0]?.pullNumber ?? '—'}</span><span>PULL ${valid[Math.floor((valid.length - 1) / 2)]?.pullNumber ?? '—'}</span><span>PULL ${valid.at(-1)?.pullNumber ?? '—'}</span></div>`;
    qsa('[data-progress-pull]', curve).forEach(el => el.addEventListener('click', () => selectPull(Number(el.dataset.progressPull), pulls)));

    let legend = qs('.legend-row', panel);
    if (legend) {
      legend.innerHTML = '<span><i class="good"></i>Boss HP remaining</span><span data-progress-legend="median"><i class="info"></i>5-pull median</span><span><i class="warn"></i>Personal best</span>';
    }
    renderInspector(panel, pulls);
  }

  function metric(label, value, sub = '') {
    return `<div class="progress-inspector-metric"><label>${label}</label><b>${value}</b><small>${sub}</small></div>`;
  }

  function renderInspector(panel, pulls) {
    let host = qs('.progress-pull-inspector', panel);
    if (!host) {
      host = document.createElement('div');
      host.className = 'progress-pull-inspector';
      qs('.legend-row', panel)?.insertAdjacentElement('afterend', host);
    }
    const visible = visiblePulls(pulls);
    const selected = pulls.find(p => p.pullNumber === state.selectedPull) || visible.at(-1) || pulls.at(-1);
    if (!selected) return;
    state.selectedPull = selected.pullNumber;
    const idx = pulls.findIndex(p => p.pullNumber === selected.pullNumber);
    const prev = idx > 0 ? pulls[idx - 1] : null;
    const progressDelta = prev && finite(selected.fightPercentage) && finite(prev.fightPercentage) ? Number(prev.fightPercentage) - Number(selected.fightPercentage) : null;
    const deathDelta = prev && finite(selected.firstDeathMs) && finite(prev.firstDeathMs) ? Number(selected.firstDeathMs) - Number(prev.firstDeathMs) : null;
    const firstDeathName = selected.firstDeath?.player || selected.firstDeath?.name || 'No recorded death';
    host.innerHTML = `<div class="progress-inspector-head"><div><span>SELECTED PULL</span><b>#${selected.pullNumber} · ${selected.kill ? 'KILL' : fmtPct(selected.fightPercentage)}</b><small>${prev ? `vs Pull ${prev.pullNumber}${finite(progressDelta) ? ` · ${progressDelta >= 0 ? '+' : ''}${progressDelta.toFixed(1)}pp deeper` : ''}` : 'first analytical pull'}</small></div><div class="progress-inspector-nav"><button type="button" data-progress-prev ${idx <= 0 ? 'disabled' : ''}>← PREV</button><button type="button" data-progress-next ${idx >= pulls.length - 1 ? 'disabled' : ''}>NEXT →</button></div></div><div class="progress-inspector-grid">${metric('BOSS HP', selected.kill ? '0.0%' : fmtPct(selected.fightPercentage), selected.kill ? 'kill' : 'WCL fightPercentage')}${metric('DURATION', fmtDuration(selected.durationMs), `Stage ${selected.stageCount}`)}${metric('FIRST DEATH', finite(selected.firstDeathMs) ? fmtDuration(selected.firstDeathMs) : 'NONE', finite(selected.firstDeathMs) ? firstDeathName : 'no friendly death event')}${metric('RAID DPS', fmtCompact(selected.raidDps), finite(selected.raidDps) ? 'per-pull WCL Summary' : 'summary unavailable')}${metric('RAID HPS', fmtCompact(selected.raidHps), finite(selected.raidHps) ? 'observed · not scored as better/worse' : 'summary unavailable')}${metric('MEANINGFUL DEATHS', finite(selected.meaningfulDeaths) ? String(selected.meaningfulDeaths) : '—', finite(deathDelta) ? `first death ${fmtSeconds(deathDelta, true)} vs previous` : 'wipe-cutoff filtered')}</div>`;
    qs('[data-progress-prev]', host)?.addEventListener('click', () => idx > 0 && selectPull(pulls[idx - 1].pullNumber, pulls));
    qs('[data-progress-next]', host)?.addEventListener('click', () => idx < pulls.length - 1 && selectPull(pulls[idx + 1].pullNumber, pulls));
  }

  function renderNightOverNight() {
    const history = window.__AVOID_WCL_HISTORY__;
    const panel = panelByTitle('Night-over-night');
    if (!panel) return;
    const rows = qsa('.night-table > div', panel);
    const nights = (history?.recentNights || []).slice(-3);
    const currentId = history?.currentNight?.sessionId;
    rows.forEach((row, i) => {
      const n = nights[i];
      if (!n) {
        row.classList.remove('active');
        row.innerHTML = '<span>NO RAID SESSION<small>History endpoint has no additional night</small></span><b>—</b><em>—</em>';
        return;
      }
      const date = new Date(n.startTime);
      const day = date.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();
      row.classList.toggle('active', n.sessionId === currentId);
      row.innerHTML = `<span>${day} · ${n.pulls} PULLS<small>Best ${fmtPct(n.bestFightPercentage)} · ${n.sourceReports || 1} report${Number(n.sourceReports) === 1 ? '' : 's'}</small></span><b>${n.kills ? 'KILLED' : n.sessionId === currentId ? 'Current night' : 'Progression'}</b><em>${fmtPct(n.medianFightPercentage)} median</em>`;
    });
    const insight = qs('.insight-box p', panel);
    const delta = history?.delta;
    if (insight) {
      if (delta && finite(delta.medianPctPoints)) {
        const d = Number(delta.medianPctPoints);
        insight.textContent = d > 1 ? `Median progress improved ${d.toFixed(1)} percentage points versus the previous raid night. Preserve the plan and focus on repeating the deeper stage.` : d < -1 ? `Median progress regressed ${Math.abs(d).toFixed(1)} points versus the previous raid night. Review what changed before altering composition.` : 'Median progress is broadly stable versus the previous raid night. The next gain is likely repeatability, not a wholesale strategy reset.';
      } else insight.textContent = 'Current-report progression is live. A second raid session is required before Iris asserts a night-over-night trend.';
    }
  }

  function renderMatrix(pulls) {
    const panel = panelByTitle('Phase progression matrix');
    const matrix = qs('.matrix', panel);
    if (!panel || !matrix) return;
    const maxObserved = Math.max(1, ...pulls.map(p => Number(p.stageCount) || 1));
    const maxStage = Math.min(8, maxObserved);
    const recent = pulls.slice(-8);
    matrix.style.gridTemplateColumns = `74px repeat(${maxStage}, minmax(42px,1fr))`;
    matrix.innerHTML = `<label></label>${Array.from({ length: maxStage }, (_, i) => `<label>S${i + 1}</label>`).join('')}${recent.map(p => {
      const cells = Array.from({ length: maxStage }, (_, i) => {
        const stage = i + 1;
        const reached = Number(p.stageCount) >= stage;
        const completed = Number(p.stageCount) > stage || p.kill;
        const cls = completed ? 'passed' : reached ? 'terminal' : 'unreached';
        return `<button type="button" class="progress-stage ${cls}" data-progress-pull="${p.pullNumber}" title="Pull ${p.pullNumber} · Stage ${stage} ${completed ? 'completed' : reached ? 'terminal stage' : 'not reached'}"></button>`;
      }).join('');
      return `<button type="button" class="progress-matrix-pull ${p.pullNumber === state.selectedPull ? 'selected' : ''}" data-progress-pull="${p.pullNumber}">PULL ${p.pullNumber}</button>${cells}`;
    }).join('')}`;
    qsa('[data-progress-pull]', matrix).forEach(el => el.addEventListener('click', () => selectPull(Number(el.dataset.progressPull), pulls)));
    const sub = qs('.panel-title p', panel); if (sub) sub.textContent = `Last ${recent.length} analytical pulls · green = stage completed · gold = terminal stage · click any row`;
  }

  function bestImprovement(selected, prev) {
    if (!prev) return ['BASELINE', 'First analytical pull', 'No previous pull exists for a delta.'];
    const options = [];
    if (finite(selected.fightPercentage) && finite(prev.fightPercentage)) {
      const d = Number(prev.fightPercentage) - Number(selected.fightPercentage);
      if (d > .05) options.push([Math.abs(d), `+${d.toFixed(1)}pp deeper`, `Boss HP improved versus Pull ${prev.pullNumber}.`]);
    }
    const sd = Number(selected.stageCount) - Number(prev.stageCount);
    if (sd > 0) options.push([sd * 20, `+${sd} stage${sd > 1 ? 's' : ''}`, `Reached Stage ${selected.stageCount} after Pull ${prev.pullNumber} ended in Stage ${prev.stageCount}.`]);
    if (finite(selected.firstDeathMs) && finite(prev.firstDeathMs)) {
      const d = Number(selected.firstDeathMs) - Number(prev.firstDeathMs);
      if (d > 1000) options.push([d / 1000, `${fmtSeconds(d, true)} first death`, 'First friendly death occurred later.']);
    }
    if (Number(selected.stageCount) === Number(prev.stageCount) && finite(selected.raidDps) && finite(prev.raidDps)) {
      const d = Number(selected.raidDps) - Number(prev.raidDps);
      if (d > 0) options.push([d / 100000, `+${fmtCompact(d)} DPS`, 'Same-stage raid throughput increased.']);
    }
    options.sort((a, b) => b[0] - a[0]);
    return options[0] ? [options[0][1], options[0][2], 'Observed pull-to-pull gain'] : ['STABLE', 'No confirmed gain', 'Tracked progression facts did not materially improve.'];
  }

  function strongestRegression(selected, prev) {
    if (!prev) return ['WATCH', 'Build a baseline', 'Use the next pull to establish a comparable delta.'];
    const options = [];
    if (finite(selected.fightPercentage) && finite(prev.fightPercentage)) {
      const d = Number(selected.fightPercentage) - Number(prev.fightPercentage);
      if (d > .05) options.push([d, `${d.toFixed(1)}pp shallower`, `Boss HP was higher than Pull ${prev.pullNumber}.`]);
    }
    const sd = Number(prev.stageCount) - Number(selected.stageCount);
    if (sd > 0) options.push([sd * 20, `Lost ${sd} stage${sd > 1 ? 's' : ''}`, `Pull ended in Stage ${selected.stageCount} versus Stage ${prev.stageCount}.`]);
    if (finite(selected.firstDeathMs) && finite(prev.firstDeathMs)) {
      const d = Number(prev.firstDeathMs) - Number(selected.firstDeathMs);
      if (d > 1000) options.push([d / 1000, `${fmtSeconds(-d)} earlier first death`, 'First friendly death moved earlier; cause is not inferred here.']);
    }
    if (finite(selected.meaningfulDeaths) && finite(prev.meaningfulDeaths)) {
      const d = Number(selected.meaningfulDeaths) - Number(prev.meaningfulDeaths);
      if (d > 0) options.push([d * 5, `+${d} meaningful death${d > 1 ? 's' : ''}`, 'More deaths occurred before the wipe-cutoff window.']);
    }
    options.sort((a, b) => b[0] - a[0]);
    return options[0] ? [options[0][1], options[0][2], 'Observed regression · no causal blame'] : ['CLEAR', 'No confirmed regression', 'Preserve the current plan; change one variable at a time.'];
  }

  function renderRlBrief(pulls) {
    const matrixPanel = panelByTitle('Phase progression matrix');
    if (!matrixPanel) return;
    let panel = qs('.progress-rl-panel');
    if (!panel) {
      panel = document.createElement('article');
      panel.className = 'panel progress-rl-panel';
      matrixPanel.insertAdjacentElement('afterend', panel);
    }
    const selected = pulls.find(p => p.pullNumber === state.selectedPull) || pulls.at(-1);
    if (!selected) return;
    const prev = previousPull(pulls, selected);
    const best = bestPull(pulls);
    const [gainBadge, gainTitle, gainCopy] = bestImprovement(selected, prev);
    const [regBadge, regTitle, regCopy] = strongestRegression(selected, prev);
    const isBest = best?.pullNumber === selected.pullNumber;
    const targetTitle = selected.kill ? 'Kill secured' : isBest ? 'Repeat the new depth' : `Return to ${fmtPct(best?.fightPercentage)}`;
    const targetCopy = selected.kill ? 'Use the next pulls for repeatability and clean execution rather than progression depth.' : isBest ? `Pull ${selected.pullNumber} is the deepest observed attempt. Avoid changing several things at once; reproduce Stage ${selected.stageCount} first.` : `Current personal best is Pull ${best?.pullNumber ?? '—'} at ${fmtPct(best?.fightPercentage)}. The next objective is to reproduce that depth before escalating changes.`;
    panel.innerHTML = `<div class="panel-title"><div><i>04</i><span><h3>Between-pull RL brief</h3><p>Selected pull vs previous analytical pull · observed facts only · no unsupported causality</p></span></div><span class="badge good">IRIS · LIVE</span></div><div class="progress-rl-grid"><div class="progress-rl-card good"><label>KEEP</label><b>${gainTitle}</b><p>${gainCopy}</p><small>${gainBadge}</small></div><div class="progress-rl-card bad"><label>FIX / WATCH</label><b>${regTitle}</b><p>${regCopy}</p><small>${regBadge}</small></div><div class="progress-rl-card target"><label>NEXT PULL</label><b>${targetTitle}</b><p>${targetCopy}</p><small>Pull ${selected.pullNumber} selected · click chart/matrix to change</small></div></div>`;
  }

  function selectPull(number, pulls = normalizePulls()) {
    if (!pulls.some(p => p.pullNumber === number)) return;
    state.selectedPull = number;
    render(true);
    setTimeout(() => render(true), 140);
  }

  function render(force = false) {
    if (!active()) return;
    const core = window.__AVOID_WCL__;
    if (!core?.ok) return;
    const pulls = normalizePulls();
    if (!pulls.length) return;
    if (state.selectedPull == null || !pulls.some(p => p.pullNumber === state.selectedPull)) state.selectedPull = pulls.at(-1).pullNumber;
    const signature = progressSignature(pulls);
    if (!force && signature === state.signature && !needsRepair(pulls)) return;
    state.signature = signature;
    document.documentElement.dataset.progressRuntime = RELEASE;
    renderBannerAndStats(pulls);
    renderChart(pulls);
    renderNightOverNight();
    renderMatrix(pulls);
    renderRlBrief(pulls);
    const footer = qs('footer span'); if (footer) footer.textContent = 'Progress control room · Live Warcraft Logs data · Iris v3.7.8';
  }

  window.__AVOID_PROGRESS__ = Object.freeze({ release: RELEASE, source: 'existing WCL report + telemetry + history globals', extraWclRequests: 0 });
  document.addEventListener('DOMContentLoaded', () => setTimeout(() => render(true), 60), { once: true });
  document.addEventListener('click', e => {
    if (e.target?.closest?.('nav button')) setTimeout(() => render(true), 180);
  }, true);
  window.addEventListener('popstate', () => setTimeout(() => render(true), 100));
  setInterval(() => render(false), 1200);
})();
