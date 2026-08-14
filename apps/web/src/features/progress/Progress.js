import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { Badge } from "../../components/ui/Badge.js";
import { PanelTitle } from "../../components/ui/PanelTitle.js";
import { StatCard } from "../../components/ui/StatCard.js";
import { PullCurve } from "../../components/charts/PullCurve.js";

// Deterministic reconstruction of golden symbol k0.
export function Progress(){
  return jsxs(Fragment,{
    children:[jsxs("section",{
      className:"page-banner",children:[jsxs("div",{
        children:[jsx(Badge,{
          tone:"good",children:"PROGRESS MODEL"
        }),jsx("h2",{
          children:"Are we actually getting better?"
        }),jsx("p",{
          children:"Depth, repeatability and phase conversion across every Avoid raid night."
        })]
      }),jsxs("div",{
        className:"banner-stat",children:[jsx("label",{
          children:"PROGRESSION VELOCITY"
        }),jsx("b",{
          children:"1.4\xD7"
        }),jsx("small",{
          children:"faster than matched guilds"
        })]
      })]
    }),jsxs("section",{
      className:"stats-row",children:[jsx(StatCard,{
        label:"PULLS THIS RESET",value:"63",delta:"+17"
      }),jsx(StatCard,{
        label:"MEDIAN BOSS HP",value:"18.6%",delta:"\u2193 22.1%"
      }),jsx(StatCard,{
        label:"PULLS WITHOUT EARLY DEATH",value:"38",delta:"+31%"
      }),jsx(StatCard,{
        label:"P3 SURVIVAL",value:"64.8s",delta:"+18.4s"
      }),jsx(StatCard,{
        label:"MATABLE PULLS",value:"8",delta:"+6"
      })]
    }),jsxs("section",{
      className:"layout-2",children:[jsxs("article",{
        className:"panel tall",children:[jsx(PanelTitle,{
          id:"01",title:"All-pull progression",sub:"Best, median and consistency band"
        }),jsx(PullCurve,{
          
        }),jsxs("div",{
          className:"legend-row",children:[jsxs("span",{
            children:[jsx("i",{
              className:"good"
            }),"Boss HP"]
          }),jsxs("span",{
            children:[jsx("i",{
              className:"info"
            }),"Median trend"]
          }),jsxs("span",{
            children:[jsx("i",{
              className:"warn"
            }),"Phase threshold"]
          })]
        })]
      }),jsxs("article",{
        className:"panel",children:[jsx(PanelTitle,{
          id:"02",title:"Night-over-night",sub:"Reset progression"
        }),jsxs("div",{
          className:"night-table",children:[jsxs("div",{
            children:[jsxs("span",{
              children:["TUE \xB7 21 PULLS",jsx("small",{
                children:"Best 26.0%"
              })]
            }),jsx("b",{
              children:"Learning P3"
            }),jsx("em",{
              children:"46.3% median"
            })]
          }),jsxs("div",{
            children:[jsxs("span",{
              children:["THU \xB7 17 PULLS",jsx("small",{
                children:"Best 9.8%"
              })]
            }),jsx("b",{
              children:"Stabilizing"
            }),jsx("em",{
              children:"24.2% median"
            })]
          }),jsxs("div",{
            className:"active",children:[jsxs("span",{
              children:["SUN \xB7 25 PULLS",jsx("small",{
                children:"Best 3.2%"
              })]
            }),jsx("b",{
              children:"Killable"
            }),jsx("em",{
              children:"18.6% median"
            })]
          })]
        }),jsxs("div",{
          className:"insight-box",children:[jsx(Badge,{
            tone:"good",children:"RECOMMENDATION"
          }),jsx("p",{
            children:"Do not change composition for damage. Spend the next raid on P3 defensive sequencing and Eruption positioning."
          })]
        })]
      })]
    }),jsxs("article",{
      className:"panel",children:[jsx(PanelTitle,{
        id:"03",title:"Phase progression matrix",sub:"Each square is one pull \xB7 darker means cleaner execution"
      }),jsxs("div",{
        className:"matrix",children:[jsx("label",{
          
        }),jsx("label",{
          children:"P1"
        }),jsx("label",{
          children:"P2A"
        }),jsx("label",{
          children:"P2B"
        }),jsx("label",{
          children:"P3A"
        }),jsx("label",{
          children:"P3B"
        }),[1,2,3,4,5,6,7,8].flatMap(l=>[jsxs("b",{
          children:["PULL ",18+l]
        },`l${l}`),...Array.from({
          length:5
        },(a,e)=>jsx("i",{
          className:e<2||l>e?"clean":l+e>8?"fail":"rough"
        },`${l}-${e}`))])]
      })]
    })]
  })
}
