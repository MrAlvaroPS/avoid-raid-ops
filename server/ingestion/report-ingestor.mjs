export class ReportIngestor {
  constructor({ wclClient, pullIngestor, repository }) { Object.assign(this,{wclClient,pullIngestor,repository}); }
  async ingestReport(_reportCode) { throw new Error("Wire normalized report ingestion in the next engine iteration."); }
}
