import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createGameplayReplayRecorder} from '../public/play-moment-3d/replay.js';

let simTime=0;
const players=Array.from({length:22},(_,index)=>({
  x:index-11,z:25+index*.4,vx:0,vz:0,action:'idle',engagedWith:-1,
  hasBall:index===6,fallen:false,
}));
const state={
  get simTime(){return simTime},phase:'pre',mode:'run',selected:0,
  drive:{down:1,ball:25,toGo:10,clock:78},input:{x:0,z:0,sprint:false},
  assist:false,defense:'over-front',carrierIndex:6,lastSkill:'',players,
};
const replay=createGameplayReplayRecorder(()=>state,{
  environment:()=>({viewport:[932,430],pixelRatio:3}),
});

replay.event('snap',{mode:'run',play:'inside-zone'});
state.phase='run';
for(let frame=0;frame<24;frame+=1){
  simTime+=.25;
  state.input.z=.9;
  state.input.sprint=frame>8;
  players[6].z+=.55;
  players[6].vz=5.4;
  if(frame===10){players[7].engagedWith=16;replay.event('skill',{kind:'juke'})}
  replay.sample();
}

const payload=replay.payload('  Mike won every run fit.\u0000  ');
assert.match(payload.id,/^bk_[a-z0-9]{6,20}_[a-f0-9]{12}$/);
assert.equal(payload.privacy,'gameplay-state-only');
assert.equal(payload.graphics,'high');
assert.deepEqual(payload.viewport,[932,430]);
assert.equal(payload.note,'Mike won every run fit.');
assert.ok(payload.samples.length>=24&&payload.samples.length<=720);
assert.ok(payload.events.length===2&&payload.events.length<=400);
assert.equal(payload.samples.at(-1).p.length,22);
for(const forbidden of ['userAgent','account','email','location','screen','camera','microphone','clipboard']){
  assert.equal(Object.hasOwn(payload,forbidden),false,forbidden);
}
assert.ok(Buffer.byteLength(JSON.stringify(payload))<1_250_000);

let request;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
  request={url,options,body:JSON.parse(options.body)};
  return new Response(JSON.stringify({id:payload.id,reviewUrl:`/api/gameplay-report?id=${payload.id}`}),{
    status:201,headers:{'Content-Type':'application/json'},
  });
};
try{
  const sent=await replay.submit('Mike won every run fit.');
  assert.equal(request.url,'/api/gameplay-report');
  assert.equal(request.options.method,'POST');
  assert.equal(request.body.privacy,'gameplay-state-only');
  assert.equal(sent.id,payload.id);
}finally{globalThis.fetch=originalFetch}

const [api,html,css]=await Promise.all([
  readFile(new URL('../api/gameplay-report.ts',import.meta.url),'utf8'),
  readFile(new URL('../public/play-moment-3d-preview.html',import.meta.url),'utf8'),
  readFile(new URL('../public/play-moment-3d/hud.css',import.meta.url),'utf8'),
]);
for(const contract of ['MAX_BODY_BYTES=1_250_000','MAX_SAMPLES=720','MAX_EVENTS=400','isCrossSiteBrowserRequest','consumeRateLimit','sanitizeGameplayReport','gameplay-reports/','gameplay-report-saved'])assert.ok(api.includes(contract),contract);
for(const contract of ['QA_ORIGINS','Access-Control-Allow-Origin','OPTIONS'])assert.ok(api.includes(contract),contract);
for(const control of ['id="reportNote"','id="sendReport"','id="reportStatus"','id="reportReceipt"','id="reportCode"','id="copyReportCode"'])assert.ok(html.includes(control),control);
assert.ok(css.includes('.gameplay-report'));
assert.ok(css.includes('touch-action:none'));
assert.ok(html.includes('maximum-scale=1,user-scalable=no'));
console.log('PASS optional gameplay report: bounded replay, explicit submit, privacy exclusions and server guards');
