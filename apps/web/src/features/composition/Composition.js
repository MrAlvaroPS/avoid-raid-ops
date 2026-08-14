import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { Badge } from "../../components/ui/Badge.js";
import { PanelTitle } from "../../components/ui/PanelTitle.js";
import { StatCard } from "../../components/ui/StatCard.js";
import { CLASS_REPRESENTATION_MOCK } from "../../data/goldenMocks.js";
import { RosterIntelligence } from "./RosterIntelligence.js";

// Deterministic reconstruction of golden symbol l1.
export function Composition({roster=[],profileCoverage=null}){
  return jsxs(Fragment,{
    children:[jsxs("section",{
      className:"page-banner",children:[jsxs("div",{
        children:[jsx(Badge,{
          tone:"info",children:"WCL KILL SAMPLE \xB7 184 GUILDS"
        }),jsx("h2",{
          children:"Composition Intelligence"
        }),jsx("p",{
          children:"Avoid's raid composition versus successful kills at comparable ilvl and week."
        })]
      }),jsxs("div",{
        className:"banner-stat",children:[jsx("label",{
          children:"COMPOSITION FIT"
        }),jsx("b",{
          children:"92%"
        }),jsx("small",{
          children:"No hard comp blocker"
        })]
      })]
    }),jsxs("section",{
      className:"stats-row",children:[jsx(StatCard,{
        label:"TANKS",value:"2",delta:"Kill avg 2.0"
      }),jsx(StatCard,{
        label:"HEALERS",value:"4",delta:"Kill avg 4.2"
      }),jsx(StatCard,{
        label:"MELEE DPS",value:"6",delta:"Kill avg 5.7"
      }),jsx(StatCard,{
        label:"RANGED DPS",value:"8",delta:"Kill avg 8.1"
      }),jsx(StatCard,{
        label:"UNIQUE RAID BUFFS",value:"11/12",delta:"Missing Mystic Touch",tone:"warn"
      })]
    }),jsxs("section",{
      className:"layout-2",children:[jsxs("article",{
        className:"panel",children:[jsx(PanelTitle,{
          id:"01",title:"Role distribution",sub:"Avoid vs guilds with a kill"
        }),jsx("div",{
          className:"role-comp",children:[["TANK",10,10],["HEALER",20,21],["MELEE",30,28.5],["RANGED",40,40.5]].map(l=>jsxs("div",{
            children:[jsx("label",{
              children:l[0]
            }),jsxs("div",{
              children:[jsx("i",{
                style:{
                  width:Number(l[1])*2+"%"
                }
              }),jsx("u",{
                style:{
                  width:Number(l[2])*2+"%"
                }
              })]
            }),jsxs("b",{
              children:[l[1],"%"]
            }),jsxs("small",{
              children:[l[2],"%"]
            })]
          },l[0]))
        }),jsxs("div",{
          className:"bench-legend",children:[jsxs("span",{
            children:[jsx("i",{
              
            }),"Avoid"]
          }),jsxs("span",{
            children:[jsx("i",{
              
            }),"Kill sample"]
          })]
        }),jsxs("div",{
          className:"insight-box",children:[jsx(Badge,{
            tone:"good",children:"HEALTHY SPLIT"
          }),jsx("p",{
            children:"Avoid's role balance is within 1.5 percentage points of successful compositions."
          })]
        })]
      }),jsxs("article",{
        className:"panel",children:[jsx(PanelTitle,{
          id:"02",title:"Composition verdict",sub:"What the kill sample suggests"
        }),jsxs("div",{
          className:"comp-verdict",children:[jsxs("div",{
            className:"diag good",children:[jsx(Badge,{
              tone:"good",children:"KEEP"
            }),jsx("b",{
              children:"4-healer setup"
            }),jsx("p",{
              children:"Damage remains above kill median and a fifth healer does not solve unmitigated lethal hits."
            })]
          }),jsxs("div",{
            className:"diag warn",children:[jsx(Badge,{
              tone:"warn",children:"CONSIDER"
            }),jsx("b",{
              children:"Mystic Touch coverage"
            }),jsx("p",{
              children:"A Windwalker appears in 61% of matched kills; estimated raid gain is +1.8% physical damage."
            })]
          }),jsxs("div",{
            className:"diag good",children:[jsx(Badge,{
              tone:"good",children:"KEEP"
            }),jsx("b",{
              children:"Current ranged density"
            }),jsx("p",{
              children:"8 ranged closely matches the successful median and simplifies Cosmic Shard spreads."
            })]
          }),jsxs("div",{
            className:"diag info",children:[jsx(Badge,{
              tone:"info",children:"OPTION"
            }),jsx("b",{
              children:"Second Warlock value"
            }),jsx("p",{
              children:"Extra Gateway is low impact here; do not trade player reliability for theoretical utility."
            })]
          })]
        })]
      })]
    }),jsxs("article",{
      className:"panel",children:[jsx(PanelTitle,{
        id:"03",title:"Class representation",sub:"Average players per 20-person raid \xB7 Avoid vs successful kills"
      }),jsx("div",{
        className:"spec-grid",children:CLASS_REPRESENTATION_MOCK.map(l=>jsxs("div",{
          children:[jsxs("span",{
            children:[jsx("i",{
              style:{
                background:String(l[3])
              }
            }),l[0]]
          }),jsxs("div",{
            className:"spec-bars",children:[jsx("i",{
              style:{
                width:Number(l[1])*42+"%",background:String(l[3])
              }
            }),jsx("u",{
              style:{
                width:Number(l[2])*42+"%"
              }
            })]
          }),jsx("b",{
            children:l[1]
          }),jsx("small",{
            children:l[2]
          })]
        },l[0]))
      })]
    }),roster?.length?jsx(RosterIntelligence,{players:roster,profileCoverage}):null]
  })
}
