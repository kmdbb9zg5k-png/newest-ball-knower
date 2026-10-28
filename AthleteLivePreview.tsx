import React from 'react';
import type {AthleteBuild} from './athleteBuild';
import {SKIN_TONES,HAIR_COLORS,sanitizeAthleteAppearance,type AthleteAppearance} from './athleteAppearance';

type PreviewProfile=AthleteBuild&AthleteAppearance&{name:string;number:number};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const feetAndInches=(inches:number)=>`${Math.floor(inches/12)}'${inches%12}\"`;

function Hair({style,color}:{style:string;color:string}){
  if(style==='bald')return null;
  if(style==='shaved')return <path d="M94 73 Q120 48 146 73 L144 79 Q120 62 96 79Z" fill={color} opacity=".75"/>;
  if(['braids','cornrows','long twists','medium locs','long locs'].includes(style))return <g fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"><path d="M97 77 Q99 54 120 52 Q141 54 143 77" strokeWidth="10"/><path d="M101 69 Q92 88 96 111"/><path d="M112 59 Q105 87 109 114"/><path d="M128 59 Q135 87 131 114"/><path d="M139 69 Q148 88 144 111"/></g>;
  if(style.includes('curl')||style.includes('afro')||style.includes('twist')||style.includes('loc'))return <g fill={color}>{[[99,68,10],[108,58,11],[121,55,12],[134,59,11],[143,69,10],[103,78,9],[117,70,10],[132,72,10]].map(([cx,cy,r],index)=><circle key={index} cx={cx} cy={cy} r={r}/>)}</g>;
  return <path d="M94 77 Q97 48 120 47 Q145 49 147 77 Q134 65 120 65 Q106 65 94 77Z" fill={color}/>;
}

function TattooMarks({appearance}:{appearance:AthleteAppearance}){
  if(appearance.tattooCoverage==='none')return null;
  const both=appearance.tattooCoverage==='both-arms';
  const forearm=['forearm','half-sleeve','full-sleeve','both-arms'].includes(appearance.tattooCoverage);
  const upper=['minimal','upper-arm','half-sleeve','full-sleeve','both-arms'].includes(appearance.tattooCoverage);
  const style=appearance.tattooStyle;
  const marks=(flip=1)=> <g transform={flip===-1?'translate(240 0) scale(-1 1)':undefined} fill="none" stroke="#171717" strokeWidth={style==='blackwork'?5:2.8} strokeLinecap="round" strokeLinejoin="round" opacity=".88">
    {upper&&<><path d={style==='script'?'M75 148 q-18 7-8 18t-10 16':style==='traditional'?'M72 148 l-7 10-10 1 7 8-3 11 10-6 9 6-2-11 8-8-11-1Z':'M74 147 l-14 12 12 9-15 12'}/><path d={style==='blackwork'?'M69 153 57 177M75 158 61 183':style==='geometric'?'M64 153 l10 12-14 10 11 9':'M62 158 q9 5 12 16'}/></>}
    {forearm&&<><path d={style==='script'?'M58 191 q-13 9-3 17t-7 14':style==='traditional'?'M58 193 q-12 8-3 17q9 7-4 14':'M59 190 l-10 13 10 9-11 11'}/><path d={style==='blackwork'?'M57 196 49 221M62 201 53 225':style==='geometric'?'M52 196 l10 11-13 9':'M50 207 q8 3 11 12'}/></>}
  </g>;
  return <>{marks(1)}{both?marks(-1):null}</>;
}

export default function AthleteLivePreview({profile}:{profile:PreviewProfile}){
  const appearance=sanitizeAthleteAppearance(profile);
  const skin=SKIN_TONES.find(item=>item.id===appearance.skinTone)?.color||'#ae764e';
  const hair=HAIR_COLORS.find(item=>item.id===appearance.hairColor)?.color||'#14100e';
  const shoulder=clamp(70+profile.shoulderWidth*.36,70,106),torso=clamp(56+profile.bodyBuild*.3+(profile.weightLbs-190)*.08,55,104);
  const arm=clamp(11+profile.armSize*.09,11,20),leg=clamp(16+profile.legSize*.1+(profile.weightLbs-190)*.025,15,28);
  const heightScale=clamp(.9+(profile.heightInches-66)*.014,.9,1.12),widthScale=clamp(.9+(profile.weightLbs-170)*.0015,.9,1.18);
  const torsoLeft=120-torso/2,torsoRight=120+torso/2,shoulderLeft=120-shoulder/2,shoulderRight=120+shoulder/2;
  return <figure className="bk-athlete-live-preview" aria-label={`${profile.name||'Created athlete'} full-body live preview`} data-athlete-live-preview="true" data-skin-tone={appearance.skinTone} data-hair-style={appearance.hairStyle} data-tattoo-coverage={appearance.tattooCoverage} data-arm-size={profile.armSize} data-shoulder-width={profile.shoulderWidth} data-leg-size={profile.legSize}>
    <figcaption>FULL-BODY LIVE BUILD</figcaption>
    <svg viewBox="0 0 240 420" role="img" aria-label={`${profile.name||'Created athlete'} standing with hands at waist`}>
      <ellipse cx="120" cy="399" rx="73" ry="11" fill="#000" opacity=".45"/>
      <g style={{transform:`translateY(${(1-heightScale)*360}px) scale(${widthScale},${heightScale})`,transformOrigin:'120px 395px',transition:'transform 160ms ease-out'}}>
        <path d={`M${120-leg-3} 267 L${116-leg/2} 376 Q${115-leg/2} 392 ${95-leg/2} 392 L${82-leg/2} 388 Q${79-leg/2} 381 ${91-leg/2} 374 L${91-leg/2} 267Z`} fill="#151b25" stroke="#30394a" strokeWidth="2"/>
        <path d={`M${120+leg+3} 267 L${124+leg/2} 376 Q${125+leg/2} 392 ${145+leg/2} 392 L${158+leg/2} 388 Q${161+leg/2} 381 ${149+leg/2} 374 L${149+leg/2} 267Z`} fill="#151b25" stroke="#30394a" strokeWidth="2"/>
        <path d={`M${torsoLeft-4} 220 Q${120-torso*.44} 267 ${120-leg-5} 286 L${120+leg+5} 286 Q${120+torso*.44} 267 ${torsoRight+4} 220Z`} fill="#d1aa39"/>
        <path d={`M${shoulderLeft} 133 Q120 113 ${shoulderRight} 133 L${torsoRight+5} 231 Q120 246 ${torsoLeft-5} 231Z`} fill="#162733" stroke="#42616d" strokeWidth="2"/>
        <path d={`M${shoulderLeft+5} 137 Q${shoulderLeft-10} 148 ${shoulderLeft-14} 169 L${shoulderLeft-25} 210 Q${shoulderLeft-27} 223 ${torsoLeft+1} 230`} fill="none" stroke={skin} strokeWidth={arm} strokeLinecap="round" strokeLinejoin="round"/>
        <path d={`M${shoulderRight-5} 137 Q${shoulderRight+10} 148 ${shoulderRight+14} 169 L${shoulderRight+25} 210 Q${shoulderRight+27} 223 ${torsoRight-1} 230`} fill="none" stroke={skin} strokeWidth={arm} strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx={torsoLeft+2} cy="229" r={arm*.58} fill={skin}/><circle cx={torsoRight-2} cy="229" r={arm*.58} fill={skin}/>
        <TattooMarks appearance={appearance}/>
        <path d="M102 124 Q120 139 138 124 L137 148 Q120 158 103 148Z" fill={skin}/>
        <rect x="95" y="69" width="50" height="62" rx="24" fill={skin}/>
        <Hair style={appearance.hairStyle} color={hair}/>
        <path d="M105 96 q6-5 12 0M123 96 q6-5 12 0" fill="none" stroke="#211812" strokeWidth="2" strokeLinecap="round"/>
        <path d="M116 112 q4 3 8 0" fill="none" stroke="#5a2f28" strokeWidth="2" strokeLinecap="round"/>
        {appearance.facialHair!=='clean shaven'?<path d="M105 108 Q120 133 135 108 Q133 132 120 136 Q107 132 105 108Z" fill={hair} opacity={appearance.facialHair.includes('stubble')?'.36':'.9'}/>:null}
        <text x="120" y="190" textAnchor="middle" fill="#f4d46d" fontSize="38" fontWeight="900" fontFamily="ui-sans-serif,system-ui">{Math.max(0,Math.min(99,Math.round(profile.number)))}</text>
        <path d={`M${shoulderLeft+3} 133 Q120 115 ${shoulderRight-3} 133`} fill="none" stroke="#d1aa39" strokeWidth="5"/>
      </g>
    </svg>
    <span className="bk-athlete-preview-size">{feetAndInches(profile.heightInches)} · {profile.weightLbs} LB</span>
    <span className="bk-athlete-preview-pose">HANDS AT WAIST</span>
  </figure>;
}
