(() => {
  const VERSION = '3.7.1';
  let cachedModel = null;
  let cachedEncounter = null;
  let fetchAt = 0;
  let inFlight = false;

  const n = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const fmt = new Intl.NumberFormat();
  const pct = v => Number.isFinite(Number(v)) ? `${Math.round(Number(v))}%` : '—';
  const titleCase = value => String(value || '').replaceAll('-', ' ').replace(/\b\w/g, m => m.toUpperCase());

  function encounterId() {
    const q = Number(new URLSearchParams(location.search).get('encounter'));
    if (Number.isFinite(q) && q > 0) return q;
    const intel = Number(window.__AVOID_WCL_INTELLIGENCE__?.encounter?.id);
    if (Number.isFinite(intel) && intel > 0) return intel;
    const core = Number(window.__AVOID_WCL__?.encounter?.id);
    return Number.isFinite(core) && core > 0 ? core : null;
  }

  function mechanicsPage() {
    return Array.from(document.querySelectorAll('.page-banner h2')).some(x => x.textContent.trim() === 'Mechanics Library');
  }

  async function fetchModel(force = false) {
    const id = encounterId();
    if (!id || inFlight) return cachedModel;
    const now = Date.now();
    if (!force && cachedEncounter === id && cachedModel && now - fetchAt < 12000) return cachedModel;
    inFlight = true;
    try {
      const url = new URL('/api/wcl/corpus', location.origin);
      url.searchParams.set('encounter', String(id));
      url.searchParams.set('action', 'model');
      url.searchParams.set('_', String(now));
      const response = await fetch(url, { headers:{ Accept:'application/json' } });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.ok && data?.model) {
        cachedModel = data.model;
        cachedEncounter = id;
        fetchAt = now;
      }
    } catch (error) {
      console.warn('[AvoiD v3.7.1 encounter intelligence]', error);
    } finally {
      inFlight = false;
    }
    return cachedModel;
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function maturityCopy(grade, score) {
    if (grade === 'VERIFIED') return 'The encounter model is deeply validated and ready for final review.';
    if (grade === 'MATURE') return 'The encounter is broadly understood; remaining work is targeted rather than exploratory.';
    if (grade === 'STRONG') return 'The fight structure is strong, but one or more evidence layers still limit publication.';
    if (grade === 'PARTIAL') return 'Important mechanics are understood, but relationship coverage still has material blind spots.';
    if (grade === 'LEARNING') return 'The model is finding repeatable patterns, but it is not ready to guide encounter scoring.';
    return score > 0 ? 'The corpus is still mapping the encounter signal space.' : 'Build or recompile the corpus to begin encounter learning.';
  }

  function dimensionCard(label, value, detail, tone = '') {
    const card = element('div', `ei-dimension${tone ? ` ${tone}` : ''}`);
    const top = element('div', 'ei-dimension-top');
    top.append(element('span', '', label), element('b', '', pct(value)));
    const track = element('i', 'ei-meter');
    const fill = element('em');
    fill.style.width = `${Math.max(0, Math.min(100, n(value)))}%`;
    track.append(fill);
    card.append(top, track, element('small', '', detail));
    return card;
  }

  function learnedList(model) {
    const rows = model?.learning?.learnedHighlights || [];
    const box = element('div', 'ei-knowledge-card learned');
    const head = element('div', 'ei-knowledge-head');
    head.append(element('span', 'ei-kicker', 'WHAT AVOID HAS LEARNED'), element('b', '', `${rows.length} validated areas`));
    box.append(head);
    const list = element('div', 'ei-knowledge-list');
    if (!rows.length) list.append(element('p', 'ei-empty', 'No encounter relationships have passed the current learning policy yet.'));
    for (const row of rows) {
      const item = element('div', 'ei-knowledge-item');
      item.append(element('i', 'ei-mark', '✓'));
      const copy = element('span');
      copy.append(element('b', '', row.title), element('small', '', row.detail || 'Validated encounter evidence'));
      item.append(copy);
      list.append(item);
    }
    box.append(list);
    return box;
  }

  function needsList(model) {
    const rows = model?.learning?.needsEvidence || [];
    const box = element('div', 'ei-knowledge-card pending');
    const head = element('div', 'ei-knowledge-head');
    head.append(element('span', 'ei-kicker', 'NEEDS MORE EVIDENCE'), element('b', '', rows.length ? `${rows.length} open areas` : 'No critical gaps'));
    box.append(head);
    const list = element('div', 'ei-knowledge-list');
    if (!rows.length) list.append(element('p', 'ei-empty', 'No major evidence gap is currently exposed by the model.'));
    for (const row of rows) {
      const item = element('div', 'ei-knowledge-item');
      item.append(element('i', 'ei-mark', row.kind === 'filter' ? '×' : '?'));
      const copy = element('span');
      const top = element('div', 'ei-item-title');
      top.append(element('b', '', row.title));
      if (Number.isFinite(Number(row.confidencePct))) top.append(element('em', '', `${Math.round(Number(row.confidencePct))}%`));
      copy.append(top, element('small', '', row.detail || 'More corpus evidence is required.'));
      item.append(copy);
      list.append(item);
    }
    box.append(list);
    return box;
  }

  function deficitChip(label, value) {
    if (!(n(value) > 0)) return null;
    const chip = element('span', 'ei-deficit');
    chip.append(element('b', '', `+${fmt.format(n(value))}`), document.createTextNode(` ${label}`));
    return chip;
  }

  function nextAction(model, panel) {
    const rec = model?.learning?.enrichmentRecommendation;
    const wrap = element('div', 'ei-next-action');
    const left = element('div', 'ei-action-copy');
    left.append(element('span', 'ei-kicker', 'BEST NEXT ACTION'));
    const mode = titleCase(rec?.mode || 'review');
    left.append(element('h4', '', mode));
    left.append(element('p', '', rec?.reason || 'Review the current model before spending additional WCL budget.'));
    const chips = element('div', 'ei-deficits');
    const values = [
      deficitChip('wide pulls', rec?.suggestedAdditionalWidePulls),
      deficitChip('deep pulls', rec?.suggestedAdditionalDeepPulls),
      deficitChip('reports', rec?.suggestedAdditionalWideReports),
      deficitChip('deep reports', rec?.suggestedAdditionalDeepReports),
      deficitChip('holdout reports', rec?.suggestedAdditionalValidationReports),
      deficitChip('sources', rec?.suggestedAdditionalIndependentSources),
    ].filter(Boolean);
    if (values.length) chips.append(...values);
    else chips.append(element('span', 'ei-deficit clear', 'No additional evidence target'));
    left.append(chips);

    const right = element('div', 'ei-action-cta');
    const button = element('button', '', rec?.mode === 'review-or-publish' ? 'REVIEW MODEL' : 'IMPROVE MODEL');
    button.type = 'button';
    button.addEventListener('click', () => {
      const actions = panel.querySelector('.corpus-actions');
      const target = Array.from(actions?.querySelectorAll('button') || []).find(b => /^ENRICH\b|^IMPROVE MODEL\b/.test(b.textContent.trim()));
      if (target) target.click();
      else panel.scrollIntoView({ behavior:'smooth', block:'center' });
    });
    right.append(button, element('small', '', rec?.mode === 'review-or-publish' ? 'No blind enrichment recommended' : 'Uses the current evidence plan'));
    wrap.append(left, right);
    return wrap;
  }

  function renameAction(panel) {
    const enrich = Array.from(panel.querySelectorAll('.corpus-actions button')).find(b => /^ENRICH\b/.test(b.textContent.trim()));
    if (enrich) {
      enrich.textContent = 'IMPROVE MODEL';
      enrich.title = 'Enrich using the model bottleneck plan instead of a blind pull target.';
    }
  }

  function render(model) {
    if (!mechanicsPage()) return;
    const panel = document.querySelector('.corpus-workbench');
    if (!panel || !model) return;
    const old = panel.querySelector('.encounter-intelligence-v371');
    const signature = `${model.generatedAt || 0}:${model.learning?.scorePct || 0}:${model.validation?.acceptedMechanics || 0}`;
    if (old?.dataset.signature === signature) { renameAction(panel); return; }
    old?.remove();
    const legacy = panel.querySelector('.corpus-learning');
    if (legacy) legacy.style.display = 'none';

    const score = n(model?.learning?.scorePct), grade = model?.learning?.grade || 'DISCOVERY', components = model?.learning?.components || {};
    const root = element('section', 'encounter-intelligence-v371');
    root.dataset.signature = signature;
    const hero = element('div', 'ei-hero'), intro = element('div', 'ei-hero-copy'), scoreBox = element('div', 'ei-score');
    intro.append(element('span', 'ei-kicker', 'ENCOUNTER INTELLIGENCE'), element('h3', '', model?.pack?.name || `Encounter ${model.encounterId || ''}`), element('p', '', maturityCopy(grade, score)));
    scoreBox.append(element('small', '', 'MODEL MATURITY'), element('b', '', `${Math.round(score)}%`), element('em', '', grade));
    hero.append(intro, scoreBox); root.append(hero);

    const maturity = element('div', 'ei-maturity-scale');
    for (const [name,min,max] of [['DISCOVERY',0,24],['LEARNING',25,49],['PARTIAL',50,69],['STRONG',70,84],['MATURE',85,94],['VERIFIED',95,100]]) {
      const item = element('span', score >= min && score <= max ? 'active' : '');
      item.append(element('b', '', name), element('small', '', `${min}–${max}`)); maturity.append(item);
    }
    root.append(maturity);

    const grid = element('div', 'ei-dimensions');
    grid.append(
      dimensionCard('SIGNAL DISCOVERY', components.signalDiscoveryPct ?? components.signalCoveragePct, 'Has the model found and classified the important encounter signal space?'),
      dimensionCard('RELATION UNDERSTANDING', components.relationUnderstandingPct, 'Does it understand state, completion and temporal relationships between those signals?', n(components.relationUnderstandingPct) < 60 ? 'warn' : ''),
      dimensionCard('VALIDATION CONFIDENCE', components.validationConfidencePct ?? components.holdoutPct, 'Does the model reproduce on raid groups isolated from training?'),
      dimensionCard('DATA DEPTH', components.dataDepthPct, 'Are pull, report and Deep-event sample sizes sufficient?'),
      dimensionCard('SOURCE DIVERSITY', components.sourceDiversityPct ?? components.diversityPct, 'Does the corpus represent enough independent raid groups?')
    );
    root.append(grid);
    const knowledge = element('div', 'ei-knowledge-grid'); knowledge.append(learnedList(model), needsList(model)); root.append(knowledge, nextAction(model, panel));
    const anchor = panel.querySelector('.corpus-grid'); if (anchor) anchor.insertAdjacentElement('afterend', root); else panel.append(root);
    renameAction(panel);
  }

  async function tick() { if (!mechanicsPage()) return; const model = await fetchModel(false); if (model) render(model); }
  document.addEventListener('click', event => {
    if (event.target?.closest?.('nav button')) setTimeout(() => tick(), 120);
    if (event.target?.closest?.('.corpus-workbench button')) setTimeout(() => fetchModel(true).then(render), 900);
  }, true);
  setInterval(tick, 1800);
  window.addEventListener('DOMContentLoaded', tick);
  if (document.readyState !== 'loading') tick();
  console.info(`[AvoiD Raid Ops] Encounter Intelligence UI ${VERSION}`);
})();
