import {readFile,writeFile,rm} from 'node:fs/promises';
// Disposable preview of the actual components. All data operations use local fixtures.
// Run --clean before builds; no QA route or test account is shipped.
const files=['__community-mobile.html','__community-preview.html','__community-preview.tsx','__community-hub.tsx','__community-safety.tsx','__community-fixture.ts'];
if(process.argv.includes('--clean')){for(const file of files)await rm(file,{force:true});process.exit(0);}
const hub=(await readFile('CommunityHub.tsx','utf8')).replaceAll("'./BallKnowerContext'","'./__community-fixture'").replaceAll("'./communityCloud'","'./__community-fixture'").replaceAll("'./progressionCloud'","'./__community-fixture'").replaceAll("'./CommunitySafety'","'./__community-safety'");
await writeFile('__community-hub.tsx',hub);
await writeFile('__community-safety.tsx',(await readFile('CommunitySafety.tsx','utf8')).replaceAll("'./BallKnowerContext'","'./__community-fixture'").replaceAll("'./supabase'","'./__community-fixture'"));
await writeFile('__community-preview.html','<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><div id="root"></div><script type="module" src="/__community-preview.tsx"></script></body></html>');
await writeFile('__community-preview.tsx',`import React from 'react';import{createRoot}from'react-dom/client';import{CommunityHub}from'./__community-hub';import './index.css';createRoot(document.getElementById('root')!).render(<CommunityHub onOpenAuth={()=>{}} onOpenTrivia={()=>{}} onViewLocker={()=>{}}/>);`);
await writeFile('__community-fixture.ts',`
export type * from './communityCloud';
const me='00000000-0000-4000-8000-000000000001';const a='00000000-0000-4000-8000-000000000002';const b='00000000-0000-4000-8000-000000000003';
const user=new URLSearchParams(location.search).has('guest')?null:{id:me,name:'Eli',isAnonymous:false};
export const useBallKnower=()=>({currentUser:user,showToast:(message:string)=>{document.getElementById('fixture-toast')?.remove();const el=document.createElement('p');el.id='fixture-toast';el.textContent=message;document.body.append(el);}});
const person=(id:string,name:string,rank=1)=>({userId:id,displayName:name,bkRating:97-rank,h2hRating:1200,h2hWins:12,h2hLosses:4,h2hTies:1,rank,level:8});
let home={leaderboard:[person(a,'Gridiron Guru'),person(me,'Eli',2),person(b,'Fourth Down Club',3)],friends:[{...person(a,'Gridiron Guru'),friendshipId:'friend-a',status:'accepted',direction:'outgoing'},{...person(b,'Fourth Down Club'),friendshipId:'friend-b',status:'accepted',direction:'incoming'},{...person('00000000-0000-4000-8000-000000000004','Sunday Scout'),friendshipId:'friend-c',status:'pending',direction:'incoming'}],matches:[] as any[]};
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));let blocks:string[]=[];let messages=[{id:'msg-a',authorId:a,displayName:'Gridiron Guru',body:'Who are you starting this week? That fourth-quarter comeback was wild.',createdAt:new Date().toISOString()},{id:'msg-b',authorId:me,displayName:'Eli',body:'I like the matchup. Time to prove who knows ball.',createdAt:new Date().toISOString()}];
export const fetchProgressionProfile=async()=>({});
export const fetchCommunityHome=async(readOnly=false)=>{await delay(100);return structuredClone(readOnly?{...home,friends:[],matches:[]}:home);};
export const searchCommunityUsers=async(query:string)=>home.leaderboard.filter(p=>p.userId!==me&&p.displayName.toLowerCase().includes(query.toLowerCase())).map(p=>({...p,isFriend:false,requestPending:false}));
export const fetchGlobalMessages=async()=>{await delay(100);return [...messages];};
export const postGlobalMessage=async(body:string)=>{messages.push({id:'fixture-'+Date.now(),authorId:me,displayName:'Eli',body,createdAt:new Date().toISOString()});};
export const fetchDirectMessages=async(id:string)=>{await delay(id===a?1800:100);return [{id:'dm-'+id,authorId:id,body:id===a?'GRIDIRON PRIVATE MESSAGE':'FOURTH DOWN PRIVATE MESSAGE',createdAt:new Date().toISOString()}];};
export const sendDirectMessage=async()=>{};
export const sendFriendRequest=async()=>{};
export const respondFriendRequest=async(id:string,accept:boolean)=>{home.friends=home.friends.filter(f=>f.friendshipId!==id||accept).map(f=>f.friendshipId===id?{...f,status:'accepted'}:f);};
export const removeFriend=async(id:string)=>{home.friends=home.friends.filter(f=>f.friendshipId!==id);};
export const startH2H=async(opponent?:string)=>{const match={id:'fixture-match',challengerId:me,opponentId:opponent,challengerName:'Eli',opponentName:'Gridiron Guru',matchType:opponent?'friend':'quick',status:opponent?'pending':'waiting',durationSeconds:60,challengerScore:0,opponentScore:0,createdAt:new Date().toISOString(),questions:[]};home.matches=[match];return match.id;};
export const fetchH2HMatch=async()=>structuredClone(home.matches[0]);
export const cancelH2H=async()=>{home.matches[0].status='cancelled';};
export const respondH2H=async()=>{};export const finishH2H=async()=>home.matches[0];export const submitH2HAnswer=async()=>({isCorrect:true});
export const subscribeCommunity=(_kind:string,fn:()=>void)=>{const timer=setInterval(fn,3000);return()=>clearInterval(timer);};
const response=(data:any)=>({abortSignal:async()=>({data,error:null})});
export const supabase={auth:{getSession:async()=>({data:{session:{user:{id:me}}}})},from:()=>({select:()=>({eq:()=>response(blocks.map(blocked_id=>({blocked_id})))})}),rpc:(_name:string,args:any)=>{if(_name==='set_ball_knower_community_block')blocks=args.p_blocked?[...blocks,args.p_user_id]:blocks.filter(id=>id!==args.p_user_id);return response(null);}};
`);
console.log('Local fixture preview ready at /__community-preview.html. No production requests.');

await writeFile('__community-mobile.html',`<!doctype html><html><body style="margin:0;background:#20242d;display:flex;justify-content:center"><iframe title="Mobile Community" src="/__community-preview.html?guest=1" style="width:320px;height:844px;border:0;max-width:100%"></iframe></body></html>`);
