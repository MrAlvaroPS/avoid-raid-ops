(() => {
  const VERSION = '1.1.0';
  const PAGE_OWNER = 'Mechanics';
  const nativeCorpusRenderer = window.applyCorpusWorkbench;

  if (typeof nativeCorpusRenderer !== 'function') {
    console.warn('[AvoiD Raid Ops] Corpus UI stability guard could not find the legacy renderer.');
    return;
  }

  const mechanicsPage = () => Array.from(document.querySelectorAll('.page-banner h2'))
    .some(node => node.textContent.trim() === 'Mechanics Library');

  function panel() {
    return document.querySelector('.corpus-workbench');
  }

  function hideForeignPageCorpus() {
    const current = panel();
    if (!current) return;
    current.dataset.avoidPageOwner = PAGE_OWNER;
    if (!mechanicsPage()) current.style.display = 'none';
  }

  // encounter-intelligence-v375 owns the enhanced contents of the corpus card,
  // but Mechanics owns the card itself. React swaps pages client-side, so a
  // runtime-created sibling may remain connected after Mechanics unmounts. The
  // old guard used to force that connected card visible on every page. This
  // wrapper keeps the enhanced DOM stable only while Mechanics is actually the
  // active page and otherwise delegates to the legacy renderer, which hides it.
  window.applyCorpusWorkbench = function stableCorpusWorkbench(...args) {
    const current = panel();
    const onMechanics = mechanicsPage();

    if (current) current.dataset.avoidPageOwner = PAGE_OWNER;

    if (!onMechanics) {
      if (current) current.style.display = 'none';
      return nativeCorpusRenderer.apply(this, args);
    }

    if (current?.querySelector('.encounter-intelligence-v375')) {
      current.style.display = '';
      return;
    }

    const result = nativeCorpusRenderer.apply(this, args);
    const rendered = panel();
    if (rendered) rendered.dataset.avoidPageOwner = PAGE_OWNER;
    return result;
  };

  document.addEventListener('click', event => {
    if (!event.target?.closest?.('nav button')) return;
    requestAnimationFrame(() => requestAnimationFrame(hideForeignPageCorpus));
  }, true);
  window.addEventListener('popstate', () => requestAnimationFrame(hideForeignPageCorpus));

  window.__AVOID_CORPUS_UI_STABILITY__ = Object.freeze({
    version: VERSION,
    owner: 'encounter-intelligence-v375',
    pageOwner: PAGE_OWNER,
    legacyPollingRendererSuppressed: true,
    crossPageVisibilityGuard: true,
  });

  hideForeignPageCorpus();
  console.info(`[AvoiD Raid Ops] Corpus UI stability ${VERSION}`);
})();
