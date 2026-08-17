import {
  ACTIVE_STYLES,
  ACTIVE_EXTERNAL_SCRIPTS,
  ACTIVE_LOCAL_SCRIPTS,
} from '../../config/active-assets.mjs';

export const ACTIVE_ASSET_HTML_MARKERS=Object.freeze({
  styles:['<!-- ACTIVE_STYLES:START -->','<!-- ACTIVE_STYLES:END -->'],
  externalScripts:['<!-- ACTIVE_EXTERNAL_SCRIPTS:START -->','<!-- ACTIVE_EXTERNAL_SCRIPTS:END -->'],
  localScripts:['<!-- ACTIVE_LOCAL_SCRIPTS:START -->','<!-- ACTIVE_LOCAL_SCRIPTS:END -->'],
});

const indent=(lines,prefix)=>lines.map(line=>`${prefix}${line}`).join('\n');
const styleTag=asset=>`<link rel="stylesheet" href="${asset.src}" />`;
const scriptTag=asset=>`<script src="${asset.src}" defer></script>`;

export function renderActiveAssetHtmlBlocks(){
  return Object.freeze({
    styles:indent(ACTIVE_STYLES.map(styleTag),'    '),
    externalScripts:indent(ACTIVE_EXTERNAL_SCRIPTS.map(scriptTag),'    '),
    localScripts:indent(ACTIVE_LOCAL_SCRIPTS.map(scriptTag),'    '),
  });
}

export function replaceMarkedBlock(source,[start,end],content){
  const startIndex=source.indexOf(start);
  const endIndex=source.indexOf(end);
  if(startIndex<0||endIndex<0||endIndex<startIndex)throw new Error(`Missing or invalid active asset markers: ${start} ... ${end}`);
  const contentStart=startIndex+start.length;
  return `${source.slice(0,contentStart)}\n${content}\n${source.slice(endIndex)}`;
}

export function synchronizeActiveAssetHtml(source){
  const blocks=renderActiveAssetHtmlBlocks();
  let next=source;
  next=replaceMarkedBlock(next,ACTIVE_ASSET_HTML_MARKERS.styles,blocks.styles);
  next=replaceMarkedBlock(next,ACTIVE_ASSET_HTML_MARKERS.externalScripts,blocks.externalScripts);
  next=replaceMarkedBlock(next,ACTIVE_ASSET_HTML_MARKERS.localScripts,blocks.localScripts);
  return next;
}
