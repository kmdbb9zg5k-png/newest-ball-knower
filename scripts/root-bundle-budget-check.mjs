import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const distDir=path.resolve(process.cwd(),'dist');
const indexPath=path.join(distDir,'index.html');
const RAW_LIMIT=700_000;
const GZIP_LIMIT=210_000;

if(!fs.existsSync(indexPath)){
  console.error('Bundle budget check requires a production build. Run npm run build first.');
  process.exit(1);
}

const html=fs.readFileSync(indexPath,'utf8');
const scriptMatches=[...html.matchAll(/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+\.js)["'][^>]*>/gi)];
if(scriptMatches.length!==1){
  console.error(`Expected exactly one initial module entry in dist/index.html, found ${scriptMatches.length}.`);
  process.exit(1);
}

const src=scriptMatches[0][1];
const relative=src.replace(/^\/+/, '');
const entryPath=path.join(distDir,relative);
if(!fs.existsSync(entryPath)){
  console.error(`Initial JavaScript entry does not exist: ${entryPath}`);
  process.exit(1);
}

const source=fs.readFileSync(entryPath);
const rawBytes=source.byteLength;
const gzipBytes=gzipSync(source,{level:9}).byteLength;
const kb=value=>(value/1000).toFixed(2);

console.log(JSON.stringify({
  entry:src,
  rawBytes,
  rawKB:Number(kb(rawBytes)),
  gzipBytes,
  gzipKB:Number(kb(gzipBytes)),
  limits:{rawBytes:RAW_LIMIT,gzipBytes:GZIP_LIMIT},
},null,2));

const failures=[];
if(rawBytes>RAW_LIMIT) failures.push(`raw entry ${kb(rawBytes)} kB exceeds ${kb(RAW_LIMIT)} kB`);
if(gzipBytes>GZIP_LIMIT) failures.push(`gzip entry ${kb(gzipBytes)} kB exceeds ${kb(GZIP_LIMIT)} kB`);
if(failures.length){
  console.error(`Initial bundle budget failed: ${failures.join('; ')}.`);
  console.error('Move optional features/data behind real dynamic imports instead of raising this budget without review.');
  process.exit(1);
}

console.log(`Initial bundle budget passed: ${kb(rawBytes)} kB raw / ${kb(gzipBytes)} kB gzip.`);