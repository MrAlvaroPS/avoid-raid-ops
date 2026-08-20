export const HOME_GUILD_ROSTER_QUERY=`
query AvoidHomeGuildRoster($guildID:Int!,$page:Int!,$limit:Int!){
  guildData{
    guild(id:$guildID){
      id
      name
      server{
        id
        name
        slug
        normalizedName
        region{ id name slug compactName }
      }
      members(page:$page,limit:$limit){
        total
        per_page
        current_page
        last_page
        has_more_pages
        data{
          id
          canonicalID
          name
          classID
          level
          guildRank
          hidden
          server{
            id
            name
            slug
            normalizedName
            region{ id name slug compactName }
          }
        }
      }
    }
  }
  gameData{
    classes{
      id
      name
      slug
      specs{ id name slug }
    }
  }
  rateLimitData{ pointsSpentThisHour limitPerHour pointsResetIn }
}
`;
