import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {drillMovementKey,drillMovement} from '../combine/drill-input.js';

class FocusedControl{closest(){return true}}
const event=(key,code='',target=null)=>({key,code,target,preventDefault(){},repeat:false});
for(const drill of ['RB','Route','DB']){
 // Exercise the actual registered handler, with DOM/input I/O isolated.
 const source=await readFile(new URL(`../combine/${drill}Experience.tsx`,import.meta.url),'utf8');
 const handler=source.slice(source.indexOf('const key='),source.indexOf('const kd=')).replaceAll(':KeyboardEvent','').replaceAll(':boolean','').replaceAll(' as any','');
 const keys={current:new Set()},input={current:{x:0,y:0}},moves=[];
 const key=new Function('drillMovementKey','drillMovement','Element','keys','input','playMove',handler+'return key;')(drillMovementKey,drillMovement,FocusedControl,keys,input,move=>moves.push(move));
 for(const [letter,direction]of [['W',{x:0,y:-1}],['A',{x:-1,y:0}],['S',{x:0,y:1}],['D',{x:1,y:0}]]){
  key(event(letter,'Key'+letter),true);assert.deepEqual(input.current,direction,`${drill}: Shift/Caps Lock must preserve ${letter}`);
  key(event(letter.toLowerCase(),'Key'+letter),false);assert.deepEqual(input.current,{x:0,y:0},`${drill}: releasing Shift before the letter must stop movement`);
  key(event(letter),true);assert.deepEqual(input.current,direction,`${drill}: events without a code remain usable`);
  key(event(letter.toLowerCase()),false);
 }
 key(event('ArrowUp'),true);key(event('ArrowRight'),true);assert.deepEqual(input.current,{x:1,y:-1});
 key(event('ArrowUp','',new FocusedControl()),false);key(event('ArrowRight','',new FocusedControl()),false);
 assert.deepEqual(input.current,{x:0,y:0},`${drill}: focus changes must not swallow held-key releases`);assert.equal(keys.current.size,0);
 key(event('W','KeyW',new FocusedControl()),true);assert.equal(keys.current.size,0,'Editing a control must not steer the athlete');
 if(drill==='RB'){key(event('J','KeyJ'),true);assert.deepEqual(moves,['juke']);}
}
console.log('PASS RB/WR/DB keyboard controls: Shift, Caps Lock, modifier changes before release, synthetic key fallback, diagonal movement, releases after focus changes and RB actions');
