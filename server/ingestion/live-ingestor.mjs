export class LiveIngestor {
  constructor({ reportIngestor }) { this.reportIngestor=reportIngestor; }
  // Polling trigger only. Pull analysis must reuse the same PullIngestor as historical imports.
}
