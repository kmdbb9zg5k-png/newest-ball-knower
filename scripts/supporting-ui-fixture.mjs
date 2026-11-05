import { build } from 'esbuild';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
export const supportingOut = 'artifacts/supporting-ui';
export async function prepareSupportingFixture() {
  await rm(supportingOut, { recursive: true, force: true });
  await mkdir(supportingOut, { recursive: true });
  const styles = [...(await readFile('dist/index.html', 'utf8')).matchAll(/<link[^>]+rel="stylesheet"[^>]+href="(\/assets\/[^"]+\.css)"/g)].map(match => `<link rel="stylesheet" href="/dist${match[1]}">`).join('');
  const fixture = `import React,{lazy,Suspense} from 'react';import {createRoot} from 'react-dom/client';import {ModeHelp} from './ModeHelp';
  const AskBkHub=lazy(()=>import('./AskBkHub').then(module=>({default:module.AskBkHub})));
  const params=new URLSearchParams(location.search);
  if(params.has('shortDeadline')){const timeout=window.setTimeout.bind(window);window.setTimeout=(fn,ms,...args)=>timeout(fn,ms===60000?80:ms,...args)}
  const release=()=>{window.qaAuthReleased=true;for(const resolve of window.qaAuthWaiters||[])resolve();window.qaAuthWaiters=[]};
  createRoot(document.getElementById('root')).render(<React.StrictMode><main>{params.get('mode')==='ask'?<Suspense fallback={<p role="status">Loading Ask BK fixture…</p>}><button onClick={release}>Release authentication</button><AskBkHub/></Suspense>:<><h1>Mode instructions test</h1><ModeHelp mode="gm"/><button>Outside help</button></>}</main></React.StrictMode>);`;
  // Match the app's split module graph. Inlining every optional syntax grammar
  // and Mermaid renderer made the help-only page parse a 19 MB module in WebKit.
  // Development React and StrictMode remain enabled for the lifecycle checks.
  const result = await build({
    stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx', sourcefile: 'fixture.tsx' }, bundle: true, format: 'esm', outdir: supportingOut, entryNames: 'fixture', chunkNames: 'chunks/[name]-[hash]', splitting: true, minify: true, metafile: true, jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': '{}' },
    loader: { '.png': 'dataurl', '.webp': 'dataurl', '.jpg': 'dataurl', '.svg': 'dataurl' },
    plugins: [{ name: 'fixture-adapters', setup(builder) {
      builder.onResolve({filter:/^\.\/BallKnowerContext$/}, () => ({path:'context', namespace:'supporting-fixture'}));
      builder.onResolve({filter:/^\.\/supabase$/}, () => ({path:'session', namespace:'supporting-fixture'}));
      builder.onLoad({filter:/.*/, namespace:'supporting-fixture'}, args => ({contents:args.path==='context'
        ? `export const useBallKnower=()=>({activeLeague:null,currentUser:{id:'qa-user',name:'QA Manager'}});`
        : `export async function ensureOnlineSession(){if(new URLSearchParams(location.search).has('slowAuth')&&!window.qaAuthReleased)await new Promise(resolve=>{(window.qaAuthWaiters??=[]).push(resolve)});return {userId:'qa-user'}};export const supabase={auth:{getSession:async()=>({data:{session:{access_token:'fixture-only'}}})}};`, loader:'js'}));
      builder.onResolve({filter:/^\./}, args => {for(const ext of ['.ts','.tsx']){const path=resolve(args.resolveDir,args.path+ext);if(existsSync(path))return{path}}});
    }}], logLevel: 'error',
  });
  await writeFile(`${supportingOut}/bundle-meta.json`, JSON.stringify(result.metafile, null, 2));
  const initial = new Set();
  const visit = output => {
    if (initial.has(output)) return;
    initial.add(output);
    for (const item of result.metafile.outputs[output]?.imports || []) {
      if (!item.external && item.kind !== 'dynamic-import') visit(item.path);
    }
  };
  visit(`${supportingOut}/fixture.js`);
  const initialBytes = [...initial].reduce((total, output) => total + (result.metafile.outputs[output]?.bytes || 0), 0);
  if (initialBytes > 1_000_000) throw Error(`Supporting fixture eagerly loads ${initialBytes} bytes; optional Ask renderers must stay deferred.`);
  console.log(`Supporting fixture: ${initialBytes} initial JS bytes; optional renderers use separate modules.`);
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<link rel="stylesheet" href="/${supportingOut}/fixture.css"><style>body{margin:0;background:#080d15;color:#f6f5ed}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="/${supportingOut}/fixture.js"></script></body></html>`;
  await writeFile(`${supportingOut}/index.html`, html);
  return html;
}
if(process.argv[1]?.endsWith('supporting-ui-fixture.mjs'))await prepareSupportingFixture();
