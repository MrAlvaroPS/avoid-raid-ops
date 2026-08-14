import { jsx, jsxs, Fragment } from "react/jsx-runtime";

// Deterministic reconstruction of golden symbol H.
export function StatCard({
  label:l,value:a,delta:e,meta:t,tone:n="good"
}){
  return jsxs("div",{
    className:"stat",children:[jsx("label",{
      children:l
    }),jsxs("div",{
      children:[jsx("b",{
        children:a
      }),e&&jsx("em",{
        className:n,children:e
      })]
    }),t&&jsx("small",{
      children:t
    })]
  })
}
