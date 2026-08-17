export const REPORT_CATALOG_ANCHOR_QUERY=`
query AvoidReportCatalogAnchor($code:String!){reportData{report(code:$code,allowUnlisted:true){code title startTime endTime zone{id name}}}}`;

export const REPORT_CATALOG_LIST_QUERY=`
query AvoidReportCatalogList($guildId:Int!,$start:Float!,$end:Float!,$zoneId:Int!,$limit:Int!,$page:Int!){reportData{reports(guildID:$guildId,startTime:$start,endTime:$end,zoneID:$zoneId,limit:$limit,page:$page){total has_more_pages data{code title startTime endTime zone{id name}}}}}`;
