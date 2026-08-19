import { jsx,jsxs } from 'react/jsx-runtime';
import { useEffect,useState } from 'react';
import { raidOpsClient } from '../../api/raidOpsClient.js';

const n=value=>Number.isFinite(Number(value))?new Intl.NumberFormat('en-US').format(Number(value)):'—';

function sourceCard(label,source,kind){
  let value='NOT AVAILABLE',meta='No persisted source';
  if(source?.status==='ready'&&kind==='official'){value=`${n(source.spellCount)} SPELLS`;meta=`${n(source.sectionCount)} sections · ${source.namespace||'build unknown'}`;}
  if(source?.status==='ready'&&kind==='structural'){value=`${n(source.relations)} RELATIONS`;meta=`DB2 ${source.build||'build unknown'}`;}
  if(source?.status==='ready'&&kind==='corpus'){value=`${n(source.independentSources)} SOURCES`;meta=`${n(source.wideReports)} Wide · ${n(source.deepReports)} Deep`;}
  return jsxs('article',{className:`iris-k-source ${source?.status==='ready'?'ready':'missing'}`,children:[jsx('small',{children:label}),jsx('strong',{children:value}),jsx('p',{children:meta}),jsx('i',{children:source?.status==='ready'?'READY':'MISSING'})]});
}

function mechanicCard(mechanic){
  return jsxs('article',{className:'iris-k-mechanic',children:[
    jsxs('header',{children:[jsxs('div',{children:[jsx('small',{children:`MECHANIC INVESTIGATION · #${mechanic.anchor.abilityId}`}),jsx('h3',{children:mechanic.anchor.name||`Ability ${mechanic.anchor.abilityId}`}),jsx('p',{children:mechanic.anchor.officialMembership?.memberships?.[0]?.path?.join(' › ')||'Official membership unresolved'})]}),jsx('span',{className:`iris-k-status ${mechanic.status?.tone||'neutral'}`,children:mechanic.status?.label||'UNDER INVESTIGATION'})]}),
    jsxs('div',{className:'iris-k-stop',children:[jsx('b',{children:'CURRENT STATE'}),jsx('p',{children:mechanic.status?.why||'No explanation available.'})]}),
    jsx('div',{className:'iris-k-ladder',children:(mechanic.evidenceLadder||[]).map(row=>jsxs('div',{className:`iris-k-stage ${row.tone||'neutral'}`,children:[jsx('span',{children:row.label}),jsx('b',{children:String(row.status||'—').replaceAll('-',' ').toUpperCase()}),jsx('small',{children:row.detail||''})]},row.code))}),
  ]},mechanic.episode.id);
}

export function IrisKnowledge(){
  const [state,setState]=useState({loading:true,data:null,error:null});
  useEffect(()=>{
    let live=true;
    const encounter=window.__AVOID_WCL__?.encounter;
    if(!encounter?.id){setState({loading:false,data:null,error:'Waiting for the selected Warcraft Logs encounter scope.'});return()=>{live=false};}
    raidOpsClient.mechanicKnowledge({encounter:encounter.id,difficulty:encounter.difficulty||5}).then(payload=>{if(live)setState({loading:false,data:payload.result,error:null});}).catch(error=>{if(live)setState({loading:false,data:null,error:error?.message||String(error)});});
    return()=>{live=false};
  },[]);
  if(state.loading)return jsxs('div',{className:'iris-k-loading',children:[jsx('i',{}),jsx('b',{children:'IRIS IS RECONSTRUCTING BOSS KNOWLEDGE'}),jsx('span',{children:'Persisted evidence only'})]});
  if(state.error||!state.data)return jsxs('div',{className:'iris-k-empty',children:[jsx('b',{children:'IRIS KNOWLEDGE UNAVAILABLE'}),jsx('p',{children:state.error||'No persisted knowledge view is available.'}),jsx('small',{children:'No fallback data has been invented.'})]});
  const data=state.data,sources=data.sources||{};
  return jsxs('section',{className:'iris-mechanics-knowledge-source',children:[
    jsxs('div',{className:'iris-k-hero',children:[jsxs('div',{className:'iris-k-eyebrow',children:[jsx('span',{children:'IRIS / GLOBAL BOSS KNOWLEDGE'}),jsx('i',{children:'READ ONLY · 0 NETWORK'})]}),jsxs('div',{className:'iris-k-title',children:[jsxs('div',{children:[jsx('h2',{children:data.encounter?.name||'Encounter knowledge'}),jsx('p',{children:`WCL encounter ${data.scope.encounterId} · partition ${data.scope.partition}`})]}),jsx('b',{children:`${n(data.summary?.mechanicInvestigations)} INVESTIGATIONS`})]}),jsxs('div',{className:'iris-k-source-grid',children:[sourceCard('OFFICIAL SEMANTICS',sources.official,'official'),sourceCard('SPELL STRUCTURE',sources.structural,'structural'),sourceCard('PUBLIC WCL CORPUS',sources.corpus,'corpus')]})]}),
    jsxs('div',{className:'iris-k-section-head',children:[jsxs('div',{children:[jsx('small',{children:'MECHANIC INTELLIGENCE'}),jsx('h3',{children:'What Iris currently believes'})]}),jsx('p',{children:'Every state is reconstructed from persisted evidence. Provider metadata is context; observed combat remains Warcraft Logs.'})]}),
    jsx('div',{className:'iris-k-mechanics',children:(data.mechanics||[]).length?(data.mechanics||[]).map(mechanicCard):jsxs('div',{className:'iris-k-empty',children:[jsx('b',{children:'NO MECHANIC EPISODES YET'}),jsx('p',{children:'This encounter has not reached the Episode stage yet.'})]})}),
  ]});
}
