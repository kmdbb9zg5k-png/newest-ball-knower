import React,{useEffect,useId,useMemo,useState} from 'react';
import {ModalPortal} from '../ModalPortal';
import {Appearance,BodyBuild,EYE_BLACK_COUNT,FACE_COUNT,FACIAL_HAIR_COUNT,GloveStyle,HAIR_COUNT,saveAppearance,SleeveStyle,UniformVariant,uniformFor,playerAttributes} from './appearance';
import {SoloCharacter,SoloPlayerRecord,SoloPortrait,useAppearance} from './SoloPresentation';

type Tab='overview'|'stats'|'game-log'|'development'|'appearance';
const TABS:Array<[Tab,string]>=[['overview','Overview'],['stats','Stats'],['game-log','Game log'],['development','Development'],['appearance','Edit player']];
const STATS:Record<string,string>={passYds:'Pass yards',passTD:'Pass TD',interceptions:'Interceptions',rushYds:'Rush yards',rushTD:'Rush TD',receptions:'Receptions',recYds:'Receiving yards',recTD:'Receiving TD',tackles:'Tackles',sacks:'Sacks',picks:'Def. interceptions',fgMade:'FG made',fgAtt:'FG attempts',puntsInside20:'Punts inside 20',fantasyScore:'Sim points'};
const sameLook=(a:Appearance,b:Appearance)=>a.face===b.face&&a.hair===b.hair&&a.facialHair===b.facialHair&&a.eyeBlack===b.eyeBlack&&a.build===b.build&&a.number===b.number&&a.sleeves===b.sleeves&&a.gloves===b.gloves;

export default function SoloPlayerProfile({record,onClose}:{record:SoloPlayerRecord;onClose:()=>void}) {
  const {player,logs,development}=record;
  const saved=useAppearance(player);
  const [draft,setDraft]=useState<Appearance>(saved);
  const [tab,setTab]=useState<Tab>('overview');
  const [variant,setVariant]=useState<UniformVariant>('home');
  const [message,setMessage]=useState('');
  const [discard,setDiscard]=useState(false);
  const [showHelmet,setShowHelmet]=useState(false);
  const id=useId();
  const dirty=!sameLook(saved,draft);
  const kit=uniformFor(player,variant);
  const attributes=useMemo(()=>playerAttributes(player),[player]);
  const close=()=>{if(dirty){setDiscard(true);return;}onClose();};
  useEffect(()=>{
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(dirty)setDiscard(true);else onClose();}};
    document.addEventListener('keydown',escape);
    return()=>document.removeEventListener('keydown',escape);
  },[dirty,onClose]);
  const save=()=>{
    if(!saveAppearance(player,draft)){setMessage('Your changes could not be saved on this device. Your previous appearance is safe.');return;}
    setMessage('Appearance saved. Ratings and career progress are unchanged.');setDiscard(false);
  };
  const first=player.name.trim().split(/\s+/)[0]||player.name;
  const last=player.name.trim().split(/\s+/).slice(1).join(' ');
  const statKeys=Object.keys(STATS).filter(key=>logs?.some(line=>typeof (line as unknown as Record<string,unknown>)[key]==='number'));
  const totals=statKeys.map(key=>({key,label:STATS[key],value:logs!.reduce((sum,line)=>sum+Number((line as unknown as Record<string,unknown>)[key]??0),0)}));
  return <ModalPortal><div className="bk-solo-profile-overlay" onClick={event=>{if(event.target===event.currentTarget)close();}}>
    <section className="bk-solo-profile" role="dialog" aria-modal="true" aria-labelledby={`${id}-name`} style={{'--solo-kit':kit.jersey,'--solo-trim':kit.trim} as React.CSSProperties}>
      <header className="bk-solo-profile-top"><button type="button" onClick={close} aria-label="Close player profile">← <span>Back</span></button><span>PLAYER PROFILE</span><span className="bk-solo-fictional-label">SIMULATED</span></header>
      <div className="bk-solo-profile-scroll">
        <div className="bk-solo-profile-hero">
          <div className="bk-solo-hero-art"><SoloCharacter player={player} look={saved} variant={variant}/></div>
          <div className="bk-solo-profile-heading"><div className="bk-solo-hero-position">{player.position} <span>#{saved.number}</span></div>
            <h1 id={`${id}-name`}><span>{first}</span>{last&&<strong>{last}</strong>}</h1>
            <p className="bk-solo-team-title">{kit.name}</p>
            <dl className="bk-solo-player-facts">
              {typeof player.age==='number'&&<><dt>Age</dt><dd>{player.age}</dd></>}
              {typeof player.experience==='number'&&<><dt>Experience</dt><dd>{player.experience===0?'Rookie':`${player.experience} years`}</dd></>}
              <dt>Position</dt><dd>{player.position}</dd>
              {Number.isFinite(player.salary)&&<><dt>Salary</dt><dd>${player.salary.toFixed(1)}M{player.salaryType==='estimated'?' est.':''}</dd></>}
            </dl>
          </div>
          <div className="bk-solo-overall"><strong>{player.ovr}</strong><span>OVR</span></div>
        </div>
        <div className="bk-solo-profile-tabs" role="tablist" aria-label="Player information" onKeyDown={event=>{
          if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
          event.preventDefault();const index=TABS.findIndex(([key])=>key===tab);
          const next=event.key==='Home'?0:event.key==='End'?TABS.length-1:(index+(event.key==='ArrowRight'?1:-1)+TABS.length)%TABS.length;
          setTab(TABS[next][0]);event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
        }}>{TABS.map(([key,label])=><button key={key} id={`${id}-${key}`} type="button" role="tab" tabIndex={tab===key?0:-1} aria-selected={tab===key} aria-controls={`${id}-panel`} onClick={()=>setTab(key)}>{label}</button>)}</div>
        <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} className="bk-solo-profile-panel">
          {tab==='overview'&&<>
            <h2>Player attributes</h2><div className="bk-solo-attribute-grid">{attributes.slice(0,4).map(attribute=><div key={attribute.key}><strong>{attribute.value}</strong><span>{attribute.label}</span></div>)}</div>
            <section className="bk-solo-profile-section"><h2>Scouting profile</h2><p>{player.archetype&&player.archetype!=='Simulated pro player'?player.archetype:`${player.position} · ${player.ovr} overall in the Ball Knower simulated universe.`}</p>
              <p className="bk-solo-muted">{player.ratingExplanation||'Attributes below come from this player’s current career record. Appearance changes do not change performance.'}</p>
            </section>
            <section className="bk-solo-profile-section"><h2>Uniform preview</h2><UniformSwitch value={variant} onChange={setVariant}/><div className="bk-solo-uniform-showcase"><SoloCharacter player={player} look={saved} variant={variant} helmet={showHelmet}/><div><span className="bk-solo-eyebrow">{kit.abbr} / {variant.toUpperCase()}</span><h3>{kit.name}</h3><p>Same player. Team-specific kit.</p><button type="button" className="bk-solo-secondary" aria-pressed={showHelmet} onClick={()=>setShowHelmet(value=>!value)}>{showHelmet?'Show face':'Show helmet'}</button><button type="button" className="bk-solo-secondary" onClick={()=>setTab('appearance')}>Edit appearance</button></div></div></section>
          </>}
          {tab==='stats'&&<><h2>Recorded season totals</h2>{totals.length?<><p className="bk-solo-muted">{logs?.length} recorded player game{logs?.length===1?'':'s'} in the current career season. Simulated, not live NFL statistics.</p><div className="bk-solo-totals">{totals.map(stat=><div key={stat.key}><span>{stat.label}</span><strong>{Number.isInteger(stat.value)?stat.value:stat.value.toFixed(1)}</strong></div>)}</div></>:<Empty title="No recorded statistics yet" detail="This view has no recorded game lines for this player. Unavailable statistics are not shown as zero."/>}</>}
          {tab==='game-log'&&<><h2>Player game log</h2>{logs?.length?<div className="bk-solo-game-log">{[...logs].reverse().map((line,index)=><article key={`${line.year??'season'}-${line.week}-${index}`}><header><strong>{line.year?`${line.year} · `:''}Week {line.week}</strong><span className={line.won?'is-win':''}>{line.won?'WIN':'LOSS'}</span></header><p>{line.opponent}</p><div>{statKeys.filter(key=>typeof (line as unknown as Record<string,unknown>)[key]==='number').map(key=><span key={key}><b>{String((line as unknown as Record<string,unknown>)[key])}</b> {STATS[key]}</span>)}</div></article>)}</div>:<Empty title="No game log available" detail="Recorded games appear here when this career supplies a player stat line. Your existing season schedule remains in the career screen."/>}</>}
          {tab==='development'&&<><h2>Player development</h2>{development?<section className="bk-solo-development"><div><strong>{development.upgradePoints}</strong><span>AVAILABLE POINTS</span></div><label>Experience <b>{development.xp}/100 XP</b><progress max="100" value={Math.max(0,Math.min(100,development.xp))}/></label><p>Morale <b>{development.morale}</b></p><p className="bk-solo-muted">Spend upgrade points using the career’s existing Physical, Awareness and Position controls. Opening this profile does not spend a point.</p></section>:<p className="bk-solo-muted">This career has not supplied a development record for this player.</p>}<h2>Current ratings</h2><div className="bk-solo-rating-list">{attributes.map(attribute=><div key={attribute.key}><span>{attribute.label}</span><strong>{attribute.value}</strong><i aria-hidden="true" style={{width:`${Math.max(0,Math.min(100,attribute.value))}%`}}/></div>)}</div></>}
          {tab==='appearance'&&<><h2>Edit player appearance</h2><p className="bk-solo-muted">Saved on this device. Face, hair, build and gear are cosmetic only; ratings, contracts and career progress stay untouched.</p><UniformSwitch value={variant} onChange={setVariant}/><div className="bk-solo-editor-layout"><div className="bk-solo-editor-model"><SoloCharacter player={player} look={draft} variant={variant}/></div><div className="bk-solo-editor-controls">
            <fieldset><legend>Face</legend><div className="bk-solo-face-picker">{Array.from({length:FACE_COUNT},(_,face)=><button key={face} type="button" aria-label={`Face ${face+1}`} aria-pressed={draft.face===face} onClick={()=>{setDraft(value=>({...value,face}));setMessage('');}}><SoloPortrait player={player} face={face}/></button>)}</div></fieldset>
            <fieldset><legend>Hair</legend><div className="bk-solo-choice-stack">{Array.from({length:HAIR_COUNT},(_,hair)=><button key={hair} type="button" aria-pressed={draft.hair===hair} onClick={()=>setDraft(value=>({...value,hair}))}>Style {hair+1}</button>)}</div></fieldset>
            <fieldset><legend>Facial hair</legend><div className="bk-solo-choice-stack">{Array.from({length:FACIAL_HAIR_COUNT},(_,facialHair)=><button key={facialHair} type="button" aria-pressed={draft.facialHair===facialHair} onClick={()=>setDraft(value=>({...value,facialHair}))}>{facialHair===0?'Clean':`Style ${facialHair}`}</button>)}</div></fieldset>
            <fieldset><legend>Eye black</legend><div className="bk-solo-choice-stack">{Array.from({length:EYE_BLACK_COUNT},(_,eyeBlack)=><button key={eyeBlack} type="button" aria-pressed={draft.eyeBlack===eyeBlack} onClick={()=>setDraft(value=>({...value,eyeBlack}))}>{eyeBlack===0?'None':`Style ${eyeBlack}`}</button>)}</div></fieldset>
            <fieldset><legend>Body build</legend><div className="bk-solo-choice-stack">{(['lean','athletic','power','heavy'] as BodyBuild[]).map(build=><button key={build} type="button" aria-pressed={draft.build===build} onClick={()=>setDraft(value=>({...value,build}))}>{build}</button>)}</div></fieldset>
            <label className="bk-solo-number-label">Jersey number<input aria-label="Jersey number" inputMode="numeric" type="number" min="0" max="99" step="1" value={draft.number} onChange={event=>{const number=Number(event.target.value);if(Number.isInteger(number)&&number>=0&&number<=99)setDraft(value=>({...value,number}));}}/></label>
            <fieldset><legend>Arm gear</legend><div className="bk-solo-choice-stack">{(['none','right','left','both'] as SleeveStyle[]).map(sleeves=><button key={sleeves} type="button" aria-pressed={draft.sleeves===sleeves} onClick={()=>setDraft(value=>({...value,sleeves}))}>{sleeves}</button>)}</div></fieldset>
            <fieldset><legend>Gloves</legend><div className="bk-solo-choice-stack">{(['none','light','dark'] as GloveStyle[]).map(gloves=><button key={gloves} type="button" aria-pressed={draft.gloves===gloves} onClick={()=>setDraft(value=>({...value,gloves}))}>{gloves}</button>)}</div></fieldset>
          </div></div></>}
        </div>
        <footer className="bk-solo-player-disclaimer">BALL KNOWER LEAGUE · FICTIONAL PLAYER</footer>
      </div>
      {(tab==='appearance'||dirty||discard||message)&&<div className="bk-solo-profile-save">
        {message&&<p role="status">{message}</p>}
        {discard?<div role="alert"><p>You have unsaved appearance changes.</p><div className="bk-solo-save-actions"><button type="button" className="bk-solo-secondary" onClick={()=>setDiscard(false)}>Keep editing</button><button type="button" className="bk-solo-secondary" onClick={onClose}>Discard changes</button></div></div>:<div className="bk-solo-save-actions"><button type="button" className="bk-solo-secondary" disabled={!dirty} onClick={()=>{setDraft(saved);setMessage('');}}>Reset edits</button><button type="button" className="bk-solo-primary" disabled={!dirty} onClick={save}>Save changes</button></div>}
      </div>}
    </section>
  </div></ModalPortal>;
}

function UniformSwitch({value,onChange}:{value:UniformVariant;onChange:(value:UniformVariant)=>void}) {
  return <div className="bk-solo-uniform-switch" role="group" aria-label="Uniform variant">{(['home','away','alternate'] as const).map(variant=><button key={variant} type="button" aria-pressed={value===variant} onClick={()=>onChange(variant)}>{variant}</button>)}</div>;
}
function Empty({title,detail}:{title:string;detail:string}){return <div className="bk-solo-empty"><h3>{title}</h3><p>{detail}</p></div>;}
