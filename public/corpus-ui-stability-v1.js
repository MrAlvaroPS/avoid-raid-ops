(() => {
  const VERSION = '1.0.0';
  const nativeCorpusRenderer = window.applyCorpusWorkbench;

  if (typeof nativeCorpusRenderer !== 'function') {
    console.warn('[AvoiD Raid Ops] Corpus UI stability guard could not find the legacy renderer.');
    return;
  }

  // encounter-intelligence-v375 owns the visible corpus card. The legacy WCL
  // runtime still polls corpus status for compatibility, but must not tear down
  // the v3.7.5 DOM tree on every poll. Doing so resets disclosure state and
  // produces a visible collapse/reopen flicker.
  window.applyCorpusWorkbench = function stableCorpusWorkbench(...args) {
    const panel = document.querySelector('.corpus-workbench');
    if (panel?.querySelector('.encounter-intelligence-v375')) {
      panel.style.display = '';
      return;
    }
    return nativeCorpusRenderer.apply(this, args);
  };

  window.__AVOID_CORPUS_UI_STABILITY__ = Object.freeze({
    version: VERSION,
    owner: 'encounter-intelligence-v375',
    legacyPollingRendererSuppressed: true,
  });

  console.info(`[AvoiD Raid Ops] Corpus UI stability ${VERSION}`);
})();
