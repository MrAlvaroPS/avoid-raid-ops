import { ACTIVE_STYLES, ACTIVE_EXTERNAL_SCRIPTS, ACTIVE_LOCAL_SCRIPTS } from '../../config/active-assets.mjs';

export const ACTIVE_ASSET_HTML_MARKERS=Object.freeze({
  styles:Object.freeze(['<!-- AVOID:ACTIVE-STYLES:START -->','<!-- AVOID:ACTIVE-STYLES:END -->']),
  externalScripts:Object.freeze(['<!-- AVOID:ACTIVE-EXTERNAL-SCRIPTS:START -->','<!-- AVOID:ACTIVE-EXTERNAL-SCRIPTS:END -->']),
  localScripts:Object.freeze(['<!-- AVOID:ACTIVE-LOCAL-SCRIPTS:START -->','<!-- AVOID:ACTIVE-LOCAL-SCRIPTS:END -->']),
});

const htmlAttr=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;');
const stylesheetLine=asset=>`<link rel="stylesheet" href="${htmlAttr(asset.src)}" />`;
const scriptLine=asset=>`<script src="${htmlAttr(asset.src)}" defer></script>`;

export function renderActiveAssetBlocks(){
  return Object.freeze({
    styles:ACTIVE_STYLES.map(stylesheetLine),
    externalScripts:ACTIVE_EXTERNAL_SCRIPTS.map(scriptLine),
    localScripts:ACTIVE_LOCAL_SCRIPTS.map(scriptLine),
  });
}

function markerCount(source,marker){return source.split(marker).length-1;}

function replaceMarkedBlock(source,[startMarker,endMarker],lines,label){
  if(markerCount(source,startMarker)!==1||markerCount(source,endMarker)!==1)throw new Error(`${label} asset markers must exist exactly once`);
  const startIndex=source.indexOf(startMarker),endIndex=source.indexOf(endMarker);
  if(endIndex<=startIndex)throw new Error(`${label} asset markers are out of order`);
  const startLineEnd=source.indexOf('\n',startIndex+startMarker.length);
  if(startLineEnd<0)throw new Error(`${label} start marker must occupy its own line`);
  const endLineStart=source.lastIndexOf('\n',endIndex)+1;
  const startLineStart=source.lastIndexOf('\n',startIndex)+1;
  const indent=source.slice(startLineStart,startIndex);
  if(!/^\s*$/.test(indent))throw new Error(`${label} start marker must be preceded only by indentation`);
  const endIndent=source.slice(endLineStart,endIndex);
  if(endIndent!==indent)throw new Error(`${label} marker indentation must match`);
  const body=lines.map(line=>`${indent}${line}`).join('\n');
  return `${source.slice(0,startLineEnd+1)}${body}${body?'\n':''}${source.slice(endLineStart)}`;
}

export function synchronizeActiveAssetHtml(source){
  const blocks=renderActiveAssetBlocks();
  let next=String(source);
  next=replaceMarkedBlock(next,ACTIVE_ASSET_HTML_MARKERS.styles,blocks.styles,'styles');
  next=replaceMarkedBlock(next,ACTIVE_ASSET_HTML_MARKERS.externalScripts,blocks.externalScripts,'external scripts');
  next=replaceMarkedBlock(next,ACTIVE_ASSET_HTML_MARKERS.localScripts,blocks.localScripts,'local scripts');
  return next;
}
