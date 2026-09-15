(()=>{
'use strict';
const SEASON_KEY='ballknower_solo_franchise_v2:season';
const BASE_KEY='ballknower_solo_franchise_v2';
const PENDING_KEY='ballknower_franchise_play_moment_pending_v1';
const BUTTON_ATTR='data-bk-play-moment';
let overlay=null;
let activeRun=null;
let scanQueued=false;
const readJson=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
const writeJson=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const norm=(value)=>String(value||'').replace(/\s+/g,' ').trim();
const qScores=(total)=>{const q1=Math.floor(total*.22),q2=Math.floor(total*.32),q3=Math.floor(total*.20);return[q1,q2,q3,total-q1-q2-q3]};
const snapshot=(wins,losses,week)=>{const pct=wins/Math.max(1,wins+losses),seed=clamp(Math.round(9-(pct-.5)*10+(17-week)*.05),1,12),odds=clamp(Math.round(8+pct*88+(week>10?(pct-.5)*20:0)),1,99);return{seed,odds}};
function soloRoot(){return document.querySelector('[data-tab="solo"]')}
function findSimButton(){
 const root=soloRoot();if(!root)return null;
 return[...root.querySelectorAll('button')].find(button=>/^SIMULATE WEEK \d+$/i.test(norm(button.textContent)))||null;
}
function removeOrphans(current){document.querySelectorAll('['+BUTTON_ATTR+']').forEach(button=>{if(!current||button.dataset.for!==current.textContent)button.remove()})}
function currentOpponent(sim){
 let node=sim.parentElement;
 for(let depth=0;node&&depth<5;depth++,node=node.parentElement){
  const text=norm(node.innerText);if(text.includes(' VS ')){
   const labels=[...node.querySelectorAll('div,span,p')].map(el=>norm(el.textContent)).filter(Boolean);
   const candidate=labels.find(value=>value!==norm(sim.textContent)&&value.length>3&&!/^(CPU|VS|WEEK|GAME PLAN|TEAM OVR|PLAYOFF|RECORD)/i.test(value)&&!value.includes('SIMULATE'));
   if(candidate)return candidate.slice(0,40);
  }
 }
 return 'CPU';
}
function inject(){
 scanQueued=false;const sim=findSimButton();removeOrphans(sim);if(!sim||sim.disabled||sim.previousElementSibling?.hasAttribute?.(BUTTON_ATTR))return;
 const button=document.createElement('button');button.type='button';button.setAttribute(BUTTON_ATTR,'1');button.dataset.for=sim.textContent||'';button.innerHTML='<span style="font-size:15px">▶</span><span><b style="display:block;font-size:13px;letter-spacing:.04em">PLAY MOMENT</b><small style="display:block;margin-top:2px;font-size:8px;letter-spacing:.13em;opacity:.7">TAKE CONTROL OF THE CLUTCH DRIVE</small></span>';
 Object.assign(button.style,{width:'100%',minHeight:'58px',marginTop:'12px',borderRadius:'16px',border:'1px solid rgba(239,200,91,.55)',background:'linear-gradient(180deg,rgba(239,200,91,.16),rgba(239,200,91,.07))',color:'#ffe49a',fontWeight:'950',display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',boxShadow:'0 12px 35px rgba(0,0,0,.24)'});
 button.addEventListener('click',()=>openMoment(sim));sim.insertAdjacentElement('beforebegin',button);
}
function queueScan(){if(scanQueued)return;scanQueued=true;requestAnimationFrame(inject)}
function openMoment(sim){
 const season=readJson(SEASON_KEY)||{weeks:[]};const before=Array.isArray(season.weeks)?season.weeks.length:0;const week=before+1;if(week>17||sim.disabled)return;
 activeRun={before,week,sim,opponent:currentOpponent(sim)};
 overlay=document.createElement('div');overlay.id='bk-play-moment-overlay';Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'2147483000',background:'#05080c',padding:'0',margin:'0'});
 const iframe=document.createElement('iframe');iframe.title='Ball Knower Play Moment';iframe.allow='autoplay';iframe.src='/franchise-play-moment-v2.html?embedded=1&week='+encodeURIComponent(week)+'&opponent='+encodeURIComponent(activeRun.opponent);Object.assign(iframe.style,{width:'100%',height:'100%',border:'0',display:'block',background:'#05080c'});overlay.appendChild(iframe);document.body.appendChild(overlay);document.documentElement.style.overflow='hidden';
}
function closeMoment(){overlay?.remove();overlay=null;document.documentElement.style.overflow=''}
function addDriveStats(lines,result){
 if(!Array.isArray(lines))return;
 const qb=result?.qb;if(qb?.id){let row=lines.find(line=>line.playerId===qb.id);if(!row){row={playerId:qb.id,name:qb.name||'QB',position:'QB',fantasyScore:0};lines.push(row)}row.passYds=(Number(row.passYds)||0)+(Number(qb.passYards)||0);row.passTD=(Number(row.passTD)||0)+(Number(qb.passTD)||0);row.interceptions=(Number(row.interceptions)||0)+(Number(qb.interceptions)||0);row.fantasyScore=Math.round(((Number(row.fantasyScore)||0)+(Number(qb.passYards)||0)/25+(Number(qb.passTD)||0)*4-(Number(qb.interceptions)||0)*2)*10)/10}
 for(const rec of Array.isArray(result?.receivers)?result.receivers:[]){if(!rec?.id)continue;let row=lines.find(line=>line.playerId===rec.id);if(!row){row={playerId:rec.id,name:rec.name||'Receiver',position:'WR',fantasyScore:0};lines.push(row)}row.receptions=(Number(row.receptions)||0)+(Number(rec.receptions)||0);row.recYds=(Number(row.recYds)||0)+(Number(rec.yards)||0);row.recTD=(Number(row.recTD)||0)+(Number(rec.td)||0);row.fantasyScore=Math.round(((Number(row.fantasyScore)||0)+(Number(rec.receptions)||0)+(Number(rec.yards)||0)/10+(Number(rec.td)||0)*6)*10)/10}
}
function patchInteractions(interactions,result,week){
 if(!interactions||typeof interactions!=='object')return interactions;const next={...interactions};
 if(next.development&&typeof next.development==='object')next.development=Object.fromEntries(Object.entries(next.development).map(([id,dev])=>[id,{...dev,morale:clamp((Number(dev?.morale)||70)+(result.won?2:-2),0,99)}]));
 const notice={id:'play-moment-'+week+'-'+Date.now(),week,kind:'story',title:result.won?'Clutch moment won':'Clutch moment lost',body:result.won?'You took control and finished the drive. The locker room felt the swing.':'You took control, but the defense survived the moment.',read:false};next.notifications=[notice,...(Array.isArray(next.notifications)?next.notifications:[])].slice(0,60);return next;
}
function patchSeason(result,before){
 const season=readJson(SEASON_KEY);if(!season||!Array.isArray(season.weeks)||season.weeks.length<=before)return false;
 const index=before,week={...season.weeks[index],game:{...season.weeks[index].game},playerLines:[...(season.weeks[index].playerLines||[])]};const game=week.game;if(!game)return false;
 const home=game.homeMemberId==='franchise-user',opponentId=home?game.awayMemberId:game.homeMemberId;let opponentScore=Number(home?game.awayScore:game.homeScore)||result.opponentScore||24;opponentScore=Math.max(10,opponentScore);const userScore=result.won?Math.max(opponentScore+4,Number(result.score)||0):Math.max(6,Math.min(opponentScore-3,Number(result.score)||opponentScore-3));
 if(home){game.homeScore=userScore;game.awayScore=opponentScore}else{game.awayScore=userScore;game.homeScore=opponentScore}game.winnerId=result.won?'franchise-user':opponentId;game.loserId=result.won?opponentId:'franchise-user';game.isTie=false;game.keyMatchupFactor=result.won?'Ball Knower user took control of the late-game drive and won the playable moment.':'Ball Knower user took control late, but the defense stopped the playable moment.';game.quarterScores={home:qScores(game.homeScore),away:qScores(game.awayScore)};
 week.won=Boolean(result.won);week.game=game;addDriveStats(week.playerLines,result);season.weeks[index]=week;
 let wins=0,losses=0;season.weeks.forEach((item,i)=>{if(item.won)wins++;else losses++;item.record=wins+'-'+losses;const snap=snapshot(wins,losses,i+1);item.playoffSeed=snap.seed;item.playoffOdds=snap.odds});
 season.message=(result.won?'PLAY MOMENT WIN':'PLAY MOMENT LOSS')+' — '+wins+'-'+losses;season.interactions=patchInteractions(season.interactions,result,index+1);writeJson(SEASON_KEY,season);try{localStorage.removeItem(PENDING_KEY)}catch{}return true;
}
function refreshFranchise(){
 const back=[...document.querySelectorAll('button')].find(button=>button.getAttribute('aria-label')==='Back to Solo Franchise Hub');if(!back){location.reload();return}back.click();
 const started=Date.now(),timer=setInterval(()=>{const start=[...document.querySelectorAll('button')].find(button=>norm(button.textContent)==='START SEASON');if(start){clearInterval(timer);start.click();return}if(Date.now()-started>3500){clearInterval(timer);location.reload()}},80);
}
function waitForWeek(result,run){
 const started=Date.now(),timer=setInterval(()=>{const season=readJson(SEASON_KEY);if(Array.isArray(season?.weeks)&&season.weeks.length>run.before){clearInterval(timer);if(patchSeason(result,run.before)){refreshFranchise();return}}if(Date.now()-started>9000){clearInterval(timer);try{localStorage.removeItem(PENDING_KEY)}catch{}queueScan()}},100);
}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||!event.data||typeof event.data!=='object')return;
 if(event.data.type==='bk-play-moment-cancel'){closeMoment();activeRun=null;queueScan();return}
 if(event.data.type!=='bk-play-moment-result'||!activeRun)return;
 const run=activeRun;activeRun=null;closeMoment();const sim=findSimButton()||run.sim;if(!sim||sim.disabled){queueScan();return}try{localStorage.setItem(PENDING_KEY,JSON.stringify(event.data))}catch{}sim.click();waitForWeek(event.data,run);
});
const observer=new MutationObserver(queueScan);observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','data-tab']});window.addEventListener('popstate',queueScan);window.addEventListener('pageshow',queueScan);setInterval(queueScan,1200);queueScan();
})();