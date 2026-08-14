import { jsx, jsxs, Fragment } from "react/jsx-runtime";

// Deterministic reconstruction of golden symbol O.
export function Badge({
  children:l,tone:a="info"
}){
  return jsx("span",{
    className:`badge ${a}`,children:l
  })
}
