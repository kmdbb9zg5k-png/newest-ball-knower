import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';

// Isolated UI fixture: all identity, opponents, API responses and iframe results
// below are mocks. It never connects to Supabase or represents a real-user match.
export async function createCommunityReliabilityFixture(port=3066){
 const states=new Map();
 const entry=`import React from 'react';import{createRoot}from'react-dom/client';import Arena from '/CommunityFootballArena.tsx';import Competition from '/CommunityCompetitionArena.tsx';import '/index.css';
 const q=new URLSearchParams(location.search);if(!sessionStorage.getItem('bk-reliability-fixture'))sessionStorage.setItem('bk-reliability-fixture',crypto.randomUUID());
 const auth=()=>{document.body.dataset.auth='requested';alert('Fixture only: sign-in requested. No account is connected.');};
 createRoot(document.getElementById('root')).render(React.createElement(React.Fragment,null,React.createElement('aside',{style:{padding:12,border:'1px solid #e7c66d',color:'#e7c66d',fontSize:13}},'ISOLATED TEST FIXTURE — API, player and drive results are mocked. No live account or real-player proof.'),q.get('mode')==='competition'?React.createElement(Competition,{me:q.has('guest')?'':'fixture-user',onOpenAuth:auth}):React.createElement(Arena,{me:q.has('guest')?'':'fixture-user',friends:[{userId:'fixture-friend',displayName:'Fixture rival'}],onOpenAuth:auth})));`;
 const adapter=(kind)=>`export async function ${kind==='football'?'footballArenaAction':'competitionAction'}(action,args={}){const r=await fetch('/__community-reliability/${kind}',{method:'POST',headers:{'content-type':'application/json','x-fixture-id':sessionStorage.getItem('bk-reliability-fixture')||'default','x-fixture-scenario':new URLSearchParams(location.search).get('scenario')||'standard'},body:JSON.stringify({action,args})});const d=await r.json();if(!r.ok)throw Error(d.message);return d;}`;
 const makeMatch=(id='fixture-match')=>({id,challenger_id:'fixture-user',opponent_id:'fixture-friend',challenger_team:'JCY',opponent_team:'BRK',challenger_name:'You',opponent_name:'Fixture rival',status:'active',winner_id:null,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString(),drives:[]});
 const makeState=(scenario)=>({scenario,matches:[makeMatch()],failedSubmit:false,failedHome:false,failedEvent:false,failedSearch:false,competitionResults:{},joined:true,calls:[],event:{id:'fixture-event',title:'Fixture Three-Drill Cup',crew_id:null,games:['dash','bench','broad-jump'],seed:42,starts_at:new Date(Date.now()-3600000).toISOString(),ends_at:new Date(Date.now()+86400000).toISOString(),finalized_at:null}});
 const json=(res,status,value)=>{res.statusCode=status;res.setHeader('content-type','application/json');res.end(JSON.stringify(value));};
 const server=await createServer({root:process.cwd(),cacheDir:`/tmp/bk-community-reliability-${port}`,server:{host:'0.0.0.0',port,strictPort:true,watch:null,hmr:false},plugins:[{name:'community-reliability-fixture',enforce:'pre',
  transform(code,id){if(id.endsWith('/footballArena.ts')){const a=code.indexOf('export async function footballArenaAction'),b=code.indexOf('export const footballTotal');return code.slice(0,a)+adapter('football')+'\n'+code.slice(b);}},
  resolveId(id,importer){if(id==='/community-reliability-entry.tsx')return'\0community-reliability-entry';if(id==='./competitionCloud'&&importer?.endsWith('/CommunityCompetitionArena.tsx'))return'\0community-reliability-competition';},
  load(id){if(id==='\0community-reliability-entry')return entry;if(id==='\0community-reliability-competition')return adapter('competition');},
  configureServer(s){s.middlewares.use(async(req,res,next)=>{
   try{
    if(req.url?.startsWith('/community-reliability-qa.html')){res.setHeader('content-type','text/html');res.end(await s.transformIndexHtml(req.url,'<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Community reliability fixture</title></head><body style="margin:0;background:#06090d;color:white"><div id="root"></div><script type="module" src="/community-reliability-entry.tsx"></script></body></html>'));return;}
    if(req.url?.startsWith('/play-moment-3d-preview.html')||req.url?.startsWith('/combine.html')){
     res.setHeader('content-type','text/html');res.end(`<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;padding:20px;box-sizing:border-box;background:#112631;color:#fff;font:16px system-ui"><p>Mock drive/drill — no game engine or human opponent</p><button id="fixture-result" style="min-height:48px">Complete fixture attempt</button><button id="fixture-exit" style="min-height:48px">Exit fixture attempt</button><script>const p=new URLSearchParams(location.search),arena=p.has('bkArena');function send(result){parent.postMessage(arena?{type:result?'bk-arena-result':'bk-arena-exit',matchId:p.get('bkArena'),token:p.get('token'),drive:Number(p.get('drive')),stats:{points:3,yards:40,plays:6}}:{type:result?'bk-mini-result':'bk-mini-exit',challengeId:p.get('bkChallenge'),token:p.get('bkToken'),stats:p.get('drill')==='bench'?{reps:30}:p.get('drill')==='broad-jump'?{distance:3}:{time:4.5,split10:1.5,split20:2.6}},location.origin);}document.getElementById('fixture-result').onclick=()=>send(true);document.getElementById('fixture-exit').onclick=()=>send(false);if(arena)parent.postMessage({type:'bk-arena-ready',matchId:p.get('bkArena'),token:p.get('token'),drive:Number(p.get('drive'))},location.origin);</script></body></html>`);return;
    }
    if(!req.url?.startsWith('/__community-reliability/')){next();return;}
    const id=String(req.headers['x-fixture-id']||'default'),scenario=String(req.headers['x-fixture-scenario']||'standard');
    if(!states.has(id))states.set(id,makeState(scenario));const state=states.get(id);
    if(req.url.endsWith('/state')){json(res,200,state);return;}
    let body='';for await(const chunk of req)body+=chunk;if(body.length>32000){json(res,413,{message:'Fixture request too large'});return;}
    const {action,args={}}=JSON.parse(body||'{}');state.calls.push({action,args});
    if(req.url.endsWith('/football')){
     const m=state.matches.find(m=>m.id===args.id);
     if(action==='home'){
      if(scenario==='load-error'&&!state.failedHome){state.failedHome=true;json(res,503,{message:'Fixture: match list unavailable. Retry to recover.'});return;}
      json(res,200,{matches:state.matches,standings:state.matches.filter(m=>m.status==='completed').length?[{user_id:'fixture-user',name:'You',games:1,wins:1,losses:0,ties:0,rating:3}]:[]});return;
     }
     if(action==='quick_match'){
      if(scenario==='search-error'&&!state.failedSearch){state.failedSearch=true;json(res,503,{message:'Fixture: online search connection failed.'});return;}
      const queued=makeMatch('fixture-search');queued.opponent_id=null;queued.opponent_team=null;queued.status='open';state.matches.unshift(queued);
      if(scenario==='late-cancel')await new Promise(resolve=>setTimeout(resolve,2000));
      if(scenario==='human'){queued.opponent_id='fixture-friend';queued.opponent_team='BRK';queued.status='active';}
      json(res,200,{id:queued.id,status:queued.status});return;
     }
     if(action==='cancel'){if(m)m.status='cancelled';json(res,200,{cancelled:true});return;}
     if(action==='create'){const next=makeMatch('fixture-rematch-'+state.matches.length);next.status='pending';next.challenger_team=args.team;state.matches.unshift(next);json(res,200,{id:next.id});return;}
     if(action==='begin'){
      if(!m){json(res,404,{message:'Fixture match missing'});return;}
      let d=m.drives.find(d=>d.user_id==='fixture-user'&&d.ordinal===args.drive);
      if(!d){d={user_id:'fixture-user',ordinal:args.drive,points:null,yards:null,plays:null,finished_at:null,deadline:new Date(Date.now()+720000).toISOString(),forfeited:false};m.drives.push(d);}
      json(res,200,{token:'fixture-token-'+args.drive,drive:args.drive,deadline:d.deadline,seed:40+args.drive,team:m.challenger_team,opponent:m.opponent_team});return;
     }
     if(action==='submit'||action==='forfeit'){
      if(!m){json(res,404,{message:'Fixture match missing'});return;}
      if(action==='submit'&&!state.failedSubmit){state.failedSubmit=true;json(res,503,{message:'Fixture: connection interrupted while saving. Retry the same result.'});return;}
      const d=m.drives.find(d=>d.user_id==='fixture-user'&&d.ordinal===args.drive);
      if(!d){json(res,409,{message:'Fixture drive missing'});return;}
      if(!d.finished_at)Object.assign(d,action==='submit'?args.stats:{points:0,yards:0,plays:0},{finished_at:new Date().toISOString(),forfeited:action==='forfeit'});
      if(m.drives.filter(d=>d.user_id==='fixture-user'&&d.finished_at).length===3){m.drives.push(...[1,2,3].filter(ordinal=>!m.drives.some(d=>d.user_id==='fixture-friend'&&d.ordinal===ordinal)).map(ordinal=>({user_id:'fixture-friend',ordinal,points:0,yards:20,plays:4,finished_at:new Date().toISOString(),forfeited:false})));m.status='completed';m.winner_id='fixture-user';}
      json(res,200,{saved:true,points:d.points});return;
     }
    }else if(req.url.endsWith('/competition')){
     if(action==='home'){
      if(scenario==='load-error'&&!state.failedHome){state.failedHome=true;json(res,503,{message:'Fixture: competitions unavailable. Retry to recover.'});return;}
      json(res,200,{crew:null,events:[state.event],rewards:[]});return;
     }
     if(action==='event'){
      if(scenario==='load-error'&&!state.failedEvent){state.failedEvent=true;json(res,503,{message:'Fixture: event could not load. Retry this event.'});return;}
      const rows=Object.entries(state.competitionResults).map(([game,v])=>({game,stats:v.stats,score:v.score,submitted_at:new Date().toISOString()}));
      json(res,200,{event:state.event,joined:state.joined,mine:rows,standings:rows.length?[{user_id:'fixture-user',name:'You',points:rows.reduce((sum,r)=>sum+r.score,0),completed:rows.length,final_rank:null,crew_name:null,badge:null}]:[],crew_standings:[]});return;
     }
     if(action==='begin'){json(res,200,{token:'fixture-event-token-'+args.game,seed:42});return;}
     if(action==='submit'){
      if(!state.failedSubmit){state.failedSubmit=true;json(res,503,{message:'Fixture: drill result could not save. Retry the same result.'});return;}
      state.competitionResults[args.game]??={score:87.5,stats:args.stats};json(res,200,state.competitionResults[args.game]);return;
     }
    }
    json(res,400,{message:'Unsupported isolated fixture action: '+action});
   }catch(e){json(res,500,{message:String(e)});}
  });},
 }]});
 await server.listen();return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT||3066);const server=await createCommunityReliabilityFixture(port);
 console.log(`Isolated mocked Community fixture: http://127.0.0.1:${port}/community-reliability-qa.html (use ?guest, ?scenario=search-error, ?scenario=late-cancel, ?mode=competition&scenario=load-error)`);
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void server.close().then(()=>process.exit()));
}
