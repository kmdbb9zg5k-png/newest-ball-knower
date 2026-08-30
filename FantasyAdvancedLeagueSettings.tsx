import React, { useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useBallKnower } from './BallKnowerContext';
import { League, LeagueSettings } from './types';
import { commissionerEditMatchup, commissionerSetWaiverPriority } from './fantasyLeagueParityCloud';

type Props={league:League;disabled?:boolean};
const option=(value:string,label:string)=>[value,label] as const;

export const FantasyAdvancedLeagueSettings:React.FC<Props>=({league,disabled=false})=>{
  const {updateLeagueSettings,showToast}=useBallKnower();
  const settings=league.settings||{};
  const effectiveRegularSeasonWeeks=Math.max(13,Math.min(17,Number(settings.regularSeasonWeeks??settings.seasonGames)||17));
  const scheduleLocked=Boolean(league.seasonResult?.games?.some(game=>!game.playoffRound));
  const scoringLocked=Boolean(settings.fantasySeasonStarted)||Number(settings.currentWeek||1)>1;
  const postseasonLocked=Number(settings.currentWeek||1)>effectiveRegularSeasonWeeks||Boolean(league.seasonResult?.games?.some(game=>game.playoffRound&&(Boolean(game.winnerId)||Number(game.homeScore||0)!==0||Number(game.awayScore||0)!==0)));
  const [open,setOpen]=useState(false);
  const update=(patch:LeagueSettings)=>{if(!disabled)updateLeagueSettings(league.id,patch);};
  return <div className="rounded-xl border border-white/10 bg-black/20 p-3">
    <button type="button" onClick={()=>setOpen(value=>!value)} className="flex min-h-11 w-full items-center gap-2 text-left text-[10px] font-black uppercase tracking-wider text-[#D4AF37]"><SlidersHorizontal className="h-4 w-4"/>Advanced League Settings<ChevronDown className={`ml-auto h-4 w-4 transition ${open?'rotate-180':''}`}/></button>
    {open&&<div className="space-y-3 border-t border-white/10 pt-3">
      <p className="text-[10px] leading-4 text-zinc-500">The default remains nine required starters plus six bench spots. Custom bench depth never adds OL, DL, IDP or NFL salary-cap rules.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Select label="Scoring" value={settings.scoringFormat||'ppr'} disabled={disabled||scoringLocked} options={[option('ppr','Full PPR'),option('half_ppr','Half PPR'),option('standard','Standard')]} onChange={value=>update({scoringFormat:value as LeagueSettings['scoringFormat']})}/>
        <Select label="Regular Season" value={String(effectiveRegularSeasonWeeks)} disabled={disabled||scheduleLocked} options={[13,14,15,16].filter(value=>value+(settings.playoffTeams===4?2:3)<=18).map(value=>option(String(value),`${value} Weeks`))} onChange={value=>update({regularSeasonWeeks:Number(value) as LeagueSettings['regularSeasonWeeks']})}/>
        <Select label="Playoffs" value={String(settings.playoffTeams||6)} disabled={disabled||postseasonLocked} options={[4,6,8].filter(value=>value<=league.maxMembers).map(value=>option(String(value),`${value} Teams`))} onChange={value=>{const teams=Number(value) as LeagueSettings['playoffTeams'];update({playoffTeams:teams,regularSeasonWeeks:Math.min(effectiveRegularSeasonWeeks,18-(teams===4?2:3)) as LeagueSettings['regularSeasonWeeks']});}}/>
        <Select label="Seeding" value={settings.playoffSeeding||'record_points'} disabled={disabled||postseasonLocked} options={[option('record_points','Record → Points'),option('record_head_to_head','Record → H2H'),option('division_winners','Division Winners')]} onChange={value=>update({playoffSeeding:value as LeagueSettings['playoffSeeding']})}/>
        <Select label="Trade Review" value={settings.tradeReview||'commissioner'} disabled={disabled} options={[option('none','None'),option('commissioner','Commissioner'),option('league_vote','League Vote')]} onChange={value=>update({tradeReview:value as LeagueSettings['tradeReview']})}/>
        <Select label="Waiver Type" value={settings.waiverType||'priority'} disabled={disabled} options={[option('priority','Rolling Priority'),option('faab','FAAB')]} onChange={value=>update({waiverType:value as LeagueSettings['waiverType']})}/>
        <Select label="Free Agents" value={settings.freeAgentMode||'instant'} disabled={disabled} options={[option('instant','Instant Adds'),option('continuous','Continuous Waivers')]} onChange={value=>update({freeAgentMode:value as LeagueSettings['freeAgentMode']})}/>
        <Select label="Waiver Days" value={String(settings.waiverDays??2)} disabled={disabled} options={[0,1,2,3].map(value=>option(String(value),value===0?'Same Day':`${value} Day${value===1?'':'s'}`))} onChange={value=>update({waiverDays:Number(value)})}/>
        <Select label="Process Hour UTC" value={String(settings.waiverProcessHourUtc??9)} disabled={disabled} options={[1,5,9,13,17,21].map(value=>option(String(value),`${String(value).padStart(2,'0')}:00 UTC`))} onChange={value=>update({waiverProcessHourUtc:Number(value)})}/>
        <NumberSetting label="Bench Slots" value={settings.benchSlots??6} min={6} max={11} disabled={disabled||Boolean(league.liveDraft)} onCommit={value=>update({benchSlots:value,rosterSize:9+value})}/>
        <NumberSetting label="IR Slots" value={settings.irSlots??2} min={0} max={5} disabled={disabled} onCommit={value=>update({irSlots:value})}/>
        <NumberSetting label="Trade Deadline" value={settings.tradeDeadlineWeek??11} min={1} max={17} disabled={disabled} onCommit={value=>update({tradeDeadlineWeek:value})}/>
        <NumberSetting label="Max Adds / Week" value={settings.maxAcquisitionsPerWeek??0} min={0} max={99} disabled={disabled} onCommit={value=>update({maxAcquisitionsPerWeek:value||null})}/>
        <NumberSetting label="Max Adds / Season" value={settings.maxAcquisitionsPerSeason??0} min={0} max={999} disabled={disabled} onCommit={value=>update({maxAcquisitionsPerSeason:value||null})}/>
        <Select label="Divisions" value={settings.divisionsEnabled?String(settings.divisionCount||2):'off'} disabled={disabled||postseasonLocked} options={[option('off','Off'),option('2','2 Divisions'),option('4','4 Divisions')]} onChange={value=>update(value==='off'?{divisionsEnabled:false}:{divisionsEnabled:true,divisionCount:Number(value) as 2|4})}/>
      </div>
      <div className="rounded-xl border border-white/10 p-3"><div className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Custom scoring values</div><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"><ScoreInput label="Reception" value={settings.customScoring?.reception??(settings.scoringFormat==='standard'?0:settings.scoringFormat==='half_ppr'?0.5:1)} disabled={disabled||scoringLocked} onCommit={value=>update({customScoring:{...settings.customScoring,reception:value}})}/><ScoreInput label="Pass TD" value={settings.customScoring?.passTd??4} disabled={disabled||scoringLocked} onCommit={value=>update({customScoring:{...settings.customScoring,passTd:value}})}/><ScoreInput label="Rush TD" value={settings.customScoring?.rushTd??6} disabled={disabled||scoringLocked} onCommit={value=>update({customScoring:{...settings.customScoring,rushTd:value}})}/><ScoreInput label="Rec TD" value={settings.customScoring?.recTd??6} disabled={disabled||scoringLocked} onCommit={value=>update({customScoring:{...settings.customScoring,recTd:value}})}/></div></div>
      <CommissionerWaiverEditor league={league} disabled={disabled} onSaved={()=>showToast('Waiver priority updated.')}/>
      <CommissionerScheduleEditor league={league} disabled={disabled} onSaved={()=>showToast('Matchup updated.')}/>
      {!disabled&&<p className="text-[9px] leading-4 text-zinc-600">Co-commissioner assignment stays disabled until every privileged fantasy RPC uses the same staff authorization contract. Native iOS/Android push still requires device-token registration in the app shells; notification events are saved now.</p>}
    </div>}
  </div>;
};

const CommissionerWaiverEditor=({league,disabled,onSaved}:{league:League;disabled:boolean;onSaved:()=>void})=><details className="rounded-xl border border-white/10 p-3"><summary className="flex min-h-11 cursor-pointer items-center text-[9px] font-black uppercase text-zinc-400">Edit rolling waiver priority</summary><div className="mt-2 space-y-1">{[...league.members].sort((a,b)=>(a.waiverPriority||999)-(b.waiverPriority||999)).map(member=><div key={member.id} className="flex min-h-11 items-center gap-2 rounded-lg bg-black/25 px-3"><span className="min-w-0 flex-1 truncate text-xs font-bold">{member.userName}</span><input aria-label={`${member.userName} waiver priority`} type="number" min={1} max={league.members.length} defaultValue={member.waiverPriority||league.members.length} disabled={disabled} onBlur={event=>{void commissionerSetWaiverPriority(league.id,member.id,Number(event.target.value)).then(onSaved).catch(error=>window.alert(error instanceof Error?error.message:'Priority update failed'));}} className="min-h-10 w-20 rounded-lg bg-[#111] px-2 text-center text-xs"/></div>)}</div></details>;

const CommissionerScheduleEditor=({league,disabled,onSaved}:{league:League;disabled:boolean;onSaved:()=>void})=>{
  const games=(league.seasonResult?.games||[]).filter(game=>!game.playoffRound);
  const [gameId,setGameId]=useState(games[0]?.id||'');
  const selected=games.find(game=>game.id===gameId);
  const [home,setHome]=useState(selected?.homeMemberId||'');
  const [away,setAway]=useState(selected?.awayMemberId||'');
  if(!games.length)return null;
  const choose=(id:string)=>{const game=games.find(item=>item.id===id);setGameId(id);setHome(game?.homeMemberId||'');setAway(game?.awayMemberId||'');};
  return <details className="rounded-xl border border-white/10 p-3"><summary className="flex min-h-11 cursor-pointer items-center text-[9px] font-black uppercase text-zinc-400">Safely edit future matchups</summary><div className="mt-2 grid gap-2 sm:grid-cols-4"><select aria-label="Matchup to edit" value={gameId} onChange={event=>choose(event.target.value)} className="min-h-11 rounded-lg bg-[#111] px-2 text-xs">{games.map(game=><option key={game.id} value={game.id}>Week {game.week} · {game.id}</option>)}</select><MemberSelect label="Home manager" value={home} members={league.members} disabled={disabled} onChange={setHome}/><MemberSelect label="Away manager" value={away} members={league.members} disabled={disabled} onChange={setAway}/><button disabled={disabled||!selected||!home||!away||home===away} onClick={()=>{if(selected)void commissionerEditMatchup(league.id,selected.week,selected.id,home,away).then(onSaved).catch(error=>window.alert(error instanceof Error?error.message:'Matchup update failed'));}} className="min-h-11 rounded-lg bg-[#D4AF37] px-3 text-[9px] font-black uppercase text-black disabled:opacity-35">Save Matchup</button></div><p className="mt-2 text-[9px] text-zinc-600">Started, scored, final, and playoff matchups are locked against edits.</p></details>;
};

const MemberSelect=({label,value,members,onChange,disabled}:{label:string;value:string;members:League['members'];onChange:(value:string)=>void;disabled:boolean})=><select aria-label={label} value={value} disabled={disabled} onChange={event=>onChange(event.target.value)} className="min-h-11 rounded-lg bg-[#111] px-2 text-xs">{members.map(member=><option key={member.id} value={member.id}>{member.userName}</option>)}</select>;

const Select=({label,value,options,onChange,disabled}:{label:string;value:string;options:readonly (readonly [string,string])[];onChange:(value:string)=>void;disabled:boolean})=><label className="text-[8px] font-black uppercase text-zinc-500">{label}<select aria-label={label} disabled={disabled} value={value} onChange={event=>onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-[#111] px-2 text-[10px] font-bold text-white disabled:opacity-50">{options.map(([key,text])=><option key={key} value={key}>{text}</option>)}</select></label>;
const NumberSetting=({label,value,min,max,onCommit,disabled}:{label:string;value:number;min:number;max:number;onCommit:(value:number)=>void;disabled:boolean})=><label className="text-[8px] font-black uppercase text-zinc-500">{label}<input aria-label={label} disabled={disabled} type="number" defaultValue={value} min={min} max={max} onBlur={event=>onCommit(Math.max(min,Math.min(max,Number(event.target.value)||0)))} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-[#111] px-3 text-[10px] font-bold text-white disabled:opacity-50"/></label>;
const ScoreInput=({label,value,onCommit,disabled}:{label:string;value:number;onCommit:(value:number)=>void;disabled:boolean})=><label className="text-[8px] font-black uppercase text-zinc-500">{label}<input aria-label={`${label} points`} disabled={disabled} type="number" step="0.1" defaultValue={value} onBlur={event=>onCommit(Math.max(-10,Math.min(20,Number(event.target.value)||0)))} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-[#111] px-3 text-xs font-bold text-white disabled:opacity-50"/></label>;
