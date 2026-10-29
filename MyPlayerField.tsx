import {careerAthleteIdentity} from './athletePassport';
import React,{lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import {combineAthlete} from './combine/dash.js';
import {careerFieldAssignment,careerFieldScore,careerFieldSeed,careerFieldReview} from './myPlayerField';
import type {AthleteProfile} from './MyPlayerCareer';
import './careerFieldPresentation.css';
const Receiver=lazy(()=>import('./combine/RouteExperience'));
const Runner=lazy(()=>import('./combine/RBExperience'));
const Coverage=lazy(()=>import('./combine/DBExperience'));
class FieldError extends React.Component<{children:React.ReactNode;onClose:()=>void},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true};}render(){return this.state.failed?<div className="career-field-loading" role="alert"><h2>The field could not load.</h2><p>Your career score has not changed. Reopen the field or use the tactical assignment.</p><button onClick={this.props.onClose}>Back to career</button></div>:this.props.children;}}
export function CareerField({profile,weekKey,opponent,onComplete,onClose}:{profile:AthleteProfile;weekKey:string;opponent:string;onComplete:(score:number)=>void;onClose:()=>void}){
 const assignment=careerFieldAssignment(profile.position)!;
 const dialog=useRef<HTMLDialogElement>(null),frame=useRef<HTMLIFrameElement>(null),locked=useRef(false);
 const [result,setResult]=useState<{score:number;stats:Record<string,number>}|null>(null),[error,setError]=useState('');
 const [token]=useState(()=>crypto.randomUUID());
 const resultHeading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{if(result)resultHeading.current?.focus();},[result]);
 const callbacks=useRef({onComplete,onClose});callbacks.current={onComplete,onClose};
 const seed=careerFieldSeed(profile.combineId||profile.name,weekKey),id=`career:${weekKey}`;
 const athlete=useMemo(()=>{const identity=careerAthleteIdentity(profile);return{...combineAthlete({id:'my-player-user',name:profile.name,position:profile.position,speed:profile.speed,grade:profile.overall}),...identity.build,jerseyNumber:profile.number,cosmeticIdentityId:`my-player-${identity.id}`,athleteAppearance:identity.appearance,careerStrength:profile.power};},[profile]);
 const finish=(stats:Record<string,number>)=>{if(locked.current)return;const score=careerFieldScore(assignment.kind,stats);if(score===undefined){setError('The session did not return a complete result. Exit and try again; no score was saved.');return;}locked.current=true;setResult({score,stats});callbacks.current.onComplete(score);};
 const receiveResult=useRef(finish);receiveResult.current=finish;
 useEffect(()=>{dialog.current?.showModal();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';const receive=(event:MessageEvent)=>{if(event.origin!==location.origin||event.source!==frame.current?.contentWindow||event.data?.challengeId!==id||event.data?.token!==token)return;if(event.data.type==='bk-mini-exit')callbacks.current.onClose();if(event.data.type==='bk-mini-result')receiveResult.current(event.data.stats);};window.addEventListener('message',receive);return()=>{document.body.style.overflow=overflow;window.removeEventListener('message',receive);};},[id,token]);
 const params=new URLSearchParams({mode:'two-minute',difficulty:'pro',team:'JCY',opponent:'BRK',seed:String(seed),bkChallenge:id,bkToken:token});
 const config={seed,title:assignment.title,opponent:`Preparation for ${opponent}`};
 const review=result?careerFieldReview(assignment.kind,result.stats):undefined;
 return createPortal(<dialog ref={dialog} className="career-field-modal" aria-label="3D career assignment" onCancel={e=>{e.preventDefault();onClose();}}><header><div><span>MY PLAYER / {assignment.kind==='drive'?'TEAM SHOWCASE':'POSITION SHOWCASE'}</span><strong>{assignment.title}</strong></div><button aria-label="Exit 3D assignment" onClick={onClose}><X/></button></header>{error?<div className="career-field-loading" role="alert"><p>{error}</p><button onClick={onClose}>Back to career</button></div>:result?<section className="career-field-result career-tape-review" data-band={review?.band} aria-label="Position performance review"><span className="career-eyebrow">PERFORMANCE SUBMITTED</span><p className="career-tape-position">{review?.focus}</p><h2>{result.score}<small>/100</small></h2><h3 ref={resultHeading} tabIndex={-1}>{review?.headline}</h3><p>{review?.summary}</p><dl className="career-tape-metrics">{review?.metrics.map(metric=><div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}</dl><div className="career-tape-coach"><span>NEXT SESSION / COACH’S FOCUS</span><p>{review?.cue}</p></div><details><summary>How this raw evaluation is calculated</summary><p>{review?.formula}</p></details><p>Your first completed result is locked. Preparation and fatigue adjust the saved evaluation. Resolve your scheduled game to see coach feedback and career news.</p><button className="career-primary" onClick={onClose}>RETURN TO MY CAREER</button></section>:<FieldError onClose={onClose}><Suspense fallback={<div className="career-field-loading" role="status">Preparing the 3D field…</div>}><div className="career-field-stage">{assignment.kind==='drive'?<iframe ref={frame} title="Two-minute career showcase" src={`/play-moment-3d-preview.html?${params}`} allow="fullscreen; autoplay" onError={()=>setError('The showcase could not load. Exit and try the tactical assignment.')}/>:assignment.kind==='receiver'?<Receiver players={[athlete]} man career={config} onClose={onClose} onResult={finish}/>:assignment.kind==='rb'?<Runner players={[athlete]} career={config} onClose={onClose} onResult={finish}/>:<Coverage players={[athlete]} career={config} onClose={onClose} onResult={finish}/>}</div></Suspense></FieldError>}</dialog>,document.body);
}
