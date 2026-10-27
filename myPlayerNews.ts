import type {CareerLife} from './myPlayerCareer';
export type CareerNewsItem={id:string;source:string;headline:string;body:string;tag:string};
// Derived from saved facts: no timers, fabricated scores or random headlines.
export function careerNews(life:CareerLife,name:string):CareerNewsItem[]{
 const items:CareerNewsItem[]=[];
 if(life.turn?.response==='business')items.push({id:`${life.turn.key}:agent`,source:'Jordan Ellis · Agent message',tag:'THIS WEEK',headline:'Your agent is pushing for opportunity',body:'You asked Jordan to speak up. Agent confidence increased; coach trust took a hit. The next evaluation still has to back up the request.'});
 else if(life.turn?.response==='bet')items.push({id:`${life.turn.key}:challenge`,source:'Coach Reed · Team notebook',tag:'THIS WEEK',headline:'The toughest assignment is on your plate',body:'You asked for the test. An evaluation below 60 brings an extra coach-trust penalty.'});
 else if(life.turn?.response==='team')items.push({id:`${life.turn.key}:room`,source:'Andre Brooks · Locker room',tag:'THIS WEEK',headline:'The captain notices your team-first response',body:'Your choice strengthened room chemistry and coach trust. The next performance will show whether you can turn that support into a larger role.'});
 for(let i=life.history.length-1;i>=0;i--){const h=life.history[i],previous=life.history[i-1],tag=h.key.replaceAll(':',' · ');
  if(previous&&previous.role!==h.role)items.push({id:`${h.key}:role`,source:'Coach Reed · Depth-chart report',tag,headline:`${name} moves from ${previous.role} to ${h.role}`,body:h.feedback});
  items.push({id:`${h.key}:tape`,source:'BK Career Wire · Fictional career coverage',tag,headline:h.score>=75?(h.won?`${name} delivers strong tape in a team win`:`Strong tape for ${name}, but the team falls short`):h.score<45?(h.won?'Team wins; your execution remains under review':'A difficult week for player and team'):(h.won?'A win and another week of reliable tape':'Steady individual tape in a team loss'),body:`Evaluation: ${h.score}/100. Role after the game: ${h.role}. ${h.feedback}`});
  if(h.response==='business')items.push({id:`${h.key}:agent-followup`,source:'Jordan Ellis · Agent message',tag,headline:h.score>=75?'Your tape backs up the opportunity request':'The opportunity conversation needs stronger tape',body:h.score>=75?'You asked for visibility and delivered a strong evaluation. Keep building the case; a larger role still depends on recent performance and coach trust.':'You asked for more opportunity. Jordan has the result, but one request cannot override the staff’s evaluation.'});
 }
 if(!items.length)items.push({id:'arrival',source:'BK Career Wire · Fictional career coverage',tag:'YOUR STORY',headline:life.camp.legacy?'Your next chapter starts here':life.camp.complete?`${name} enters the season in ${life.role}`:'A roster spot is only the beginning',body:life.camp.complete?'Complete your first career week to build a record of performances, decisions and depth-chart changes.':'The camp battle is still open. Your completed evaluations and coach trust determine the opening role.'});
 return items;
}
