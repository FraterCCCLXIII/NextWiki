// three-node-resolver.mjs -- lets node import the model modules, which use the browser import map's
// bare specifiers ('three', 'three/addons/...'). Register it from a test with:
//   import { register } from 'node:module';
//   register('./three-node-resolver.mjs', import.meta.url);
// then dynamic-import anything that imports three. The vendored build is gitignored, so a test that
// needs it should skip with a clear message when it is absent (see hasThree()).

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = new URL('.', import.meta.url);
const THREE_BUILD = new URL('./vendor/three-0.160.0/build/three.module.js', here);
const THREE_ADDONS = new URL('./vendor/three-0.160.0/examples/jsm/', here);

export function hasThree() { return existsSync(fileURLToPath(THREE_BUILD)); }

export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: THREE_BUILD.href, shortCircuit: true };
  if (specifier.startsWith('three/addons/')) return { url: new URL(specifier.slice('three/addons/'.length), THREE_ADDONS).href, shortCircuit: true };
  return next(specifier, context);
}
