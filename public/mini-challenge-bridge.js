// The parent owns authentication and score submission. Standalone play stays local.
const params = new URLSearchParams(globalThis.location?.search || '');
export const inMiniChallenge = () => Boolean(params.get('bkChallenge') && params.get('bkToken') && window.parent !== window);
export function challengeSeed(){return inMiniChallenge()?Number(params.get('seed'))>>>0:undefined;}
let posted=false;
export function reportMiniChallenge(stats){
  if(!inMiniChallenge()||posted)return;
  posted=true;
  window.parent.postMessage({type:'bk-mini-result',challengeId:params.get('bkChallenge'),token:params.get('bkToken'),stats},window.location.origin);
}
export function drillSessionStats(results){
  return {score:Math.round(results.reduce((n,r)=>n+r.score,0)/results.length),reps:results.length,catches:results.filter(r=>r.caught).length,stops:results.filter(r=>r.stop).length,picks:results.filter(r=>r.intercepted).length,yards:Math.round(results.reduce((n,r)=>n+(r.yards||0),0)),touchdowns:results.filter(r=>r.touchdown).length};
}

export function reportDrillSession(results){reportMiniChallenge(drillSessionStats(results));}

export function exitMiniChallenge(){
  if(!inMiniChallenge())return false;
  window.parent.postMessage({type:'bk-mini-exit',challengeId:params.get('bkChallenge'),token:params.get('bkToken')},location.origin);return true;
}
if(typeof document!=='undefined'&&inMiniChallenge())document.addEventListener('click',event=>{
  const link=event.target instanceof Element?event.target.closest('a'):null;
  if(link&&new URL(link.href,location.href).origin===location.origin&&new URL(link.href,location.href).pathname==='/'){event.preventDefault();exitMiniChallenge();}
},true);
