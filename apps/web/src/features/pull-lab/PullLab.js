import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { Badge } from "../../components/ui/Badge.js";
import { PanelTitle } from "../../components/ui/PanelTitle.js";
import { StatCard } from "../../components/ui/StatCard.js";
import { RaidChart } from "../../components/charts/RaidChart.js";
import { MiniBar } from "../../components/ui/MiniBar.js";

// Deterministic reconstruction of golden symbol J0.
export function PullLab(){
  return jsxs(Fragment,{
    children:[jsxs("section",{
      className:"page-banner",children:[jsxs("div",{
        children:[jsx(Badge,{
          tone:"info",children:"SYNCHRONIZED PULLS"
        }),jsx("h2",{
          children:"Pull Lab"
        }),jsx("p",{
          children:"Compare execution, timings and outcomes without opening six Warcraft Logs tabs."
        })]
      }),jsxs("div",{
        className:"pull-select",children:[jsx("b",{
          children:"#25 \xB7 3.2%"
        }),jsx("span",{
          children:"VS"
        }),jsx("b",{
          children:"#22 \xB7 7.2%"
        }),jsx("button",{
          children:"\uFF0B ADD PULL"
        })]
      })]
    }),jsxs("section",{
      className:"layout-2",children:[jsxs("article",{
        className:"panel",children:[jsx(PanelTitle,{
          id:"01",title:"Synchronized encounter timeline",sub:"Deaths, raid cooldowns and phase transitions"
        }),jsxs("div",{
          className:"sync-timeline",children:[jsx("label",{
            children:"#25"
          }),jsxs("div",{
            children:[jsx("i",{
              className:"p1"
            }),jsx("i",{
              className:"p2"
            }),jsx("i",{
              className:"p3"
            }),jsx("u",{
              className:"death",style:{
                left:"84%"
              }
            }),jsx("u",{
              className:"death",style:{
                left:"91%"
              }
            })]
          }),jsx("label",{
            children:"#22"
          }),jsxs("div",{
            children:[jsx("i",{
              className:"p1"
            }),jsx("i",{
              className:"p2"
            }),jsx("i",{
              className:"p3 short"
            }),jsx("u",{
              className:"death",style:{
                left:"78%"
              }
            }),jsx("u",{
              className:"death",style:{
                left:"81%"
              }
            }),jsx("u",{
              className:"death",style:{
                left:"85%"
              }
            })]
          }),jsxs("small",{
            children:[jsx("span",{
              children:"0:00"
            }),jsx("span",{
              children:"P2 \xB7 2:14"
            }),jsx("span",{
              children:"P3 \xB7 4:47"
            }),jsx("span",{
              children:"7:34"
            })]
          })]
        }),jsxs("div",{
          className:"timeline-events",children:[jsxs("span",{
            children:[jsx("i",{
              className:"good"
            }),"Raid CD"]
          }),jsxs("span",{
            children:[jsx("i",{
              className:"bad"
            }),"Death"]
          }),jsxs("span",{
            children:[jsx("i",{
              className:"info"
            }),"Bloodlust"]
          })]
        })]
      }),jsxs("article",{
        className:"panel",children:[jsx(PanelTitle,{
          id:"02",title:"Why pull 25 was better",sub:"Automated delta analysis"
        }),jsxs("div",{
          className:"delta-list",children:[jsxs("p",{
            children:[jsx(Badge,{
              tone:"good",children:"+820K"
            }),jsxs("span",{
              children:[jsx("b",{
                children:"Phase 3 raid DPS"
              }),jsx("small",{
                children:"Mirael + earlier Bloodlust alignment"
              })]
            })]
          }),jsxs("p",{
            children:[jsx(Badge,{
              tone:"good",children:"-12.4s"
            }),jsxs("span",{
              children:[jsx("b",{
                children:"Collective downtime"
              }),jsx("small",{
                children:"Cleaner movement during Cosmic Shards"
              })]
            })]
          }),jsxs("p",{
            children:[jsx(Badge,{
              tone:"good",children:"+18%"
            }),jsxs("span",{
              children:[jsx("b",{
                children:"Defensive coverage"
              }),jsx("small",{
                children:"Rally and AM landed inside assigned windows"
              })]
            })]
          }),jsxs("p",{
            children:[jsx(Badge,{
              tone:"bad",children:"+1"
            }),jsxs("span",{
              children:[jsx("b",{
                children:"Unforced death"
              }),jsx("small",{
                children:"Ravok died with Healthstone ready"
              })]
            })]
          })]
        })]
      })]
    }),jsxs("article",{
      className:"panel",children:[jsx(PanelTitle,{
        id:"03",title:"Pull metrics comparator",sub:"Phase-normalized values"
      }),jsxs("div",{
        className:"compare-table",children:[jsxs("div",{
          className:"ct-head",children:[jsx("span",{
            children:"METRIC"
          }),jsx("b",{
            children:"#25 \xB7 3.2%"
          }),jsx("b",{
            children:"#22 \xB7 7.2%"
          }),jsx("b",{
            children:"DELTA"
          }),jsx("b",{
            children:"KILL MEDIAN"
          })]
        }),[["Duration","7:34","7:18","+16s","7:27"],["Raid DPS","18.7M","17.9M","+4.5%","18.2M"],["Raid HPS","1.82M","1.76M","+3.4%","1.71M"],["First death","6:48","5:56","+52s","No death"],["Avoidable damage","192M","278M","-30.9%","183M"],["Defensive coverage","78%","66%","+12%","91%"],["Interrupt success","96%","91%","+5%","96%"]].map(l=>jsxs("div",{
          children:[jsx("span",{
            children:l[0]
          }),jsx("b",{
            children:l[1]
          }),jsx("b",{
            children:l[2]
          }),jsx("em",{
            children:l[3]
          }),jsx("small",{
            children:l[4]
          })]
        },l[0]))]
      })]
    })]
  })
}
