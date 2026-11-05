import assert from 'node:assert/strict';
import {showGameFailure} from '../public/play-moment-3d/game-failure.js';

for(const stage of ['runtime','graphics']) {
 const nodes=new Map();let focused=false;
 for(const id of ['loading','hud','paused','rotate','error','errorTitle','errorText','retryGame']) {
  nodes.set(id,{hidden:id==='error',textContent:'',attributes:{},setAttribute(name,value){this.attributes[name]=value;},focus(){focused=true;}});
 }
 showGameFailure({getElementById:id=>nodes.get(id)},stage);
 assert.equal(nodes.get('error').hidden,false);
 assert.equal(nodes.get('error').attributes['data-failure'],stage);
 assert.match(nodes.get('errorText').textContent,/Retry/);
 for(const id of ['loading','hud','paused','rotate'])assert.equal(nodes.get(id).hidden,true,`${id} must not cover recovery`);
 assert.equal(focused,true,'Recovery must receive keyboard focus');
}
// A partial loading document still exposes all recovery elements it has.
assert.doesNotThrow(()=>showGameFailure({getElementById:()=>null}));
console.log('PASS actionable runtime/context-loss recovery, portrait/loading overlay dismissal, keyboard focus and partial DOM safety');
