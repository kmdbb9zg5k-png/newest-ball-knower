import {writeFileSync,readFileSync} from 'node:fs';
import {PLAYERS_DATABASE} from '../players';
import {INDEPENDENT_FOOTBALL_INPUTS} from '../currentSeasonRoster';
import {independentProjection,type ProjectionFormat} from '../independentPlayerRatings';
import {getDraftPositionGroup} from '../rosterRules';
const rankings:any[]=[];
const offsets:Record<string,number>={QB:230,RB:90,WR:95,TE:75,K:90};
for(const format of ['ppr','half_ppr','standard'] as ProjectionFormat[]){
  const rows=INDEPENDENT_FOOTBALL_INPUTS.filter(p=>p.active).flatMap(input=>{
    const projection=independentProjection(input,format);if(!projection)return [];
    return [{player_key:input.id,player_name:input.name,team:input.team,position:input.position,
      season:2026,scoring_format:format,actual_points_2025:projection.actualPoints===null?null:Math.max(0,projection.actualPoints),
      projected_points_2026:projection.projectedPoints,projection_reason:projection.reason,
      actual_source_name:'Ball Knower scoring from nflverse 2025 regular-season statistics',
      actual_source_url:'https://github.com/nflverse/nflverse-data/releases/tag/stats_player',
      projection_source_name:'Ball Knower independent projection model v1',
      projection_source_url:'https://ballknowerofficial.com/data-credits.html',
      projection_model:'Independent production/role regression v1',updated_at:'2026-09-06T11:29:30Z'}];
  }).sort((a,b)=>(b.projected_points_2026-offsets[b.position])-(a.projected_points_2026-offsets[a.position])||a.player_key.localeCompare(b.player_key));
  const positions:Record<string,number>={};
  rows.forEach((row,index)=>rankings.push({...row,overall_rank:index+1,position_rank:positions[row.position]=(positions[row.position]??0)+1,adp:null}));
}
const catalog=PLAYERS_DATABASE.flatMap(player=>{
  const group=getDraftPositionGroup(player);return group?[{player_id:player.id,position_group:group,salary:player.salary,ovr:player.ovr,player_json:player,active:true}]:[];
});
const data={version:1,season:2026,source:'nflverse CC BY 4.0 · modified by Ball Knower',catalog,rankings};
const serialized=JSON.stringify(data)+'\n';
if(process.argv.includes('--check')){if(readFileSync('data/published-independent-football.json','utf8')!==serialized)throw new Error('Published snapshot differs from the independent model. Generate a new versioned migration.');}
else writeFileSync('data/published-independent-football.json',serialized);
console.log(`Published ${catalog.length} catalog entries and ${rankings.length} ranking entries across three formats.`);
