import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { Badge } from "../../components/ui/Badge.js";
import { PanelTitle } from "../../components/ui/PanelTitle.js";
import { StatCard } from "../../components/ui/StatCard.js";
import { RaidChart } from "../../components/charts/RaidChart.js";

// Deterministic reconstruction of golden symbol W0.
export function DamageHealing(){
  let[l,a]=useState("damage");
  return jsxs(Fragment,{
    children:[jsxs("section",{
      className:"page-banner",children:[jsxs("div",{
        children:[jsx(Badge,{
          tone:"good",children:"KILL BENCHMARK"
        }),jsx("h2",{
          children:"Damage & Healing"
        }),jsx("p",{
          children:"Avoid compared with guilds that killed this boss in the same ilvl and progression window."
        })]
      }),jsxs("div",{
        className:"mode-toggle",children:[jsx("button",{
          className:l==="damage"?"active":"",onClick:()=>a("damage"),children:"DAMAGE"
        }),jsx("button",{
          className:l==="healing"?"active":"",onClick:()=>a("healing"),children:"HEALING"
        })]
      })]
    }),jsxs("section",{
      className:"stats-row",children:[jsx(StatCard,{
        label:"AVOID RAID DPS",value:"18.7M",delta:"+2.7%",meta:"Kill median: 18.2M"
      }),jsx(StatCard,{
        label:"AVOID RAID HPS",value:"1.82M",delta:"+6.4%",meta:"Kill median: 1.71M"
      }),jsx(StatCard,{
        label:"EXECUTE DPS",value:"21.4M",delta:"+4.8%",meta:"P3 only"
      }),jsx(StatCard,{
        label:"OVERHEAL",value:"28.7%",delta:"+6.1%",tone:"bad",meta:"Kill median: 22.6%"
      }),jsx(StatCard,{
        label:"HEALING DEATH GAP",value:"1.4s",delta:"-0.8s",tone:"bad",meta:"Time healable before death"
      })]
    }),jsxs("article",{
      className:"panel bigchart",children:[jsx(PanelTitle,{
        id:"01",title:l==="damage"?"Raid damage timeline":"Raid healing timeline",sub:"Pull 25 \xB7 phase and mechanic aligned"
      }),jsx(RaidChart,{
        mode:l
      }),jsxs("div",{
        className:"chart-footer",children:[jsxs("span",{
          children:[jsx("i",{
            className:"good"
          }),"AVOID"]
        }),jsxs("span",{
          children:[jsx("i",{
            className:"peer-color"
          }),"KILL MEDIAN"]
        }),jsxs("p",{
          children:[jsx("b",{
            children:"Peak at 06:14"
          })," \xB7 Second Nether Eruption creates the largest healing demand while movement cuts raid DPS by 17%."]
        })]
      })]
    }),jsxs("section",{
      className:"layout-2",children:[jsxs("article",{
        className:"panel",children:[jsx(PanelTitle,{
          id:"02",title:"Avoid vs kill benchmark",sub:"Phase-normalized output"
        }),jsx("div",{
          className:"benchmark-bars",children:[["P1 DAMAGE",92,89,"18.1M","17.6M"],["P2 DAMAGE",95,91,"19.4M","18.7M"],["P3 DAMAGE",96,92,"21.4M","20.4M"],["P1 HEALING",84,78,"1.44M","1.36M"],["P2 HEALING",90,82,"1.71M","1.58M"],["P3 HEALING",96,89,"2.23M","2.07M"]].map(e=>jsxs("div",{
            className:"benchbar",children:[jsx("label",{
              children:e[0]
            }),jsxs("div",{
              children:[jsx("i",{
                style:{
                  width:e[1]+"%"
                }
              }),jsx("u",{
                style:{
                  width:e[2]+"%"
                }
              })]
            }),jsx("b",{
              children:e[3]
            }),jsx("small",{
              children:e[4]
            })]
          },e[0]))
        }),jsxs("div",{
          className:"bench-legend",children:[jsxs("span",{
            children:[jsx("i",{
              
            }),"Avoid"]
          }),jsxs("span",{
            children:[jsx("i",{
              
            }),"Kill median"]
          })]
        })]
      }),jsxs("article",{
        className:"panel",children:[jsx(PanelTitle,{
          id:"03",title:"Output diagnostics",sub:"The numbers behind the numbers"
        }),jsxs("div",{
          className:"diagnostics",children:[jsxs("div",{
            className:"diag good",children:[jsx(Badge,{
              tone:"good",children:"SUFFICIENT"
            }),jsx("b",{
              children:"Damage check passes"
            }),jsx("p",{
              children:"8 of the last 12 pulls project a kill before enrage, even with conservative execute uptime."
            })]
          }),jsxs("div",{
            className:"diag good",children:[jsx(Badge,{
              tone:"good",children:"SUFFICIENT"
            }),jsx("b",{
              children:"Raw healing passes"
            }),jsx("p",{
              children:"Avoid exceeds kill HPS by 6.4%. Throughput is not the blocker."
            })]
          }),jsxs("div",{
            className:"diag bad",children:[jsx(Badge,{
              tone:"bad",children:"OUTLIER"
            }),jsx("b",{
              children:"Preventable spike deaths"
            }),jsx("p",{
              children:"5 deaths occurred inside healable windows with a personal or consumable ready."
            })]
          }),jsxs("div",{
            className:"diag warn",children:[jsx(Badge,{
              tone:"warn",children:"INEFFICIENT"
            }),jsx("b",{
              children:"Cooldown stacking"
            }),jsx("p",{
              children:"Spirit Link and Rally overlap twice, leaving 06:14 under-covered."
            })]
          })]
        })]
      })]
    })]
  })
}
