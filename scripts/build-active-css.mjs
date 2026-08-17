import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ACTIVE_CSS_BUNDLE_OUTPUT, activeCssSourcePaths, compileActiveCssBundle } from './lib/active-css-bundle.mjs';

const root=new URL('../',import.meta.url);
const css=await compileActiveCssBundle();
const target=new URL(ACTIVE_CSS_BUNDLE_OUTPUT,root);
await mkdir(new URL('public/',root),{recursive:true});
await writeFile(target,css,'utf8');
const hash=createHash('sha256').update(css).digest('hex');
console.log(`ACTIVE CSS BUILD: ${ACTIVE_CSS_BUNDLE_OUTPUT}`);
console.log(` - ${activeCssSourcePaths().length} ordered overlay sources`);
console.log(` - ${Buffer.byteLength(css)} bytes · sha256 ${hash}`);
