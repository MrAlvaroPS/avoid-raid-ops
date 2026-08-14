import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { PROGRESSION_MOCK } from "../../data/goldenMocks.js";

// Deterministic reconstruction of golden symbol Gp.
export function PullCurve(){
  let l=PROGRESSION_MOCK.map((a,e)=>`${3+e/(Fi.length-1)*94},${6+a/100*74}`).join(" ");
  return jsxs("div",{
    className:"pullcurve",children:[jsxs("div",{
      className:"axis",children:[jsx("span",{
        children:"0%"
      }),jsx("span",{
        children:"25%"
      }),jsx("span",{
        children:"50%"
      }),jsx("span",{
        children:"75%"
      }),jsx("span",{
        children:"100%"
      })]
    }),jsxs("svg",{
      viewBox:"0 0 100 86",preserveAspectRatio:"none",children:[[6,24.5,43,61.5,80].map(a=>jsx("line",{
        x1:"3",y1:a,x2:"97",y2:a
      },a)),jsx("polygon",{
        points:`3,80 ${l} 97,80`
      }),jsx("polyline",{
        points:l
      }),PROGRESSION_MOCK.map((a,e)=>jsx("circle",{
        cx:3+e/(PROGRESSION_MOCK.length-1)*94,cy:6+a/100*74,r:e===24?1.5:.6
      },e))]
    }),jsxs("div",{
      className:"pull-labels",children:[jsx("span",{
        children:"PULL 1"
      }),jsx("span",{
        children:"PULL 13"
      }),jsx("span",{
        children:"PULL 25"
      })]
    })]
  })
}
