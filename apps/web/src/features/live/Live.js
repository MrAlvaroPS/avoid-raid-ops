import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { Badge } from "../../components/ui/Badge.js";
import { PanelTitle } from "../../components/ui/PanelTitle.js";
import { StatCard } from "../../components/ui/StatCard.js";
import { RaidChart } from "../../components/charts/RaidChart.js";
import { LIVE_PULLS_MOCK } from "../../data/goldenMocks.js";

// Deterministic reconstruction of golden symbol P0.
export function Live(){
  let[l,a]=useState(28),[e,t]=useState(!0),n=LIVE_PULLS_MOCK.find(i=>i.id===l)||LIVE_PULLS_MOCK[0];
  return jsxs(Fragment,{
    children:[jsxs("section",{
      className:"live-command",children:[jsxs("div",{
        children:[jsx(Badge,{
          tone:e?"bad":"info",children:e?"\u25CF LIVE LOG STREAM":"STREAM PAUSED"
        }),jsx("h2",{
          children:"Raid Night Control Room"
        }),jsx("p",{
          children:"Each uploaded pull becomes an immediate RL brief: outcome, root cause, raider execution and the next adjustment to call."
        }),jsxs("div",{
          className:"stream-meta",children:[jsxs("span",{
            children:[jsx("i",{
              
            }),"WCL REPORT ",jsx("b",{
              children:"AVD-7K2P9"
            })]
          }),jsxs("span",{
            children:["LAST EVENT ",jsx("b",{
              children:"8s ago"
            })]
          }),jsxs("span",{
            children:["QUEUE ",jsx("b",{
              children:"0 pulls"
            })]
          })]
        })]
      }),jsx("button",{
        className:e?"stream-button active":"stream-button",onClick:()=>t(!e),children:e?"\u2161 PAUSE INGESTION":"\u25B6 RESUME INGESTION"
      })]
    }),jsxs("section",{
      className:"live-shell",children:[jsxs("aside",{
        className:"pull-rail",children:[jsxs("div",{
          className:"rail-head",children:[jsx("span",{
            children:"TONIGHT'S PULLS"
          }),jsx("b",{
            children:"28 total"
          })]
        }),LIVE_PULLS_MOCK.map(i=>jsxs("button",{
          className:l===i.id?"selected":"",onClick:()=>a(i.id),children:[jsxs("span",{
            children:[jsxs("b",{
              children:["PULL ",i.id]
            }),jsxs("small",{
              children:[i.duration," \xB7 ",i.phase.split(" \xB7 ")[0]]
            })]
          }),jsx("strong",{
            children:i.hp
          }),jsx("i",{
            className:i.status==="REFERENCE"?"ref":"",children:i.status
          })]
        },i.id)),jsxs("button",{
          className:"incoming",children:[jsx("span",{
            className:"ingest-spinner"
          }),jsxs("span",{
            children:[jsx("b",{
              children:"LISTENING"
            }),jsx("small",{
              children:"Waiting for next upload"
            })]
          })]
        })]
      }),jsxs("div",{
        className:"live-workspace",children:[jsxs("section",{
          className:"pull-headline",children:[jsxs("div",{
            children:[jsxs("span",{
              className:"pull-id",children:["PULL ",n.id]
            }),jsxs(Badge,{
              tone:n.id===25?"good":"warn",children:[n.hp," REMAINING"]
            }),jsx("h2",{
              children:n.phase
            }),jsxs("p",{
              children:["Wipe at ",n.duration," \xB7 First death: ",jsx("b",{
                children:n.firstDeath
              })]
            })]
          }),jsxs("div",{
            className:"execution-score",children:[jsx("strong",{
              children:n.score
            }),jsxs("span",{
              children:["EXECUTION",jsx("br",{
                
              }),"SCORE"]
            })]
          })]
        }),jsxs("section",{
          className:"live-stats",children:[jsx(StatCard,{
            label:"BOSS REMAINING",value:n.hp,delta:n.id===28?"+8.2% vs best":"BEST",tone:n.id===25?"good":"bad"
          }),jsx(StatCard,{
            label:"RAID DPS",value:n.dps,delta:"+1.7% vs previous"
          }),jsx(StatCard,{
            label:"RAID HPS",value:n.hps,delta:"+3.8%"
          }),jsx(StatCard,{
            label:"FIRST DEATH",value:n.firstDeath.split(" \xB7 ")[1],delta:n.firstDeath.split(" \xB7 ")[0],tone:"bad"
          })]
        }),jsxs("article",{
          className:"rl-brief",children:[jsxs("div",{
            className:"brief-label",children:[jsx("i",{
              children:"RL"
            }),jsxs("span",{
              children:[jsx("b",{
                children:"PULL BRIEF"
              }),jsx("small",{
                children:"Generated 8 seconds after upload"
              })]
            })]
          }),jsxs("div",{
            className:"brief-copy",children:[jsx("h3",{
              children:"Better transition. Same lethal habit."
            }),jsxs("p",{
              children:["Avoid reached the second Eruption ",jsx("b",{
                children:"12 seconds faster"
              })," and with 4.1% more raid health than Pull 27. The pull still collapsed because Ravok and Sylen entered the overlap without personals; one Healthstone and two healing potions remained available."]
            })]
          }),jsx(Badge,{
            tone:"bad",children:"EXECUTION BLOCKER"
          })]
        }),jsxs("section",{
          className:"live-grid",children:[jsxs("article",{
            className:"panel",children:[jsx(PanelTitle,{
              id:"01",title:"What improved",sub:`Pull ${n.id} vs Pull ${n.id-1}`
            }),jsxs("div",{
              className:"live-signals good-signals",children:[jsxs("p",{
                children:[jsx("strong",{
                  children:"+12s"
                }),jsxs("span",{
                  children:[jsx("b",{
                    children:"Faster P3 transition"
                  }),jsx("small",{
                    children:"Cleaner Cosmic Shard movement preserved uptime."
                  })]
                })]
              }),jsxs("p",{
                children:[jsx("strong",{
                  children:"+4.1%"
                }),jsxs("span",{
                  children:[jsx("b",{
                    children:"Raid health into Eruption"
                  }),jsx("small",{
                    children:"Healing CDs were better spaced in P2B."
                  })]
                })]
              }),jsxs("p",{
                children:[jsx("strong",{
                  children:"-3"
                }),jsxs("span",{
                  children:[jsx("b",{
                    children:"Mechanical failures"
                  }),jsx("small",{
                    children:"No missed Dominion soak or late dispel."
                  })]
                })]
              })]
            })]
          }),jsxs("article",{
            className:"panel",children:[jsx(PanelTitle,{
              id:"02",title:"What regressed",sub:"New or repeated losses"
            }),jsxs("div",{
              className:"live-signals bad-signals",children:[jsxs("p",{
                children:[jsx("strong",{
                  children:"2"
                }),jsxs("span",{
                  children:[jsx("b",{
                    children:"Personals held at lethal damage"
                  }),jsx("small",{
                    children:"Ravok and Sylen repeated the Pull 27 pattern."
                  })]
                })]
              }),jsxs("p",{
                children:[jsx("strong",{
                  children:"17%"
                }),jsxs("span",{
                  children:[jsx("b",{
                    children:"DPS lost during Shards"
                  }),jsx("small",{
                    children:"Melee spread started 1.8s too early."
                  })]
                })]
              }),jsxs("p",{
                children:[jsx("strong",{
                  children:"+9s"
                }),jsxs("span",{
                  children:[jsx("b",{
                    children:"Darkness was late"
                  }),jsx("small",{
                    children:"Assigned at 06:14, cast after the first deaths."
                  })]
                })]
              })]
            })]
          })]
        }),jsxs("article",{
          className:"panel live-timeline",children:[jsx(PanelTitle,{
            id:"03",title:"Pull timeline",sub:"Damage, healing, mechanics and deaths on one synchronized view"
          }),jsx(RaidChart,{
            mode:"damage"
          }),jsxs("div",{
            className:"timeline-calls",children:[jsxs("span",{
              style:{
                left:"29%"
              },children:[jsx("i",{
                className:"good"
              }),"P2 CLEAN"]
            }),jsxs("span",{
              style:{
                left:"67%"
              },children:[jsx("i",{
                className:"info"
              }),"BLOODLUST"]
            }),jsxs("span",{
              style:{
                left:"82%"
              },children:[jsx("i",{
                className:"warn"
              }),"ERUPTION"]
            }),jsxs("span",{
              style:{
                left:"87%"
              },children:[jsx("i",{
                className:"bad"
              }),"2 DEATHS"]
            })]
          })]
        }),jsxs("article",{
          className:"panel",children:[jsx(PanelTitle,{
            id:"04",title:"Raider review",sub:"Only actionable events from this pull"
          }),jsxs("div",{
            className:"live-raiders",children:[jsxs("div",{
              className:"lr-head",children:[jsx("span",{
                children:"RAIDER"
              }),jsx("span",{
                children:"OUTCOME"
              }),jsx("span",{
                children:"MECHANICS"
              }),jsx("span",{
                children:"DEFENSIVES"
              }),jsx("span",{
                children:"CONSUMABLES"
              }),jsx("span",{
                children:"RL NOTE"
              })]
            }),[["Ravok","DIED \xB7 06:17","1 failure","Astral Shift ready","HS + Potion ready","Preventable death","bad"],["Sylen","DIED \xB7 06:18","Clean","Dispersion ready","Potion ready","Preventable cascade","bad"],["Mirael","ALIVE","Clean","Greater Invis. used","HS unused","Good execution","good"],["Krynn","ALIVE","Clean","IBF used on time","HS used","Reference execution","good"],["Veyra","ALIVE","Clean","Scales used","Potion used","Strong triage healing","good"],["Thorne","ALIVE","Clean","Wall used","HS used","Stable tank plan","good"]].map(i=>jsxs("div",{
              className:String(i[6]),children:[jsxs("span",{
                className:"raider-name",children:[jsx("i",{
                  children:String(i[0])[0]
                }),jsx("b",{
                  children:i[0]
                })]
              }),jsx("strong",{
                children:i[1]
              }),jsx("span",{
                children:i[2]
              }),jsx("span",{
                children:i[3]
              }),jsx("span",{
                children:i[4]
              }),jsx(Badge,{
                tone:i[6],children:i[5]
              })]
            },i[0]))]
          })]
        }),jsxs("section",{
          className:"next-pull",children:[jsxs("div",{
            className:"next-title",children:[jsx(Badge,{
              tone:"good",children:"NEXT PULL"
            }),jsx("h3",{
              children:"Three calls. Nothing else."
            }),jsx("p",{
              children:"The pull is damage-ready. Reduce cognitive load and fix the repeated lethal sequence."
            })]
          }),jsxs("ol",{
            children:[jsxs("li",{
              children:[jsx("i",{
                children:"1"
              }),jsxs("span",{
                children:[jsx("b",{
                  children:"Personal before second Eruption"
                }),jsx("small",{
                  children:"Ravok + Sylen confirm on voice before pull."
                })]
              })]
            }),jsxs("li",{
              children:[jsx("i",{
                children:"2"
              }),jsxs("span",{
                children:[jsx("b",{
                  children:"Move Darkness to 06:12"
                }),jsx("small",{
                  children:"Pre-place it; do not react after damage lands."
                })]
              })]
            }),jsxs("li",{
              children:[jsx("i",{
                children:"3"
              }),jsxs("span",{
                children:[jsx("b",{
                  children:"Hold Shard spread by 1.5s"
                }),jsx("small",{
                  children:"Preserve melee uptime until the actual target lock."
                })]
              })]
            })]
          })]
        }),jsxs("div",{
          className:"prototype-note",children:[jsx(Badge,{
            tone:"info",children:"PROTOTYPE MODE"
          }),jsx("p",{
            children:"This screen simulates live ingestion. Production would subscribe to each WCL live-log upload, paginate events, then refresh the brief when the fight closes."
          })]
        })]
      })]
    })]
  })
}
