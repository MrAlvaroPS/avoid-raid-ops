import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { Badge } from "../../components/ui/Badge.js";
import { PanelTitle } from "../../components/ui/PanelTitle.js";
import { StatCard } from "../../components/ui/StatCard.js";
import { LineChart } from "../../components/charts/LineChart.js";
import { MiniBar } from "../../components/ui/MiniBar.js";
import { PLAYER_RELIABILITY_MOCK } from "../../data/goldenMocks.js";

// Deterministic reconstruction of golden symbol I0.
export function Players(){
  let[l,a]=useState("Ravok"),e=PLAYER_RELIABILITY_MOCK.find(t=>t[0]===l)||PLAYER_RELIABILITY_MOCK[0];
  return jsxs(Fragment,{
    children:[jsxs("section",{
      className:"page-banner",children:[jsxs("div",{
        children:[jsx(Badge,{
          tone:"info",children:"RELIABILITY, NOT PARSE"
        }),jsx("h2",{
          children:"Player Intelligence"
        }),jsx("p",{
          children:"Consistency, mechanics, survival and improvement over time for every Avoid raider."
        })]
      }),jsxs("div",{
        className:"banner-stat",children:[jsx("label",{
          children:"ROSTER RELIABILITY"
        }),jsx("b",{
          children:"91%"
        }),jsx("small",{
          children:"Peer median 84%"
        })]
      })]
    }),jsxs("section",{
      className:"layout-player",children:[jsxs("article",{
        className:"panel player-list",children:[jsx(PanelTitle,{
          id:"01",title:"Avoid roster",sub:"Last 10 progression pulls"
        }),PLAYER_RELIABILITY_MOCK.map(t=>jsxs("button",{
          className:l===t[0]?"selected":"",onClick:()=>a(String(t[0])),children:[jsx("i",{
            children:String(t[0])[0]
          }),jsxs("span",{
            children:[jsx("b",{
              children:t[0]
            }),jsxs("small",{
              children:[t[1]," \xB7 ",t[2]]
            })]
          }),jsx("strong",{
            children:t[3]
          }),jsx("em",{
            className:String(t[7]).startsWith("-")?"bad-text":"good-text",children:t[7]
          })]
        },t[0]))]
      }),jsxs("article",{
        className:"panel player-detail",children:[jsxs("div",{
          className:"player-identity",children:[jsx("i",{
            children:String(e[0])[0]
          }),jsxs("span",{
            children:[jsx(Badge,{
              tone:Number(e[3])<85?"warn":"good",children:Number(e[3])<85?"VOLATILE":"STABLE"
            }),jsx("h2",{
              children:e[0]
            }),jsxs("p",{
              children:[e[1]," \xB7 ",e[2]," \xB7 Avoid Raider"]
            })]
          }),jsxs("b",{
            children:[e[3],jsx("small",{
              children:"RELIABILITY"
            })]
          })]
        }),jsxs("div",{
          className:"player-scores",children:[jsx(StatCard,{
            label:"PERFORMANCE",value:String(e[3])
          }),jsx(StatCard,{
            label:"MECHANICS",value:String(e[4])
          }),jsx(StatCard,{
            label:"SURVIVAL",value:String(e[5])
          }),jsx(StatCard,{
            label:"DEFENSIVES",value:String(e[6]),tone:Number(e[6])<70?"bad":"good"
          })]
        }),jsxs("div",{
          className:"trend-block",children:[jsxs("div",{
            children:[jsx("h3",{
              children:"8-night performance trend"
            }),jsx("p",{
              children:"Phase-normalized execution score"
            })]
          }),jsx(LineChart,{
            values:l==="Ravok"?[82,86,79,85,81,78,76,74]:[72,76,81,79,85,88,91,94],color:l==="Ravok"?"#ff665f":"#50e4b1",fill:!0
          })]
        }),jsxs("div",{
          className:"coaching",children:[jsx(Badge,{
            tone:l==="Ravok"?"bad":"good",children:"COACHING SIGNAL"
          }),jsx("p",{
            children:l==="Ravok"?"Repeated defensive hesitation in lethal P3 windows. Damage output is sufficient; survival habits are the priority.":"Trend is positive across survival and mechanic execution. No recurring progress blocker detected."
          })]
        })]
      })]
    }),jsxs("article",{
      className:"panel",children:[jsx(PanelTitle,{
        id:"02",title:"Roster reliability matrix",sub:"Performance is deliberately separated from progress value"
      }),jsxs("div",{
        className:"reliability-table",children:[jsxs("div",{
          children:[jsx("span",{
            children:"PLAYER"
          }),jsx("span",{
            children:"PERFORMANCE"
          }),jsx("span",{
            children:"MECHANICS"
          }),jsx("span",{
            children:"SURVIVAL"
          }),jsx("span",{
            children:"DEFENSIVES"
          }),jsx("span",{
            children:"STATUS"
          })]
        }),PLAYER_RELIABILITY_MOCK.map(t=>jsxs("div",{
          children:[jsxs("span",{
            children:[jsx("b",{
              children:t[0]
            }),jsx("small",{
              children:t[1]
            })]
          }),[3,4,5,6].map(n=>jsxs("span",{
            children:[jsx("b",{
              children:t[n]
            }),jsx(MiniBar,{
              value:Number(t[n]),tone:Number(t[n])<70?"bad":Number(t[n])<85?"warn":"good"
            })]
          },n)),jsx(Badge,{
            tone:Number(t[3])<85?"warn":"good",children:Number(t[3])<85?"VOLATILE":"RELIABLE"
          })]
        },t[0]))]
      })]
    })]
  })
}
