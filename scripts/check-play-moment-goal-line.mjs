/** Execute actual goal-line helpers and endPlay logic with isolated state.
 * This is a state/unit test, not a mocked-renderer or physical-device pass.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/play-moment-3d/game.js',import.meta.url),'utf8');
function between(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,`Missing boundary: ${start}`);return source.slice(a,b);}
const helperSource=between('export function lineToGain','export function cameraWorldVector').replaceAll('export ','');
const {lineToGain,downDistanceLabel}=Function(helperSource+';return {lineToGain,downDistanceLabel};')();
const cases=[
 [{ball:85,down:1,toGo:10},'1ST & 10',95],
 [{ball:98,down:1,toGo:2},'1ST & GOAL',100],
 [{ball:92,down:2,toGo:8},'2ND & GOAL',100],
 [{ball:86,down:3,toGo:14},'3RD & GOAL',100],
 [{ball:93,down:4,toGo:7},'4TH & GOAL',100],
 [{ball:93,down:3,toGo:2},'3RD & 2',95],
 [{ball:90,down:1,toGo:10},'1ST & GOAL',100],
 [{ball:89,down:1,toGo:10},'1ST & 10',99],
 [{ball:44,down:2,toGo:16},'2ND & 16',60]
];
for(const [drive,label,target]of cases){const copy=structuredClone(drive);assert.equal(downDistanceLabel(drive),label);assert.equal(lineToGain(drive),target);assert.deepEqual(drive,copy);}
let seriesSamples=0;
for(let start=1;start<100;start++){
 const target=Math.min(100,start+10);
 for(let ball=Math.max(1,start-18);ball<target;ball++)for(let down=1;down<=4;down++){
  const drive={ball,down,toGo:target-ball};
  assert.equal(lineToGain(drive),target);
  assert.equal(downDistanceLabel(drive).includes('GOAL'),target===100);
  seriesSamples++;
 }
}
const endSource=between(' function endPlay(', ' function endDrive(');
function fixture(initial){
 const create=Function('initial','lineToGain',`
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 let drive={clock:63,score:24,plays:1,...initial},phase='run',ended=false,flight=null;
 let input={x:1,z:1,sprint:true},keys=new Set(['w']),recoveryLeft=0;
 let carrier={fallen:false,moving:true,engaged:false},actors=[carrier],messages=[],ending=null;
 const message=t=>messages.push(t),updateHud=()=>{},updateControls=()=>{};
 const endDrive=title=>{ending=title;ended=true;phase='dead';};
 ${endSource}
 return{end:endPlay,state:()=>({drive,phase,ended,recoveryLeft,carrier,messages,ending,input,keys:[...keys]})};
 `);
 return create(initial,lineToGain);
}
let f=fixture({ball:85,down:1,toGo:10});f.end('TACKLED',98);let d=f.state();
assert.equal(downDistanceLabel(d.drive),'1ST & GOAL');assert.equal(d.drive.score,24);assert.equal(d.carrier.fallen,true);
assert.equal(d.messages.at(-1),'FIRST & GOAL · +13 YDS');assert.equal(d.recoveryLeft,1.2);
const settled=structuredClone(d);f.end('TACKLED',99);assert.deepEqual(f.state(),settled,'Duplicate finish changed the result');
f=fixture({ball:98,down:1,toGo:2});f.end('SACK',92);assert.equal(downDistanceLabel(f.state().drive),'2ND & GOAL');
f=fixture({ball:92,down:2,toGo:8});f.end('SACK',86);assert.equal(downDistanceLabel(f.state().drive),'3RD & GOAL');
f=fixture({ball:86,down:3,toGo:14});f.end('TACKLED',93);assert.equal(downDistanceLabel(f.state().drive),'4TH & GOAL');
f=fixture({ball:93,down:4,toGo:7});f.end('INCOMPLETE',99,true);assert.equal(f.state().drive.ball,93);assert.equal(f.state().ending,'TURNOVER ON DOWNS');
f=fixture({ball:25,down:2,toGo:10});f.end('OUT OF BOUNDS',38);assert.equal(f.state().messages.at(-1),'FIRST DOWN · +13 YDS');
f=fixture({ball:98,down:1,toGo:2});f.end('TOUCHDOWN',100);assert.equal(f.state().drive.score,30);f.end('TOUCHDOWN',100);assert.equal(f.state().drive.score,30);
console.log(JSON.stringify({status:'PASS',explicitLabels:cases.length,seriesSamples,endPlayCases:7,duplicateFinishCases:2}));
