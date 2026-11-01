import assert from 'node:assert/strict';
import {createPredictionPicksHandler} from '../api/prediction-picks';
import {createSportsbookHandler} from '../api/nfl-sportsbook';
import {predictionPicksForGame,resolvePredictionGame,predictionDay} from '../server/predictionIdentity.js';
import {gradePick} from '../picksEngine';

const now=Date.parse('2026-11-01T12:00:00Z');
const kickoff='2026-11-09T01:20:00Z';
const game={id:'2026_09_WAS_PHI',aliases:['espn-401999','401999','20261108_WSH@PHI'],kickoffAt:kickoff,scheduleDate:'2026-11-08',away:'Washington Commanders',home:'Philadelphia Eagles',awayAbbr:'WAS',homeAbbr:'PHI',awaySpread:3.5,homeSpread:-3.5,total:44.5,final:false,awayScore:null,homeScore:null};
const row={game_id:'retired-provider-game-id',pick_id:'original-pick',label:'Washington +3.5',market:'spread',selection:'Washington Football Team',locked_line:3.5,locked_at:'2026-10-31T15:00:00Z',kickoff_at:kickoff,away_team:'Washington Football Team',home_team:'Philadelphia Eagles',result:null};
const pick={id:row.pick_id,gameId:row.game_id,label:row.label,market:'spread' as const,selection:row.selection,lockedLine:row.locked_line,lockedAt:row.locked_at,kickoffAt:kickoff,awayTeam:row.away_team,homeTeam:row.home_team};
assert.equal(predictionDay(kickoff),'2026-11-08','match NFL day, not UTC midnight');
assert.equal(resolvePredictionGame(pick,[game]).game,game,'unknown old ID uses saved matchup and NFL day');
assert.equal(resolvePredictionGame({gameId:'espn-401999'},[game]).game,game);
assert.equal(resolvePredictionGame({...pick,kickoffAt:'2026-11-16T01:20:00Z'},[game]).game,null);
assert.equal(resolvePredictionGame({...pick,homeTeam:'Dallas Cowboys'},[game]).game,null);
assert.equal(resolvePredictionGame({...pick,gameId:game.id,awayTeam:'Dallas Cowboys'},[game]).game,null,'exact ID cannot override conflicting saved metadata');
assert.equal(resolvePredictionGame(pick,[game,{...game,id:'duplicate'}]).ambiguous,true);
assert.equal(predictionPicksForGame(game,[pick,{...pick,gameId:'espn-401999'}],[game]).ambiguous,true,'two saved aliases must not create two wins');
assert.equal(gradePick(pick,{...game,date:kickoff,status:'Final',awayScore:20,homeScore:23}).result,'win','old team names preserve the selected side');
assert.equal(gradePick({...pick,selection:'Unknown team'},{...game,date:kickoff,status:'Final',awayScore:20,homeScore:23}).result,undefined);

let rows:any[]=[{...row}],games:any[]=[{...game}],clock=now;
const writes:{name:string;args:any}[]=[];
const client={auth:{getUser:async()=>({data:{user:{id:'test-user'}},error:null})},rpc:async(name:string,args:any)=>{
  if(name==='get_ball_knower_verified_prediction_picks')return{data:rows,error:null};
  writes.push({name,args});
  if(name==='save_ball_knower_verified_prediction_pick'){
    const index=rows.findIndex(item=>item.game_id===args.p_game_id);
    const next={game_id:args.p_game_id,pick_id:args.p_pick_id,label:args.p_label,market:args.p_market,selection:args.p_selection,locked_line:args.p_locked_line,locked_at:new Date(clock).toISOString(),kickoff_at:args.p_kickoff_at,away_team:args.p_away_team,home_team:args.p_home_team,result:null};
    if(index>=0)rows[index]=next;else rows.push(next);return{data:true,error:null};
  }
  if(name==='grade_ball_knower_verified_prediction_pick'){const found=rows.find(item=>item.game_id===args.p_game_id);assert.ok(found);found.result=args.p_result;return{data:42,error:null};}
  if(name==='delete_ball_knower_verified_prediction_pick'){rows=rows.filter(item=>item.game_id!==args.p_game_id);return{data:true,error:null};}
  throw Error(name);
}};
const handler=createPredictionPicksHandler({serviceClient:client,fetchGames:async()=>games,now:()=>clock});
const call=async(body:any,authorization='Bearer test-token')=>{
  let status=0,payload:any;const res={setHeader(){},status(value:number){status=value;return res},json(value:any){payload=value;return res}};
  await handler({method:'POST',headers:{authorization},body},res);return{status,payload};
};
const submit=(gameId=game.id,selection=game.away,lockedLine=3.5)=>({action:'save',pick:{id:'new-provider-pick-id',gameId,market:'spread',selection,lockedLine,label:`${selection} ${lockedLine}`}});
assert.equal((await call(submit(),'')).status,401);assert.equal(writes.length,0);
assert.equal((await call(submit())).status,200);assert.equal(writes.length,0,'unchanged choice under replacement ID must preserve entire stored record');
assert.deepEqual(rows,[row]);
assert.equal((await call(submit(game.id,game.home,-3.5))).status,200);
assert.equal(rows.length,1);assert.equal(writes.at(-1)!.args.p_game_id,row.game_id,'explicit pre-kickoff choice change retains original game ID');
assert.equal(writes.at(-1)!.args.p_kickoff_at,row.kickoff_at);assert.equal(writes.at(-1)!.args.p_away_team,row.away_team);
rows=[{...row}];writes.length=0;
assert.equal((await call({...submit('forged'),pick:{...submit('forged').pick,awayTeam:game.away,homeTeam:game.home,kickoffAt:kickoff}})).status,404,'untrusted client metadata must not match an unknown write ID');
games=[{...game},{...game,id:'ambiguous-game',aliases:[]}];assert.equal((await call(submit())).status,409);assert.equal(writes.length,0);
games=[{...game}];rows=[{...row},{...row,game_id:'espn-401999',pick_id:'second-original'}];assert.equal((await call(submit())).status,409);assert.equal(writes.length,0);
rows=[{...row,kickoff_at:'2026-11-08T18:00:00Z'}];clock=Date.parse('2026-11-08T19:00:00Z');assert.equal((await call(submit())).status,409,'a later replacement kickoff cannot reopen the original saved lock');assert.equal(writes.length,0);
rows=[{...row}];clock=Date.parse(kickoff);assert.equal((await call(submit())).status,409);assert.equal(writes.length,0);
games=[{...game,final:true,awayScore:20,homeScore:23}];
assert.equal((await call({action:'grade'})).status,200);assert.equal(writes.length,1);assert.equal(writes[0].args.p_game_id,row.game_id);assert.equal(writes[0].args.p_result,'win');assert.equal(rows[0].locked_line,row.locked_line);assert.equal(rows[0].locked_at,row.locked_at);
await call({action:'grade'});assert.equal(writes.length,1,'grading is idempotent under replacement aliases');
rows=[{...row}];games=[{...game,final:true,awayScore:20,homeScore:23},{...game,id:'ambiguous-final',aliases:[],final:true,awayScore:20,homeScore:23}];writes.length=0;
await call({action:'grade'});assert.equal(writes.length,0,'ambiguous saved metadata cannot grade');
rows=[];games=[{...game}];clock=now;
await call(submit('20261108_WSH@PHI'));await call(submit('espn-401999'));assert.equal(rows.length,1);assert.equal(rows[0].game_id,game.id,'new picks from distinct provider aliases share the canonical ID');

const fetchedAt='2026-11-01T10:00:00Z';
const oldGame={...game,kickoffAt:'2026-09-11T00:20:00Z',scheduleDate:'2026-09-10'};
const snapshot=Object.assign([oldGame],{fetchedAt,sourceUpdatedAt:'2026-11-01T09:30:00Z',source:'nflverse'});
const board=createSportsbookHandler({fetchGames:async()=>snapshot,now:()=>now});
let output:any;const response={setHeader(){},status(){return response},json(value:any){output=value;return response}};
await board({method:'GET',query:{gameRefs:JSON.stringify([{gameId:'unknown-old-id',awayTeam:game.away,homeTeam:game.home,kickoffAt:oldGame.kickoffAt}])}},response);
assert.equal(output.games.length,1,'saved metadata retrieves history outside display window');assert.equal(output.games[0].id,game.id);assert.deepEqual(output.games[0].aliases,game.aliases);assert.equal(output.fetchedAt,fetchedAt,'warm handler must not label snapshot as freshly fetched');assert.equal(output.live,false);
console.log('Picks migration: saved IDs/lines/history, aliases, ambiguity, duplicate prevention, authentic writes, board history and snapshot age passed.');
