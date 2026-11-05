import assert from 'node:assert/strict';
import {evaluatePostgameShadow,loadPostgameShadowSources,mapPostgameShadowDefense,mapPostgameShadowPlayer,POSTGAME_SHADOW_URLS,type ShadowSources} from '../server/bk/fantasy-postgame-shadow';

const now=Date.parse('2026-11-05T20:00:00Z');
const teamNames='ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS'.split(' ');
const circle=[...teamNames],schedule:Record<string,string>[]=[];
for(let round=0;round<17;round++){
  for(let pair=0;pair<16;pair++){
    const week=round===16&&pair===0?18:round+1,away=circle[pair],home=circle[31-pair];
    schedule.push({game_id:`2026_${String(week).padStart(2,'0')}_${away}_${home}`,season:'2026',game_type:'REG',week:String(week),gameday:new Date(Date.parse('2026-09-10')+(week-1)*7*86400_000).toISOString().slice(0,10),gametime:'13:00',away_team:away,home_team:home,away_score:'0',home_score:'14',result:'14',total:'14',spread_line:'3',total_line:'42'});
  }
  circle.splice(1,0,circle.pop()!);
}
const game=schedule[0];
const fields='attempts completions passing_yards passing_tds passing_interceptions carries rushing_yards rushing_tds targets receptions receiving_yards receiving_tds fumbles_lost_total special_teams_tds fg_made fg_att fg_missed fg_blocked pat_made pat_att pat_missed pat_blocked passing_2pt_conversions rushing_2pt_conversions receiving_2pt_conversions'.split(' ');
const qb={...Object.fromEntries(fields.map(key=>[key,'0'])),player_id:'00-0000001',position:'QB',season:'2026',season_type:'REG',game_id:game.game_id,team:game.away_team,attempts:'20',completions:'10',passing_yards:'250',passing_tds:'2'};
const defenseFields='def_sacks def_interceptions fumble_recovery_opp def_tds special_teams_tds def_safeties def_punt_blocks def_pat_blocks def_fg_blocks'.split(' ');
const defense=(team:string,opponent:string)=>({...Object.fromEntries(defenseFields.map(key=>[key,'0'])),game_id:game.game_id,team,opponent_team:opponent,season:'2026',season_type:'REG'});
const table=(rows:Record<string,string>[])=>({rows,fetchedAt:new Date(now).toISOString(),sourceUpdatedAt:new Date(now-3600_000).toISOString()});
const sources:ShadowSources={players:table([qb]),teams:table([defense(game.away_team,game.home_team),defense(game.home_team,game.away_team)]),schedule:table(schedule),completion:table([{game_id:game.game_id}])};
const identities=[{id:'existing-app-qb',gsisId:qb.player_id,position:'QB',active:true}];
const report=evaluatePostgameShadow(sources,identities,now);
assert.equal(report.mode,'read_only_shadow');assert.equal(report.scoringAvailable,false);assert.equal(report.writes,0);assert.equal(report.live,false);
assert.equal(report.players[0].appPlayerId,'existing-app-qb');assert.equal(report.players[0].candidatePoints?.ppr,18);
assert.deepEqual(report.issues,[]);assert.equal(report.publicationOrderVerified,true);
assert.equal(report.summary.defenseCandidates,0,'incomplete DST policy cannot silently score a defense');
assert.ok(report.defenses.every(row=>row.problems.includes('points_allowed_policy')));
assert.ok(report.unsupported.includes('absent_player_rows_have_no_participation_or_zero_score_proof'));
assert.deepEqual(evaluatePostgameShadow(sources,identities,now),report,'same inputs must produce the same report');
const corrected=structuredClone(sources);corrected.players.rows[0].passing_yards='275';
assert.equal(evaluatePostgameShadow(corrected,identities,now).players[0].candidatePoints?.ppr,19,'a corrected final snapshot must recalculate candidate arithmetic');
assert.equal(sources.players.rows[0].passing_yards,'250','shadow comparisons must not mutate source data');
assert.equal(mapPostgameShadowPlayer({...qb,passing_yards:''}).stats.passingYards,undefined,'missing fields cannot become zero');
assert.ok(mapPostgameShadowPlayer({...qb,passing_yards:'NA'}).missingFields.includes('passing_yards'));
assert.equal(mapPostgameShadowPlayer({...qb,fg_att:'2',fg_made:'1',fg_blocked:'1'}).stats.fieldGoalsMissed,1,'a blocked FG is counted once as an unsuccessful attempt');
assert.ok(mapPostgameShadowPlayer({...qb,fg_att:'2',fg_made:'1',fg_blocked:''}).missingFields.includes('fg_blocked'));
assert.ok(mapPostgameShadowPlayer({...qb,fg_att:'1',fg_made:'1',fg_blocked:'1'}).missingFields.includes('fieldGoalsAttempted_inconsistent'));
assert.ok(mapPostgameShadowPlayer({...qb,attempts:'1',completions:'2'}).missingFields.includes('passing_completions_exceed_attempts'));
assert.ok(mapPostgameShadowDefense({...defense('ARI','WAS'),def_fg_blocks:''}).missingFields.includes('def_fg_blocks'));
for(const mutate of [
  (input:ShadowSources)=>{input.completion.rows=[]},
  (input:ShadowSources)=>{input.players.sourceUpdatedAt=null},
  (input:ShadowSources)=>{input.players.sourceUpdatedAt=new Date(now-7200_000).toISOString()},
  (input:ShadowSources)=>{input.schedule.rows[0].home_score='13'},
  (input:ShadowSources)=>{input.players.fetchedAt='2000-01-01T00:00:00Z'},
  (input:ShadowSources)=>{input.players.sourceUpdatedAt=new Date(now+120_000).toISOString()},
]){
  const input=structuredClone(sources);mutate(input);
  if(!input.completion.rows.length)assert.throws(()=>evaluatePostgameShadow(input,identities,now),'empty completion input is a failure, never a zero-score dataset');
  else assert.equal(evaluatePostgameShadow(input,identities,now).players[0].candidatePoints,null,'unverified final ordering or data cannot produce a candidate');
}
for(const crosswalk of [[],[{...identities[0],active:false}],[identities[0],{...identities[0],id:'other-app'}],[identities[0],{...identities[0],gsisId:'other-gsis'}],[{...identities[0],position:'RB'}]]){
  assert.equal(evaluatePostgameShadow(sources,crosswalk,now).players[0].candidatePoints,null,'ambiguous, missing, inactive or conflicting identities cannot be guessed by name');
}
const duplicate=structuredClone(sources);duplicate.players.rows.push({...qb});
assert.ok(evaluatePostgameShadow(duplicate,identities,now).players.every(row=>row.candidatePoints===null),'both sides of a duplicate must fail closed');
const incomplete=structuredClone(sources);incomplete.teams.rows.pop();
assert.ok(evaluatePostgameShadow(incomplete,identities,now).issues.includes('paired_team_statistics_incomplete'));

const csv=(rows:Record<string,string>[])=>{const keys=Object.keys(rows[0]);return [keys.join(','),...rows.map(row=>keys.map(key=>row[key]).join(','))].join('\n')};
const requested:string[]=[];
const loaded=await loadPostgameShadowSources((async(input:any)=>{
  const url=String(input),entry=Object.entries(POSTGAME_SHADOW_URLS).find(([,value])=>url===value);assert.ok(entry,'only the four fixed public sources may be requested');requested.push(url);
  return new Response(csv(sources[entry[0] as keyof ShadowSources].rows),{headers:{'last-modified':new Date(now-3600_000).toUTCString()}});
}) as typeof fetch,()=>now);
assert.equal(requested.length,4);assert.equal(evaluatePostgameShadow(loaded,identities,now).players[0].candidatePoints?.ppr,18);
console.log('Postgame shadow diagnostics: fixed bounded public inputs, missing/zero fields, GSIS collision guards, paired teams, publication order, final corrections, unsupported DST semantics and zero database writes passed.');
