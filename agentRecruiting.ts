export type RecruitingPitch = 'money'|'guarantees'|'loyalty'|'winning'|'playing_time'|'family'|'brand'|'long_term';
export type PlayerPriority = RecruitingPitch;
export type PlayerPersonality = 'security_first'|'ambitious'|'loyal'|'family_first'|'spotlight'|'planner';

export type RecruitingTarget = {
  id:string;
  age?:number;
  salary:number;
  ovr:number;
  position:string;
};

export type RecruitingAgency = {
  reputation:number;
  negotiation:number;
  brandPower:number;
  clientCare:number;
};

export type RecruitingProfile = {
  priorities:PlayerPriority[];
  personality:PlayerPersonality;
  difficulty:number;
};

export const RECRUITING_PITCHES:RecruitingPitch[]=['money','guarantees','loyalty','winning','playing_time','family','brand','long_term'];

const hash=(value:string)=>Array.from(value).reduce((total,char,index)=>total+char.charCodeAt(0)*(index+11),0);
const rotate=<T,>(items:T[],offset:number)=>items.map((_,index)=>items[(index+offset)%items.length]);
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

export function createRecruitingProfile(player:RecruitingTarget):RecruitingProfile{
  const personality:PlayerPersonality[]=['security_first','ambitious','loyal','family_first','spotlight','planner'];
  const selectedPersonality=personality[hash(player.id)%personality.length];
  const personalityPriority:Record<PlayerPersonality,PlayerPriority[]>={
    security_first:['guarantees','money','long_term'],
    ambitious:['playing_time','winning','money'],
    loyal:['loyalty','long_term','family'],
    family_first:['family','guarantees','loyalty'],
    spotlight:['brand','money','winning'],
    planner:['long_term','guarantees','playing_time'],
  };
  const agePriority:PlayerPriority=(player.age??27)>=30?'guarantees':(player.age??27)<=24?'playing_time':'money';
  const priorities=[...new Set([...personalityPriority[selectedPersonality],agePriority])].slice(0,3);
  const difficulty=clamp(Math.round(36+(player.ovr-68)*2.1+Math.max(0,player.salary-8)*.55),34,92);
  return {personality:selectedPersonality,priorities,difficulty};
}

export function recruitingRoundChoices(
  player:RecruitingTarget,
  profile:RecruitingProfile,
  round:1|2,
  used:RecruitingPitch[]=[],
):RecruitingPitch[]{
  const priorityOrder=[...profile.priorities,...rotate(RECRUITING_PITCHES,hash(`${player.id}:choices`)%RECRUITING_PITCHES.length)]
    .filter((pitch,index,items)=>items.indexOf(pitch)===index);
  const available=priorityOrder.filter(pitch=>!used.includes(pitch));
  return round===1?available.slice(0,4):available.slice(0,4);
}

export function recruitingPitchImpact(
  pitch:RecruitingPitch,
  player:RecruitingTarget,
  profile:RecruitingProfile,
  agency:RecruitingAgency,
):number{
  const priorityRank=profile.priorities.indexOf(pitch);
  const priorityFit=priorityRank<0?0:10-priorityRank*2;
  const skill={
    money:agency.negotiation,
    guarantees:agency.negotiation,
    loyalty:agency.clientCare,
    winning:agency.reputation,
    playing_time:agency.reputation,
    family:agency.clientCare,
    brand:agency.brandPower,
    long_term:Math.round((agency.negotiation+agency.clientCare)/2),
  }[pitch];
  const context=pitch==='playing_time'&&player.ovr<=74?4:pitch==='guarantees'&&(player.age??27)>=29?4:pitch==='brand'&&player.ovr>=78?3:0;
  return Math.round(4+skill*.1+priorityFit+context);
}

export function evaluateRecruitingDecision(args:{
  player:RecruitingTarget;
  profile:RecruitingProfile;
  agency:RecruitingAgency;
  pitches:RecruitingPitch[];
  baseInterest:number;
  rivalPressure:number;
  firstClient:boolean;
}):{signed:boolean;score:number;threshold:number}{
  const {player,profile,agency,pitches}=args;
  if(pitches.length!==2||new Set(pitches).size!==2) return {signed:false,score:0,threshold:profile.difficulty};
  const pitchScore=pitches.reduce((total,pitch)=>total+recruitingPitchImpact(pitch,player,profile,agency),0);
  const agencyFit=(agency.reputation+agency.negotiation+agency.clientCare)/18;
  const score=Math.round(args.baseInterest+pitchScore+agencyFit+(args.firstClient?10:0)-args.rivalPressure/12);
  return {signed:score>=profile.difficulty,score,threshold:profile.difficulty};
}
