import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,symlink,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,extname,isAbsolute,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import ts from 'typescript';

// Transpile without bundling or rewriting import specifiers, then let bare Node
// resolve every emitted runtime edge exactly as it does in the deployment.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=await mkdtemp(join(tmpdir(),'bk-push-emitted-'));
const pending=['api/push.ts','api/push-delivery.ts'],emitted=new Set();
async function sourceFor(importer,specifier){
  const target=resolve(root,dirname(importer),specifier);
  assert.ok(relative(root,target)&&!relative(root,target).startsWith('..')&&!isAbsolute(relative(root,target)),'Runtime import must stay inside the project.');
  const candidates=/\.js$/.test(target)?[target.slice(0,-3)+'.ts',target]:extname(target)?[target]:[target+'.ts',target+'.js'];
  for(const candidate of candidates){try{await access(candidate);return relative(root,candidate);}catch{}}
  throw new Error(`Missing runtime source: ${importer} -> ${specifier}`);
}
try{
  await writeFile(join(output,'package.json'),JSON.stringify({type:'module'}));
  // Real installed packages use ordinary Node package resolution, without an ESM loader.
  await symlink(join(root,'node_modules'),join(output,'node_modules'),'dir');
  while(pending.length){
    const path=pending.shift();if(emitted.has(path))continue;emitted.add(path);
    const source=await readFile(join(root,path),'utf8');
    const result=ts.transpileModule(source,{fileName:path,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,isolatedModules:true,verbatimModuleSyntax:false},reportDiagnostics:true});
    assert.equal((result.diagnostics||[]).filter(item=>item.category===ts.DiagnosticCategory.Error).length,0,`Emission failed: ${path}`);
    const target=join(output,path.replace(/\.ts$/,'.js'));await mkdir(dirname(target),{recursive:true});await writeFile(target,result.outputText);
    const js=ts.createSourceFile(path,result.outputText,ts.ScriptTarget.ES2022,true,ts.ScriptKind.JS),imports=[];
    const visit=node=>{
      if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))imports.push(node.moduleSpecifier.text);
      if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword){assert.ok(node.arguments.length===1&&ts.isStringLiteral(node.arguments[0]),'Dynamic runtime imports must be discoverable.');imports.push(node.arguments[0].text);}
      ts.forEachChild(node,visit);
    };
    visit(js);
    for(const specifier of imports)if(specifier.startsWith('.'))pending.push(await sourceFor(path,specifier));
  }
  await writeFile(join(output,'smoke.mjs'),`
import assert from 'node:assert/strict';
import http from 'node:http';import https from 'node:https';import http2 from 'node:http2';import net from 'node:net';import tls from 'node:tls';import dns from 'node:dns';
import {syncBuiltinESMExports} from 'node:module';
assert.equal(process.execArgv.length,0,'Child must run without tsx, loaders or resolver flags.');
assert.equal(process.env.NODE_OPTIONS,undefined);
assert.equal(process.env.SUPABASE_SECRET_KEY,undefined);assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY,undefined);assert.equal(process.env.CRON_SECRET,undefined);assert.equal(process.env.VAPID_PRIVATE_KEY,undefined);assert.equal(process.env.APNS_PRIVATE_KEY,undefined);
let networkCalls=0;
const blocked=()=>{networkCalls++;throw new Error('Network access is forbidden in the emitted runtime smoke.');};
globalThis.fetch=blocked;
http.request=blocked;http.get=blocked;https.request=blocked;https.get=blocked;http2.connect=blocked;
net.connect=blocked;net.createConnection=blocked;net.Socket.prototype.connect=blocked;tls.connect=blocked;dns.lookup=blocked;dns.resolve=blocked;dns.promises.lookup=blocked;dns.promises.resolve=blocked;
syncBuiltinESMExports();
const push=await import('./api/push.js'),delivery=await import('./api/push-delivery.js');
async function invoke(handler,request){
  const result={statusCode:200,headers:{},body:null,ended:false};
  const response={setHeader:(key,value)=>{result.headers[key]=value;},status(code){result.statusCode=code;return this;},json(body){result.body=body;result.ended=true;return this;}};
  await handler({method:'GET',headers:{},query:{},...request},response);assert.equal(result.ended,true,'Handler must respond.');return result;
}
const config=await invoke(push.default,{query:{resource:'config'}});
assert.equal(config.statusCode,200);assert.deepEqual(config.body,{web:{ready:false,publicKey:null},apns:{ready:false},android:{ready:false}});
assert.match(config.headers['Cache-Control'],/no-store/);
const unconfigured=await invoke(push.default,{query:{resource:'settings'}});assert.equal(unconfigured.statusCode,503);
const guardOnly={auth:{getUser:blocked},rpc:blocked};
const protectedPush=push.createPushHandler({database:guardOnly});
assert.equal((await invoke(protectedPush,{query:{resource:'settings'}})).statusCode,401);
assert.equal((await invoke(protectedPush,{method:'POST',body:{action:'subscribe'}})).statusCode,401);
assert.equal((await invoke(delivery.default,{})).statusCode,401);
assert.equal((await invoke(delivery.createPushDeliveryHandler({secret:()=> 'synthetic-cron-secret',database:guardOnly}),{headers:{authorization:'Bearer wrong-secret'}})).statusCode,401);
assert.equal(networkCalls,0,'Startup and unauthorized calls must not contact providers or the database.');
console.log(JSON.stringify({ok:true,node:process.versions.node,config:200,unconfigured:503,unauthenticatedApi:401,unauthenticatedCron:401,networkCalls}));
`);
  const child=spawnSync(process.execPath,[join(output,'smoke.mjs')],{cwd:output,env:{NODE_ENV:'test',TZ:'UTC'},encoding:'utf8',timeout:20_000});
  assert.equal(child.status,0,`Emitted push runtime failed under native Node resolution:\n${child.stderr||child.stdout||child.error?.message||''}`);
  const receipt=JSON.parse(child.stdout.trim());assert.equal(receipt.ok,true);
  console.log(`Push emitted-JS startup passed on Node ${receipt.node}: ${emitted.size} modules; public config 200; unauthorized API/cron 401; no server secrets or network calls.`);
}finally{await rm(output,{recursive:true,force:true});}
