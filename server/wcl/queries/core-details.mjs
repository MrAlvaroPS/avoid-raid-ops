export const CORE_DETAILS_QUERY=`
query AvoidCoreDetails($code:String!,$best:[Int],$compare:[Int],$all:[Int],$phaseStart:Float,$phaseEnd:Float){
 reportData{report(code:$code,allowUnlisted:true){
  bestSummary:table(dataType:Summary,fightIDs:$best)
  compareSummary:table(dataType:Summary,fightIDs:$compare)
  deaths:table(dataType:Deaths,fightIDs:$all)
  healing:table(dataType:Healing,fightIDs:$best)
  executeSummary:table(dataType:Summary,fightIDs:$best,startTime:$phaseStart,endTime:$phaseEnd)
 }}
}`;
