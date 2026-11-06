import assert from 'node:assert/strict';
import {subscribeToCloudLeague} from '../leagueCloud';
import {supabase} from '../supabase';

// Exercise the actual subscription adapter with an isolated transport. A rejoin
// does not contain missed rows; its status must trigger an authoritative read.
assert.ok(supabase,'the app default client must be available to test its adapter');
const client=supabase as any;
const originalChannel=client.channel,originalRemove=client.removeChannel;
const bindings:Array<{filter:any;callback:()=>void}>=[];
let statusCallback:(status:string)=>void=()=>{};
let removed=false,authorityPickIndex=0;
const rendered:number[]=[];
const channel={
  on(_event:string,filter:any,callback:()=>void){bindings.push({filter,callback});return this;},
  subscribe(callback:(status:string)=>void){statusCallback=callback;return this;},
};
try{
  client.channel=(name:string)=>{assert.equal(name,'ball-knower-isolated-league');return channel;};
  client.removeChannel=(value:unknown)=>{assert.equal(value,channel);removed=true;};
  const unsubscribe=subscribeToCloudLeague('isolated-league',()=>rendered.push(authorityPickIndex));
  assert.equal(bindings.length,4);
  assert.ok(bindings.every(binding=>binding.filter.filter.endsWith('eq.isolated-league')),'all event filters must retain league scope');
  statusCallback('SUBSCRIBED');assert.deepEqual(rendered,[0],'initial join reads authoritative state');
  statusCallback('CHANNEL_ERROR');authorityPickIndex=1;
  assert.deepEqual(rendered,[0],'missed events are deliberately absent from the disconnected transport');
  statusCallback('SUBSCRIBED');assert.deepEqual(rendered,[0,1],'a successful rejoin must recover a missed pick without a later row event');
  authorityPickIndex=2;bindings.find(binding=>binding.filter.table==='ball_knower_live_drafts')!.callback();
  assert.deepEqual(rendered,[0,1,2],'ordinary live events must continue to refresh');
  unsubscribe();assert.equal(removed,true);
  authorityPickIndex=3;statusCallback('SUBSCRIBED');bindings[0].callback();
  assert.deepEqual(rendered,[0,1,2],'late statuses/events after cleanup must not refresh a different league');
}finally{client.channel=originalChannel;client.removeChannel=originalRemove;}
console.log('Fantasy realtime reconnect: actual adapter refreshes missed authoritative state on rejoin and suppresses callbacks after cleanup. No network or database writes.');
