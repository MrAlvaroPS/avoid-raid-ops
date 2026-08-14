export class PullIngestor {
  constructor({ analyzer, repository }) { this.analyzer=analyzer; this.repository=repository; }
  async ingest(rawPull) { const analyzed=await this.analyzer.analyze(rawPull); await this.repository.savePull(analyzed); return analyzed; }
}
