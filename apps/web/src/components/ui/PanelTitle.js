import { jsx, jsxs, Fragment } from "react/jsx-runtime";

// Deterministic reconstruction of golden symbol q.
export function PanelTitle({
  id:l,title:a,sub:e,action:t
}){
  return jsxs("div",{
    className:"panel-title",children:[jsxs("div",{
      children:[jsx("i",{
        children:l
      }),jsxs("span",{
        children:[jsx("h3",{
          children:a
        }),e&&jsx("p",{
          children:e
        })]
      })]
    }),t&&jsxs("button",{
      children:[t," \u2192"]
    })]
  })
}
