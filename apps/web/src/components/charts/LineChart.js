import { jsx, jsxs, Fragment } from "react/jsx-runtime";

// Deterministic reconstruction of golden symbol wf.
export function LineChart({
  values:l,color:a="#50e4b1",fill:e=!1
}){
  let t=Math.min(...l),n=Math.max(...l),i=l.map((c,f)=>`${f/(l.length-1)*100},${38-(c-t)/(n-t||1)*34}`).join(" ");
  return jsxs("svg",{
    className:"linechart",viewBox:"0 0 100 42",preserveAspectRatio:"none","aria-hidden":"true",children:[e&&jsx("polygon",{
      points:`0,42 ${i} 100,42`,fill:a+"12"
    }),jsx("polyline",{
      points:i,fill:"none",stroke:a,strokeWidth:"2",vectorEffect:"non-scaling-stroke"
    })]
  })
}
