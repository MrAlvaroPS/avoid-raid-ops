export const WCL_RAID_CATALOG_QUERY=`
query IrisRaidCatalog {
  worldData {
    zones {
      id
      name
      frozen
      expansion { id name }
      difficulties { id name sizes }
      partitions { id name compactName default }
      encounters { id name journalID }
    }
  }
}
`;
