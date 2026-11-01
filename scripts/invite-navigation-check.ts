import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {completeInviteJoin,watchInviteInteraction} from '../inviteNavigation';
for(const scenario of ['home','navigated','away-and-back','unmounted','failed','pointerdown','keydown','click'] as const){
 let generation=0,mounted=true,tab='home',activeLeague='existing-draft',joins=0;
 let resolve!:(value:{success:boolean;league:{id:string}})=>void;
 const pending=new Promise<{success:boolean;league:{id:string}}>(done=>resolve=done);
 const startedAt=generation;
 const target=new EventTarget(),interaction=watchInviteInteraction(target);
 const task=completeInviteJoin({code:'INVITE',join:async(code,options)=>{assert.equal(code,'INVITE');assert.equal(options.activate,false,'joining must not select a league before the navigation guard');joins++;return pending;},isCurrent:()=>mounted&&interaction.isUntouched()&&tab==='home'&&generation===startedAt,onReady:league=>{activeLeague=league.id;tab='lobby';}});
 if(scenario==='navigated'){generation++;tab='solo';}
 if(scenario==='away-and-back'){generation+=2;}
 if(scenario==='unmounted')mounted=false;
 if(['pointerdown','keydown','click'].includes(scenario))target.dispatchEvent(new Event(scenario));
 resolve({success:scenario!=='failed',league:{id:'invited-league'}});await task;interaction.dispose();
 assert.equal(joins,1);
 assert.equal(activeLeague,scenario==='home'?'invited-league':'existing-draft',scenario);
 assert.equal(tab,scenario==='home'?'lobby':scenario==='navigated'?'solo':'home',scenario);
}
const context=readFileSync(new URL('../BallKnowerContext.tsx',import.meta.url),'utf8');
const join=context.slice(context.indexOf('const joinLeague = async'),context.indexOf('const joinPublicLeague = async'));
assert.ok(join.includes('options: { activate?: boolean } = {}'));
assert.match(join,/if\(options.activate!==false\)setActiveLeagueId\(targetLeague.id\)/);
console.log('PASS: delayed invite cannot switch screen or active draft after navigation, Home interaction, or unmount; unchanged Home redirect and default activation preserved.');

const disposedTarget=new EventTarget(),disposed=watchInviteInteraction(disposedTarget);disposed.dispose();disposedTarget.dispatchEvent(new Event('pointerdown'));assert.equal(disposed.isUntouched(),true,'cleanup removes pending-invite interaction listeners');
