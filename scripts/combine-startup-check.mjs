import assert from 'node:assert/strict';
import {createDrillRenderer,releaseDrillRenderer,combineStartupError,combineStartupMessage} from '../combine/startup.js';
const calls=[];let failedContextsReleased=0;
globalThis.document={createElement(){return{getContext(){return{getExtension(){return{loseContext(){failedContextsReleased++;}};}};},remove(){}};}};
class Renderer {constructor(options){calls.push(options);if(options.antialias)throw Error('GPU configuration unavailable');this.options=options;}}
const renderer=createDrillRenderer(Renderer,{alpha:true,powerPreference:'low-power'});
assert.equal(calls.length,2);assert.equal(failedContextsReleased,1);assert.equal(calls[0].powerPreference,'low-power');assert.equal(renderer.options.antialias,false);assert.equal(renderer.options.alpha,true);assert.equal(renderer.options.powerPreference,'default');
assert.throws(()=>createDrillRenderer(class{constructor(){throw Error('No GPU');}}),error=>error.cause.message==='No GPU');
const cleanup=[];
releaseDrillRenderer({dispose(){cleanup.push('dispose');},forceContextLoss(){cleanup.push('release');},domElement:{remove(){cleanup.push('remove');}}});
assert.deepEqual(cleanup,['dispose','release','remove']);
cleanup.length=0;
assert.throws(()=>releaseDrillRenderer({dispose(){throw Error('dispose failed');},forceContextLoss(){cleanup.push('release');},domElement:{remove(){cleanup.push('remove');}}}));
assert.deepEqual(cleanup,['release','remove']);
const original=Error('the underlying reason'),wrapped=combineStartupError(original,'graphics');assert.equal(wrapped.cause,original);assert.equal(combineStartupError(wrapped,'module'),wrapped);
const logs=[],log=console.error;console.error=(...args)=>logs.push(args);
try{assert.match(combineStartupMessage(wrapped),/BK-GRAPHICS/);assert.match(combineStartupMessage(combineStartupError(original,'athlete')),/BK-ATHLETE/);assert.match(combineStartupMessage(original),/BK-LOAD/);assert.equal(logs[0][1].cause,original);}finally{console.error=log;}
console.log('PASS preferred/fallback renderer, explicit context release, cleanup after failure and original diagnostic causes');
