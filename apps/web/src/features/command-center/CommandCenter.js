import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { Badge } from "../../components/ui/Badge.js";
import { PanelTitle } from "../../components/ui/PanelTitle.js";
import { StatCard } from "../../components/ui/StatCard.js";
import { PullCurve } from "../../components/charts/PullCurve.js";
import { MiniBar } from "../../components/ui/MiniBar.js";

// Deterministic reconstruction of golden symbol K0.
export function CommandCenter({
  go:l
}){
  return jsxs(Fragment,{
    children:[jsxs("section",{
      className:"overview-hero",children:[jsxs("div",{
        className:"hero-copy",children:[jsx(Badge,{
          tone:"good",children:"\u25CF LIVE PROGRESSION"
        }),jsxs("h2",{
          children:["One clean Phase 3.",jsx("br",{
            
          }),jsx("span",{
            children:"That is the assignment."
          })]
        }),jsx("p",{
          children:"Avoid has kill-ready damage and healing. The remaining gap is defensive discipline through the second Nether Eruption overlap."
        }),jsxs("div",{
          className:"hero-actions",children:[jsx("button",{
            onClick:()=>l("Defensive Audit"),children:"Open defensive audit \u2192"
          }),jsx("button",{
            onClick:()=>l("Pull Lab"),children:"Compare best pulls"
          })]
        })]
      }),jsx("div",{
        className:"kill-ring",children:jsxs("div",{
          children:[jsx("strong",{
            children:"68"
          }),jsx("small",{
            children:"KILL READINESS"
          }),jsx(Badge,{
            tone:"warn",children:"KILLABLE"
          })]
        })
      }),jsx("div",{
        className:"avoid-watermark",children:"AVOID"
      })]
    }),jsxs("section",{
      className:"stats-row",children:[jsx(StatCard,{
        label:"BEST PULL",value:"3.2%",delta:"\u2193 6.6%",meta:"Pull 25 \xB7 7:34"
      }),jsx(StatCard,{
        label:"P3 CONVERSION",value:"44%",delta:"\u2191 21%",meta:"11 of 25 pulls"
      }),jsx(StatCard,{
        label:"KILL-READY PULLS",value:"8",delta:"+6",meta:"Projected DPS sufficient"
      }),jsx(StatCard,{
        label:"EARLY DEATHS",value:"7",delta:"\u2193 38%",meta:"Before 4:00"
      }),jsx(StatCard,{
        label:"RAID DPS",value:"18.7M",delta:"+4.1%",meta:"Kill median: 18.2M"
      })]
    }),jsxs("section",{
      className:"layout-2",children:[jsxs("article",{
        className:"panel",children:[jsx(PanelTitle,{
          id:"01",title:"Progression intelligence",sub:"Boss health remaining \xB7 current reset",action:"Full progress"
        }),jsx(PullCurve,{
          
        }),jsxs("div",{
          className:"signal",children:[jsx("i",{
            children:"\u2726"
          }),jsxs("span",{
            children:[jsx("b",{
              children:"Breakthrough detected at Pull 18"
            }),jsx("p",{
              children:"Median outcome improved 17.4% after the roster change. Progress is now repeatable, not a single lucky pull."
            })]
          })]
        })]
      }),jsxs("article",{
        className:"panel blocker",children:[jsx(PanelTitle,{
          id:"02",title:"Current blocker",sub:"Root-cause model \xB7 last 10 pulls"
        }),jsxs("div",{
          className:"blocker-main",children:[jsx("i",{
            children:"!"
          }),jsxs("span",{
            children:[jsx(Badge,{
              tone:"bad",children:"P3 \xB7 06:14\u201407:08"
            }),jsx("h3",{
              children:"Nether Eruption + Cosmic Shard"
            }),jsx("p",{
              children:"6 of the last 10 pulls ended in this overlap. 8 personal defensives and 5 consumables were available but unused."
            })]
          })]
        }),jsxs("div",{
          className:"blocker-metrics",children:[jsx(StatCard,{
            label:"LINKED DEATHS",value:"11"
          }),jsx(StatCard,{
            label:"UNUSED DEFENSIVES",value:"8"
          }),jsx(StatCard,{
            label:"AVG RAID HP",value:"42%",tone:"bad"
          })]
        }),jsx("button",{
          className:"wide-action",onClick:()=>l("Mechanics"),children:"Open root-cause analysis \u2192"
        })]
      })]
    }),jsxs("article",{
      className:"panel what",children:[jsx(PanelTitle,{
        id:"03",title:"What changed?",sub:"Thursday vs Tuesday \xB7 25 pulls compared"
      }),jsxs("div",{
        className:"change-grid",children:[jsxs("div",{
          className:"change good",children:[jsx("i",{
            children:"\u2197"
          }),jsxs("span",{
            children:[jsx("label",{
              children:"BIGGEST GAIN"
            }),jsx("b",{
              children:"P2 first death moved +38s"
            }),jsx("p",{
              children:"47% less avoidable damage after tightening Void Collapse positioning."
            })]
          }),jsx("strong",{
            children:"+18%"
          })]
        }),jsxs("div",{
          className:"change bad",children:[jsx("i",{
            children:"!"
          }),jsxs("span",{
            children:[jsx("label",{
              children:"NEW REGRESSION"
            }),jsx("b",{
              children:"Defensive coverage drifted"
            }),jsx("p",{
              children:"Three players stopped using personals consistently after pull 20."
            })]
          }),jsx("strong",{
            children:"-11%"
          })]
        }),jsxs("div",{
          className:"change info",children:[jsx("i",{
            children:"\u2301"
          }),jsxs("span",{
            children:[jsx("label",{
              children:"ROSTER EFFECT"
            }),jsx("b",{
              children:"Mirael lifted execute DPS"
            }),jsx("p",{
              children:"Phase 3 gained 820K DPS with the new composition."
            })]
          }),jsx("strong",{
            children:"+6.7%"
          })]
        })]
      })]
    }),jsxs("section",{
      className:"layout-3",children:[jsxs("article",{
        className:"panel",children:[jsx(PanelTitle,{
          id:"04",title:"Phase control",sub:"Reach rate / survival"
        }),[["P1 \xB7 THE ASCENT",98,"0.2 deaths / pull","good"],["P2 \xB7 FRACTURED REALM",82,"+14% tonight","info"],["P3 \xB7 KING'S FALL",54,"1.8 deaths / pull","warn"]].map(a=>jsxs("div",{
          className:"phase-row",children:[jsxs("div",{
            children:[jsx("b",{
              children:a[0]
            }),jsxs("strong",{
              children:[a[1],"%"]
            })]
          }),jsx(MiniBar,{
            value:Number(a[1]),tone:a[3]
          }),jsx("small",{
            children:a[2]
          })]
        },a[0]))]
      }),jsxs("article",{
        className:"panel",children:[jsx(PanelTitle,{
          id:"05",title:"Wipe signatures",sub:"Cause \u2260 cascade"
        }),jsxs("div",{
          className:"wipe-summary",children:[jsxs("div",{
            className:"wipe-ring",children:[jsx("b",{
              children:"25"
            }),jsx("small",{
              children:"PULLS"
            })]
          }),jsx("div",{
            children:[["Mechanic root cause","44%","bad"],["Cascade after death","28%","warn"],["Healing / defensive","16%","info"],["Damage check","8%","good"]].map(a=>jsxs("p",{
              children:[jsxs("span",{
                children:[jsx("i",{
                  className:a[2]
                }),a[0]]
              }),jsx("b",{
                children:a[1]
              })]
            },a[0]))
          })]
        })]
      }),jsxs("article",{
        className:"panel",children:[jsx(PanelTitle,{
          id:"06",title:"Peer benchmark",sub:"184 matched Mythic guilds"
        }),jsxs("div",{
          className:"peer-rank",children:[jsx("label",{
            children:"PROGRESSION VELOCITY"
          }),jsx("b",{
            children:"TOP 24%"
          }),jsx(LineChart,{
            values:[18,24,29,27,38,46,59,72,81]
          })]
        }),jsxs("div",{
          className:"peer-line",children:[jsxs("span",{
            children:["Pulls to 10%",jsx("small",{
              children:"Peer median 31"
            })]
          }),jsx("b",{
            children:"22"
          })]
        }),jsxs("div",{
          className:"peer-line",children:[jsxs("span",{
            children:["Mechanical accuracy",jsx("small",{
              children:"Peer median 81"
            })]
          }),jsx("b",{
            children:"86"
          })]
        })]
      })]
    })]
  })
}
