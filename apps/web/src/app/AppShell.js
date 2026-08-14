import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { NAV_ITEMS } from "../data/goldenMocks.js";
import { CommandCenter } from "../features/command-center/CommandCenter.js";
import { Progress } from "../features/progress/Progress.js";
import { PullLab } from "../features/pull-lab/PullLab.js";
import { DamageHealing } from "../features/damage-healing/DamageHealing.js";
import { Mechanics } from "../features/mechanics/Mechanics.js";
import { DefensiveAudit } from "../features/defensive-audit/DefensiveAudit.js";
import { Players } from "../features/players/Players.js";
import { Live } from "../features/live/Live.js";
import { Composition } from "../features/composition/Composition.js";

// Exact application shell reconstructed from golden symbol Xf.
export function AppShell(){
  let[l,a]=useState("Command Center"),[e,t]=useState(!1),n=c=>{
    a(c),t(!1),window.scrollTo({
      top:0,behavior:"smooth"
    })
  },i=()=>l==="Command Center"?jsx(CommandCenter,{
    go:n
  }):l==="LIVE"?jsx(Live,{
    
  }):l==="Progress"?jsx(Progress,{
    
  }):l==="Pull Lab"?jsx(PullLab,{
    
  }):l==="Damage & Healing"?jsx(DamageHealing,{
    
  }):l==="Mechanics"?jsx(Mechanics,{
    
  }):l==="Defensive Audit"?jsx(DefensiveAudit,{
    
  }):l==="Players"?jsx(Players,{
    
  }):jsx(Composition,{
    
  });
  return jsxs("main",{
    className:"app",children:[jsxs("aside",{
      className:e?"sidebar mobile-open":"sidebar",children:[jsxs("div",{
        className:"corp-logo",children:[jsx("strong",{
          children:"A"
        }),jsxs("span",{
          children:[jsx("b",{
            children:"AVOID"
          }),jsx("small",{
            children:"RAID OPERATIONS"
          })]
        }),jsx("button",{
          className:"mobile-close","aria-label":"Close menu",onClick:()=>t(!1),children:"\xD7"
        })]
      }),jsxs("div",{
        className:"division",children:["PERFORMANCE SYSTEM ",jsx("b",{
          children:"01"
        })]
      }),jsx("nav",{
        children:NAV_ITEMS.map(([c,f])=>jsxs("button",{
          className:l===c?"active":"",onClick:()=>n(c),children:[jsx("i",{
            children:f
          }),jsx("span",{
            children:c
          }),c==="LIVE"&&jsx("em",{
            className:"live-count",children:"LIVE"
          }),c==="Defensive Audit"&&jsx("em",{
            children:"5"
          })]
        },c))
      }),jsx("div",{
        className:"sidefill"
      }),jsxs("div",{
        className:"wcl",children:[jsxs("span",{
          children:[jsx("i",{
            
          }),"WARCRAFT LOGS"]
        }),jsx("b",{
          children:"63 pulls indexed"
        }),jsx("small",{
          children:"Updated today \xB7 00:42"
        }),jsx("button",{
          children:"\u21BB Sync reports"
        })]
      }),jsxs("div",{
        className:"profile",children:[jsx("i",{
          children:"AZ"
        }),jsxs("span",{
          children:[jsx("b",{
            children:"Azrath"
          }),jsx("small",{
            children:"Raid Leader \xB7 Avoid"
          })]
        })]
      })]
    }),e&&jsx("button",{
      className:"mobile-overlay","aria-label":"Close navigation",onClick:()=>t(!1)
    }),jsxs("section",{
      className:"workspace",children:[jsxs("header",{
        className:"topbar",children:[jsxs("button",{
          className:"hamburger","aria-label":"Open navigation",onClick:()=>t(!0),children:[jsx("i",{
            
          }),jsx("i",{
            
          }),jsx("i",{
            
          })]
        }),jsxs("div",{
          className:"mobile-brand",children:[jsx("b",{
            children:"AVOID"
          }),jsx("small",{
            children:"RAID OPS"
          })]
        }),jsxs("div",{
          className:"breadcrumbs",children:[jsx("span",{
            children:"AVOID"
          }),jsx("i",{
            children:"/"
          }),jsx("span",{
            children:"NERUB-AR PALACE"
          }),jsx("i",{
            children:"/"
          }),jsx("b",{
            children:l.toUpperCase()
          })]
        }),jsxs("div",{
          className:"selectors",children:[jsx("button",{
            children:"Nexus-King Salhadaar\u2304"
          }),jsx("button",{
            children:"Mythic\u2304"
          }),jsx("button",{
            children:"This reset\u2304"
          }),jsxs("button",{
            className:"live",onClick:()=>n("LIVE"),children:[jsx("i",{
              
            })," LIVE"]
          })]
        })]
      }),jsxs("div",{
        className:"canvas",children:[jsxs("div",{
          className:"page-head",children:[jsxs("div",{
            children:[jsx("label",{
              children:"AVOID // RAID OPERATIONS CENTER"
            }),jsx("h1",{
              children:l
            })]
          }),jsxs("div",{
            className:"avoid-stamp",children:[jsx("span",{
              children:"AVOID"
            }),jsx("b",{
              children:"EU \xB7 DRAENOR"
            })]
          })]
        }),i(),jsxs("footer",{
          children:[jsx("b",{
            children:"AVOID RAID OPERATIONS"
          }),jsx("span",{
            children:"Progress intelligence \xB7 Simulated Warcraft Logs data"
          }),jsx("em",{
            children:"MAKE EVERY PULL COUNT."
          })]
        })]
      })]
    })]
  })
}
