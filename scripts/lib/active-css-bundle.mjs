import { readFile } from 'node:fs/promises';
import { ACTIVE_STYLES } from '../../config/active-assets.mjs';

const root=new URL('../../',import.meta.url);
export const ACTIVE_CSS_BUNDLE_OUTPUT='public/raidops-active.css';
export const ACTIVE_CSS_SOURCE_LAYERS=Object.freeze(ACTIVE_STYLES.filter(asset=>asset.authority==='overlay'));

const cleanLocal=src=>src.split('?')[0];
const fileUrl=src=>new URL(`public${cleanLocal(src)}`,root);

export async function compileActiveCssBundle(){
  if(ACTIVE_CSS_SOURCE_LAYERS.length!==17)throw new Error(`Expected 17 additive CSS source layers, got ${ACTIVE_CSS_SOURCE_LAYERS.length}`);
  const parts=['/* GENERATED FILE — exact ordered compatibility cascade. DO NOT EDIT. */\n'];
  for(const layer of ACTIVE_CSS_SOURCE_LAYERS){
    const source=await readFile(fileUrl(layer.src),'utf8');
    const unsafe=source.match(/@(charset|import|namespace)\b/i);
    if(unsafe)throw new Error(`${layer.src} contains ${unsafe[0]}, which cannot be concatenated without a separate CSS semantics review`);
    parts.push(source);
    if(!source.endsWith('\n'))parts.push('\n');
    parts.push('\n');
  }
  return parts.join('');
}

export function activeCssSourcePaths(){
  return ACTIVE_CSS_SOURCE_LAYERS.map(layer=>cleanLocal(layer.src));
}
