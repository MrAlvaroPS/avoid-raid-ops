import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { Badge } from "../../components/ui/Badge.js";
import { PanelTitle } from "../../components/ui/PanelTitle.js";
import { StatCard } from "../../components/ui/StatCard.js";
import { MiniBar } from "../../components/ui/MiniBar.js";
import { MECHANICS_MOCK } from "../../data/goldenMocks.js";
import { CorpusWorkbench } from "./CorpusWorkbench.js";

// Deterministic reconstruction of golden symbol F0.
export function Mechanics(){
  let[l,a]=useState("Nether Eruption");
  return jsxs(Fragment,{
    children:[jsxs("section",{
      className:"page-banner",children:[jsxs("div",{
        children:[jsx(Badge,{
          tone:"bad",children:"ROOT-CAUSE ENGINE"
        }),jsx("h2",{
          children:"Mechanics Library"
        }),jsx("p",{
          children:"Every relevant mechanic, its assignments, failure rate and downstream wipe impact."
        })]
      }),jsxs("div",{
        className:"banner-stat",children:[jsx("label",{
          children:"MECHANICAL ACCURACY"
        }),jsx("b",{
          children:"86"
        }),jsx("small",{
          children:"+5 vs matched peers"
        })]
      })]
    }),jsx(CorpusWorkbench,{}),jsxs("article",{
      className:"panel",children:[jsx(PanelTitle,{
        id:"01",title:"Encounter mechanic catalogue",sub:"25 pulls \xB7 ordered by wipe impact"
      }),jsxs("div",{
        className:"mechanic-table",children:[jsxs("div",{
          className:"mt-head",children:[jsx("span",{
            children:"MECHANIC"
          }),jsx("span",{
            children:"TYPE"
          }),jsx("span",{
            children:"FIRST CAST"
          }),jsx("span",{
            children:"FAILURES"
          }),jsx("span",{
            children:"WIPE IMPACT"
          }),jsx("span",{
            children:"STATUS"
          })]
        }),MECHANICS_MOCK.map(e=>jsxs("button",{
          className:l===e[0]?"selected":"",onClick:()=>a(e[0]),children:[jsxs("span",{
            children:[jsx("i",{
              children:e[0][0]
            }),jsx("b",{
              children:e[0]
            })]
          }),jsx("span",{
            children:e[1]
          }),jsx("span",{
            children:e[2]
          }),jsx("b",{
            children:e[3]
          }),jsx("em",{
            children:e[4]
          }),jsx(Badge,{
            tone:e[5]==="Critical"?"bad":e[5]==="Unstable"?"warn":e[5]==="Improving"?"info":"good",children:e[5]
          })]
        },e[0]))]
      })]
    }),jsxs("section",{
      className:"layout-2",children:[jsxs("article",{
        className:"panel",children:[jsx(PanelTitle,{
          id:"02",title:`${l} \xB7 root-cause chain`,sub:"Trigger, cascade and wipe are kept separate"
        }),jsxs("div",{
          className:"cause-flow",children:[jsxs("div",{
            children:[jsx("i",{
              children:"1"
            }),jsxs("span",{
              children:[jsx("label",{
                children:"TRIGGER"
              }),jsx("b",{
                children:"Defensive not active"
              }),jsx("small",{
                children:"Ravok takes 612K unmitigated"
              })]
            })]
          }),jsx("strong",{
            children:"\u2192"
          }),jsxs("div",{
            children:[jsx("i",{
              children:"2"
            }),jsxs("span",{
              children:[jsx("label",{
                children:"CASCADE"
              }),jsx("b",{
                children:"Emergency healing diverted"
              }),jsx("small",{
                children:"Veyra stops Shard target healing"
              })]
            })]
          }),jsx("strong",{
            children:"\u2192"
          }),jsxs("div",{
            children:[jsx("i",{
              children:"3"
            }),jsxs("span",{
              children:[jsx("label",{
                children:"OUTCOME"
              }),jsx("b",{
                children:"3 deaths in 2.1s"
              }),jsx("small",{
                children:"Pull becomes unrecoverable"
              })]
            })]
          })]
        }),jsxs("div",{
          className:"cause-summary",children:[jsx(Badge,{
            tone:"bad",children:"31% OF WIPES"
          }),jsx("p",{
            children:"Nether Eruption is the primary root event in 8 pulls. Only 3 failures are player positioning errors; 5 begin with missing mitigation."
          })]
        })]
      }),jsxs("article",{
        className:"panel",children:[jsx(PanelTitle,{
          id:"03",title:"Assignment compliance",sub:"Interrupts, dispels, soaks and externals"
        }),jsx("div",{
          className:"assignment-list",children:[["Interrupt rotation",96,"2 missed / 54","good"],["Shard spreads",88,"6 collisions / 50","warn"],["Dominion soaks",94,"3 missed / 48","good"],["Eruption personals",68,"16 missed / 50","bad"],["Astral Scar dispels",98,"1 late / 42","good"]].map(e=>jsxs("div",{
            children:[jsxs("span",{
              children:[jsx("b",{
                children:e[0]
              }),jsx("small",{
                children:e[2]
              })]
            }),jsx(MiniBar,{
              value:Number(e[1]),tone:e[3]
            }),jsxs("strong",{
              children:[e[1],"%"]
            })]
          },e[0]))
        })]
      })]
    })]
  })
}
