// Adapter boundary intentionally isolated. Wire @netlify/blobs here when persistence is enabled.
import { RaidOpsRepository } from "../../../../../server/storage/repository.mjs";
export class NetlifyBlobsRepository extends RaidOpsRepository {
  constructor(store){super();this.store=store;}
  async getPull(key){return this.store.get(`pulls/${key}`,{type:"json"});}
  async savePull(pull){return this.store.setJSON(`pulls/${pull.reportCode}/${pull.fightId}`,pull);}
}
