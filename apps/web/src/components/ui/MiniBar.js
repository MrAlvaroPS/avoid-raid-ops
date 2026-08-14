import { jsx, jsxs, Fragment } from "react/jsx-runtime";

// Deterministic reconstruction of golden symbol Ii.
export function MiniBar({
  value:l,tone:a="good"
}){
  return jsx("i",{
    className:"minibar",children:jsx("u",{
      className:a,style:{
        width:l+"%"
      }
    })
  })
}
