import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { Badge } from "../../components/ui/Badge.js";
import { PanelTitle } from "../../components/ui/PanelTitle.js";
import { StatCard } from "../../components/ui/StatCard.js";
import { MiniBar } from "../../components/ui/MiniBar.js";
import { DEFENSIVE_AUDIT_MOCK } from "../../data/goldenMocks.js";

// Deterministic reconstruction of golden symbol $0.
export function DefensiveAudit(){
  let[l,a]=useState("All players");
  return jsxs(Fragment,{
    children:[jsxs("section",{
      className:"page-banner defensive-banner",children:[jsxs("div",{
        children:[jsx(Badge,{
          tone:"bad",children:"LETHAL WINDOW AUDIT"
        }),jsx("h2",{
          children:"Defensive Audit"
        }),jsx("p",{
          children:"Who used what, who held it, and who died with a personal, Healthstone or healing potion available."
        })]
      }),jsxs("div",{
        className:"banner-stat critical",children:[jsx("label",{
          children:"PREVENTABLE DEATHS"
        }),jsx("b",{
          children:"5"
        }),jsx("small",{
          children:"of 11 deaths in P3"
        })]
      })]
    }),jsxs("section",{
      className:"stats-row",children:[jsx(StatCard,{
        label:"PERSONAL COVERAGE",value:"78%",delta:"-13%",tone:"bad",meta:"Kill median: 91%"
      }),jsx(StatCard,{
        label:"HEALTHSTONE USE",value:"64%",delta:"-18%",tone:"bad",meta:"On lethal eligible events"
      }),jsx(StatCard,{
        label:"HEALING POTION USE",value:"48%",delta:"-29%",tone:"bad",meta:"When available + needed"
      }),jsx(StatCard,{
        label:"DIED WITH PERSONAL",value:"3",delta:"2 repeated",tone:"bad"
      }),jsx(StatCard,{
        label:"DIED WITH CONSUMABLE",value:"5",delta:"45% of deaths",tone:"bad"
      })]
    }),jsxs("article",{
      className:"panel",children:[jsx(PanelTitle,{
        id:"01",title:"Player defensive accountability",sub:"Last 5 Phase 3 attempts"
      }),jsxs("div",{
        className:"audit-controls",children:[jsx("div",{
          children:["All players","Deaths only","Missed uses"].map(e=>jsx("button",{
            className:l===e?"active":"",onClick:()=>a(e),children:e
          },e))
        }),jsx(Badge,{
          tone:"info",children:"WINDOW: NETHER ERUPTION"
        })]
      }),jsxs("div",{
        className:"audit-table",children:[jsxs("div",{
          className:"at-head",children:[jsx("span",{
            children:"PLAYER"
          }),jsx("span",{
            children:"PERSONAL"
          }),jsx("span",{
            children:"OPPORTUNITIES"
          }),jsx("span",{
            children:"PERSONAL USED"
          }),jsx("span",{
            children:"HEALTHSTONE"
          }),jsx("span",{
            children:"HEAL POTION"
          }),jsx("span",{
            children:"DEATH REVIEW"
          })]
        }),DEFENSIVE_AUDIT_MOCK.filter((e,t)=>l==="All players"||l==="Deaths only"?l==="All players"||t<3:t<2).map((e,t)=>jsxs("div",{
          className:t<2?"critical-row":"",children:[jsxs("span",{
            className:"audit-player",children:[jsx("i",{
              children:e[0][0]
            }),jsx("b",{
              children:e[0]
            })]
          }),jsxs("span",{
            children:[jsx("b",{
              children:e[1]
            }),jsx("small",{
              children:"Ready at 06:14"
            })]
          }),jsx("span",{
            children:e[4]
          }),jsxs("span",{
            children:[jsxs("b",{
              className:Number(e[5])<4?"bad-text":"good-text",children:[e[5]," / ",e[4]]
            }),jsx(MiniBar,{
              value:Number(e[5])/Number(e[4])*100,tone:Number(e[5])<4?"bad":"good"
            })]
          }),jsx("span",{
            children:jsxs("b",{
              className:Number(e[6])<3?"bad-text":"good-text",children:[e[6]," / 4"]
            })
          }),jsx("span",{
            children:jsxs("b",{
              className:Number(e[7])<3?"bad-text":"good-text",children:[e[7]," / 4"]
            })
          }),jsx("span",{
            children:jsx(Badge,{
              tone:t<2?"bad":t===2?"warn":"good",children:e[8]
            })
          })]
        },e[0]))]
      })]
    }),jsxs("section",{
      className:"layout-2",children:[jsxs("article",{
        className:"panel",children:[jsx(PanelTitle,{
          id:"02",title:"Death replay \xB7 Ravok",sub:"10 seconds before death \xB7 Pull 25"
        }),jsxs("div",{
          className:"death-replay",children:[jsxs("div",{
            children:[jsx("time",{
              children:"06:10.4"
            }),jsx("span",{
              children:"Cosmic Shard"
            }),jsx("b",{
              className:"bad-text",children:"-284K"
            })]
          }),jsxs("div",{
            children:[jsx("time",{
              children:"06:12.1"
            }),jsx("span",{
              children:"Riptide"
            }),jsx("b",{
              className:"good-text",children:"+96K"
            })]
          }),jsxs("div",{
            className:"missed",children:[jsx("time",{
              children:"06:13.0"
            }),jsx("span",{
              children:"Astral Shift ready"
            }),jsx("b",{
              children:"NOT USED"
            })]
          }),jsxs("div",{
            className:"missed",children:[jsx("time",{
              children:"06:13.0"
            }),jsx("span",{
              children:"Healthstone + potion ready"
            }),jsx("b",{
              children:"NOT USED"
            })]
          }),jsxs("div",{
            children:[jsx("time",{
              children:"06:14.6"
            }),jsx("span",{
              children:"Nether Eruption"
            }),jsx("b",{
              className:"bad-text",children:"-612K"
            })]
          }),jsxs("div",{
            className:"death",children:[jsx("time",{
              children:"06:14.7"
            }),jsx("span",{
              children:"Ravok dies"
            }),jsx("b",{
              children:"0 HP"
            })]
          })]
        }),jsxs("div",{
          className:"verdict",children:[jsx(Badge,{
            tone:"bad",children:"PREVENTABLE"
          }),jsx("p",{
            children:"Astral Shift alone reduces the lethal hit below remaining health. Healthstone or potion also creates a survivable outcome."
          })]
        })]
      }),jsxs("article",{
        className:"panel",children:[jsx(PanelTitle,{
          id:"03",title:"Defensive plan vs execution",sub:"Assigned raid cooldown coverage"
        }),jsx("div",{
          className:"cd-plan",children:[["05:48","Cosmic Shards","Aura Mastery","05:48.4","good"],["06:14","Nether Eruption","Rallying Cry","06:16.1","warn"],["06:14","Nether Eruption","Spirit Link","\u2014","bad"],["06:42","Shard + Eruption","Darkness","06:51.0","bad"]].map(e=>jsxs("div",{
            children:[jsx("time",{
              children:e[0]
            }),jsxs("span",{
              children:[jsx("b",{
                children:e[1]
              }),jsx("small",{
                children:e[2]
              })]
            }),jsx("em",{
              children:e[3]
            }),jsx(Badge,{
              tone:e[4],children:e[4]==="good"?"ON TIME":e[3]==="\u2014"?"MISSED":"LATE"
            })]
          },e[0]+e[2]))
        })]
      })]
    })]
  })
}
