import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { LineChart } from "./LineChart.js";

// Deterministic reconstruction of golden symbol qp.
export function RaidChart({
  mode:l="damage"
}){
  return jsxs("div",{
    className:"raid-chart",children:[jsxs("div",{
      className:"chart-y",children:[jsx("span",{
        children:l==="damage"?"24M":"2.4M"
      }),jsx("span",{
        children:l==="damage"?"12M":"1.2M"
      }),jsx("span",{
        children:"0"
      })]
    }),jsxs("div",{
      className:"chart-plot",children:[jsx(LineChart,{
        values:l==="damage"?[44,56,61,58,79,67,70,88,74,69,84,72,98,81,77,91,75,68,100,88,74,79,92,72,65,61,58,54]:[35,44,49,38,68,42,57,75,48,56,88,52,66,95,54,62,78,59,97,64,84,72,91,77,89,93,86,99],color:l==="damage"?"#50e4b1":"#b788ff",fill:!0
      }),jsxs("div",{
        className:"phasebands",children:[jsx("span",{
          children:"P1"
        }),jsx("span",{
          children:"P2"
        }),jsx("span",{
          children:"P3"
        })]
      }),jsx("i",{
        className:"event e1",children:"BL"
      }),jsx("i",{
        className:"event e2",children:"ERUPTION"
      }),jsx("i",{
        className:"event e3",children:"SHARDS"
      })]
    })]
  })
}
