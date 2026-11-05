import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {createRequestGate} from '../communityState';

// Run the actual hook with controlled promises. A tiny hook host keeps this
// lifecycle regression independent of a browser or a live community account.
const source=ts.transpileModule(readFileSync(new URL('../useCommunityResource.ts',import.meta.url),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
function host(fetcher:()=>Promise<string>){
  const slots:any[]=[];let cursor=0;let effect:(()=>void|(()=>void))|undefined;
  let cleanup:void|(()=>void);let rendered=false;
  const react={
    useRef(value:unknown){const index=cursor++;return slots[index]??(slots[index]={current:value});},
    useState(value:unknown){const index=cursor++;if(!(index in slots))slots[index]=value;return[slots[index],(next:unknown)=>{slots[index]=next;}];},
    useCallback(callback:unknown){const index=cursor++;return slots[index]??(slots[index]=callback);},
    useEffect(callback:()=>void|(()=>void)){if(!rendered)effect=callback;},
  };
  const mod={exports:{} as any};
  runInNewContext(source,{exports:mod.exports,module:mod,require:(name:string)=>name==='react'?react:{createRequestGate}});
  const render=()=>{cursor=0;const result=mod.exports.useCommunityResource(fetcher);rendered=true;return result;};
  return {render,mount(){render();cleanup=effect?.();},unmount(){if(typeof cleanup==='function')cleanup();}};
}
function deferred(){let resolve!:(v:string)=>void,reject!:(e:Error)=>void;const promise=new Promise<string>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};

const first=deferred(),second=deferred(),third=deferred();
const responses=[first,second,third];let requests=0;
const resource=host(()=>responses[requests++].promise);resource.mount();
assert.equal(requests,1);
assert.equal(resource.render().refreshing,true,'Initial request exposes busy state');
const forcedA=resource.render().refresh(true),forcedB=resource.render().refresh(true);
first.resolve('initial');await flush();
assert.equal(requests,2,'Concurrent forced refreshes must not run reads in parallel');
assert.equal(resource.render().data,'initial');
second.resolve('after mutation');await flush();
assert.equal(requests,3,'The queued mutation read runs after the previous read');
third.resolve('latest');await Promise.all([forcedA,forcedB]);await flush();
assert.equal(resource.render().data,'latest');
assert.equal(resource.render().loading,false);
assert.equal(resource.render().refreshing,false);
resource.unmount();

const delayed=deferred();let abandonedRequests=0;
const abandoned=host(()=>{abandonedRequests++;return delayed.promise;});abandoned.mount();
const queued=abandoned.render().refresh(true);abandoned.unmount();delayed.resolve('old account');await queued;await flush();
assert.equal(abandonedRequests,1,'A queued refresh must not start after unmount/account switch');
assert.equal(abandoned.render().data,null,'An old account result must not enter state');

const initial=deferred(),failure=deferred();let retryRequests=0;
const retry=host(()=>[initial,failure][retryRequests++].promise);retry.mount();initial.resolve('cached');await flush();
const failed=retry.render().refresh();assert.equal(retry.render().refreshing,true,'Refresh stays visible without clearing content');
failure.reject(new Error('Connection interrupted'));await failed;await flush();
assert.equal(retry.render().data,'cached','Failed refresh preserves useful cached data');
assert.equal(retry.render().refreshing,false,'Failed refresh releases busy state');
assert.ok(retry.render().error,'Failed refresh presents a retryable error');retry.unmount();
console.log('Community resource lifecycle passed: serialized mutation reads, unmount cancellation, stale-response protection and retry state.');
