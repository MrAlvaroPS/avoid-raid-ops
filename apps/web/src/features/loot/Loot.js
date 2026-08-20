import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";

const initial=()=>({players:window.__AVOID_EXECUTION_CONTEXT__?.activeData?.telemetry?.players||[],worker:null,ledger:null,error:null});

export function Loot(){
  const [state,setState]=useState(initial);
  useEffect(()=>{
    let alive=true;
    const refresh=async()=>{
      try{
        const response=await fetch('/api/loot?state=1');
        const payload=await response.json();
        if(!response.ok||payload?.ok===false)throw new Error(payload?.error||`HTTP ${response.status}`);
        if(alive)setState({players:window.__AVOID_EXECUTION_CONTEXT__?.activeData?.telemetry?.players||[],worker:payload.worker,ledger:payload.ledger,error:null});
      }catch(error){if(alive)setState(s=>({...s,error:error instanceof Error?error.message:String(error)}));}
    };
    const onContext=()=>setState(s=>({...s,players:window.__AVOID_EXECUTION_CONTEXT__?.activeData?.telemetry?.players||[]}));
    void refresh();window.addEventListener('avoid:execution-context',onContext);
    return()=>{alive=false;window.removeEventListener('avoid:execution-context',onContext);};
  },[]);
  return jsxs(Fragment,{children:[jsxs("section",{className:"page-banner",children:[jsxs("div",{children:[jsx("label",{children:"IRIS / RAID LOOT OPERATIONS"}),jsx("h2",{children:"Loot"}),jsx("p",{children:"Raid-only SimulationCraft item value with Reliability, attendance, seniority and loot history kept as independent award signals."})]}),jsxs("div",{className:"banner-stat",children:[jsx("label",{children:"SIMC WORKER"}),jsx("b",{children:state.worker?.available?"READY":"OFFLINE"}),jsx("small",{children:"Official SimulationCraft CLI"})]})]}),state.error?jsx("p",{className:"loot-error",children:state.error}):null,jsxs("section",{className:"stats-row",children:[jsxs("article",{className:"panel",children:[jsx("label",{children:"RAIDERS LOADED"}),jsx("b",{children:String(state.players.length)}),jsx("small",{children:"From active WCL CombatantInfo"})]}),jsxs("article",{className:"panel",children:[jsx("label",{children:"LOOT RECORDED"}),jsx("b",{children:String(state.ledger?.awards?.length||0)}),jsx("small",{children:"Local ledger · WoWAudit sync later"})]}),jsxs("article",{className:"panel",children:[jsx("label",{children:"SIM PROFILE"}),jsx("b",{children:"RAID ST"}),jsx("small",{children:"No DungeonSlice/M+ mixing"})]})]}),jsx("article",{className:"panel",children:jsx("p",{children:"The deploy target currently uses the Golden runtime Loot surface. This source component mirrors the feature boundary for the React migration."})})]});
}
