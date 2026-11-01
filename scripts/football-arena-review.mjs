// Record the shipped kickoff return through both deterministic and real-time loops.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const out='artifacts/football-arena-motion';
await mkdir(out,{recursive:true});
const child=spawn(process.execPath,['scripts/play-game-review.mjs'],{env:{...process.env,PORT:'3061',OUT:out},stdio:['pipe','pipe','inherit']});
let output='';child.stdout.on('data',chunk=>{output+=chunk;process.stdout.write(chunk);});
try{
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Review harness did not start')),30000);const check=()=>{if(output.includes('Gameplay review')){clearTimeout(timeout);child.stdout.off('data',check);resolve();}};child.stdout.on('data',check);child.once('exit',code=>{clearTimeout(timeout);reject(Error('Review harness exited '+code));});check();});
 const command=async data=>{const response=await fetch('http://127.0.0.1:3061/review',{method:'POST',body:JSON.stringify(data)});const result=await response.json();assert(response.ok&&!result.error,JSON.stringify(result));return result;};
 await command({action:'load',mode:'arena'});
 const deterministic=await command({action:'record',label:'kickoff-deterministic',seconds:25,fps:10});
 assert(deterministic.frames>15,'Kickoff has a recorded sequence');
 const record=JSON.parse(await readFile(`${out}/kickoff-deterministic/frames.json`,'utf8'));
 assert.deepEqual(record.errors,[]);
 assert(record.frames.every(frame=>frame.athletes.asset.endsWith('/reference-helmeted-athlete-v1.glb')),'Actual helmeted reference rig renders the arena return');
 assert(record.frames.some(frame=>frame.unit),'Live kickoff unit appears');
 assert(record.frames.some(frame=>!frame.unit&&frame.playbook.open),'Kickoff reaches the next offensive playbook');
 await command({action:'load',mode:'arena'});
 const realtime=await command({action:'realtime',label:'kickoff-realtime',seconds:20});
 assert(realtime.capturedFrames>0&&realtime.renderedFrames>0,'Real requestAnimationFrame loop rendered the kickoff');
 assert.deepEqual(realtime.state.errors,[]);
 await writeFile(`${out}/summary.json`,JSON.stringify({deterministic,realtime,limitation:'Software-rendered CI footage does not certify physical iPhone frame rate.'},null,2));
 console.log('PASS arena kickoff deterministic transition and real-time recording');
}finally{child.stdin.end();child.kill('SIGINT');}
