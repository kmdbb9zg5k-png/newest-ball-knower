import { DEFAULT_SALARY_CAP, LeagueMember, Player, ROSTER_REQUIREMENTS } from './types';
import { PLAYERS_DATABASE } from './players';
import { calculateTeamRatings } from './evaluation';
import { DraftPositionGroup, getDraftPositionGroup, validateRosterShape } from './rosterRules';

interface AiArchetype {
  id: string;
  name: string;
  avatar: string;
  philosophy: string;
  playerIds: string[];
}

export const AI_ARCHETYPES: AiArchetype[] = [
  {
    id: 'ai-elijah',
    name: 'Elijah (The Analytics Pro)',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    philosophy: 'Prioritizes trench efficiency, zero defensive liabilities, and high-value passing options.',
    playerIds: [
      'qb-stroud',
      'rb-kyren',
      'wr-arsb',
      'wr-mcconkey',
      'te-mcbride',
      'ot-mailata',
      'ot-alt',
      'og-hunt',
      'og-dotson',
      'c-dalman',
      // Defense
      'edge-anderson',
      'edge-young-byron',
      'dt-turner-kobie',
      'dt-mcneill',
      'lb-warner',
      'lb-henley',
      'cb-gonzalez',
      'cb-mitchell-quinyon',
      's-branch',
      's-blankenship',
    ],
  },
  {
    id: 'ai-tyler',
    name: 'Tyler (Trench Monster)',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    philosophy: 'Wins at the line of scrimmage with elite offensive line anchors and monster interior defensive tackles.',
    playerIds: [
      'qb-darnold',
      'rb-cook',
      'wr-mcconkey',
      'wr-shakir',
      'te-kraft',
      'ot-sewell',
      'ot-wirfs',
      'og-lindstrom',
      'og-meinerz',
      'c-frazier-zach',
      // Defense
      'edge-verse',
      'edge-latu',
      'dt-jones',
      'dt-brown-derrick',
      'lb-campbell-jack',
      'lb-cooper-edgerrin',
      'cb-porter',
      'cb-mitchell-quinyon',
      's-branch',
      's-joseph-kerby',
    ],
  },
  {
    id: 'ai-jay',
    name: 'Jay (Air Raid Gunslinger)',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    philosophy: 'Invests everything in Patrick Mahomes and elite boundary receivers to light up the scoreboard.',
    playerIds: [
      'qb-mahomes',
      'rb-hubbard',
      'wr-chase',
      'wr-collins',
      'te-kincaid',
      'ot-dawkins',
      'ot-alt',
      'og-torrence',
      'og-powers-johnson',
      'c-dalman',
      // Defense
      'edge-burns',
      'edge-young-byron',
      'dt-kancey',
      'dt-phillips-harrison',
      'lb-pace',
      'lb-henley',
      'cb-stingley',
      'cb-adebo',
      's-joseph-kerby',
      's-mustapha',
    ],
  },
  {
    id: 'ai-mike',
    name: 'Mike (Defensive Mastermind)',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80',
    philosophy: 'Builds an impenetrable defense with elite pass rush and lockdown secondary.',
    playerIds: [
      'qb-purdy',
      'rb-montgomery',
      'wr-thomas-brian',
      'wr-shakir',
      'te-kraft',
      'ot-thomas',
      'ot-raimann',
      'og-puni',
      'og-avila',
      'c-dalman',
      // Defense
      'edge-garrett',
      'edge-hines-allen',
      'dt-carter',
      'dt-heyward',
      'lb-smith-roquan',
      'lb-davis-demario',
      'cb-surtain',
      'cb-mitchell-quinyon',
      's-hamilton',
      's-blankenship',
    ],
  },
  {
    id: 'ai-marcus',
    name: 'Marcus (Moneyball Guru)',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&auto=format&fit=crop&q=80',
    philosophy: 'Never pays maximum dollar. Fills every position with 85-89 OVR players on team-friendly salaries.',
    playerIds: [
      'qb-daniels',
      'rb-walker',
      'wr-nabers',
      'wr-london',
      'te-laporta',
      'ot-alt',
      'ot-slater',
      'og-smith-tyler',
      'og-smith-trey',
      'c-linderbaum',
      // Defense
      'edge-anderson',
      'edge-verse',
      'dt-madubuike',
      'dt-wilkins',
      'lb-luvu',
      'lb-edwards',
      'cb-johnson-jaylon',
      'cb-mitchell-quinyon',
      's-mckinney',
      's-bynum',
    ],
  },
  {
    id: 'ai-dave',
    name: 'Dave (Smashmouth Ground & Pound)',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&auto=format&fit=crop&q=80',
    philosophy: 'Believes running the football and violent defense controls the tempo of every game.',
    playerIds: [
      'qb-darnold',
      'rb-henry',
      'wr-nacua',
      'wr-flowers',
      'te-kittle',
      'ot-williams-trent',
      'ot-johnson-lane',
      'og-martin-zack',
      'og-puni',
      'c-dalman',
      // Defense
      'edge-crosby',
      'edge-young-byron',
      'dt-lawrence-dexter',
      'dt-phillips-harrison',
      'lb-williams-quincy',
      'lb-pace',
      'cb-emerson',
      'cb-porter',
      's-bates',
      's-joseph-kerby',
    ],
  },
  {
    id: 'ai-chris',
    name: 'Chris (Superstar Gambler)',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80',
    philosophy: 'Drafts top 3 highest overall superstars regardless of cap, and fills the rest with minimum contracts.',
    playerIds: [
      'qb-jackson',
      'rb-pollard',
      'wr-jefferson',
      'wr-thomas-brian',
      'te-kraft',
      'ot-alt',
      'ot-fuaga',
      'og-puni',
      'og-skoronski',
      'c-froholdt',
      // Defense
      'edge-parsons',
      'edge-young-byron',
      'dt-kancey',
      'dt-turner-kobie',
      'lb-davis-demario',
      'lb-campbell-jack',
      'cb-gardner',
      'cb-lassiter',
      's-winfield',
      's-mustapha',
    ],
  },
];

export function buildRosterForArchetype(archetype: AiArchetype,seed=0): Player[] {
  const groupWeights:Partial<Record<DraftPositionGroup,number>>={};
  if(archetype.id==='ai-tyler') Object.assign(groupWeights,{OL:1.28,DL_EDGE:1.24});
  if(archetype.id==='ai-jay') Object.assign(groupWeights,{QB:1.34,WR:1.25,TE:1.16});
  if(archetype.id==='ai-mike') Object.assign(groupWeights,{DL_EDGE:1.26,LB:1.2,CB:1.24,S:1.22});
  if(archetype.id==='ai-dave') Object.assign(groupWeights,{RB:1.3,OL:1.2,DL_EDGE:1.12,LB:1.1});
  if(archetype.id==='ai-chris') Object.assign(groupWeights,{QB:1.22,WR:1.22,DL_EDGE:1.18,CB:1.12});

  const archetypeTarget:Record<string,number>={
    'ai-elijah':89,'ai-tyler':88,'ai-jay':90,'ai-mike':90,'ai-marcus':87,'ai-dave':88,'ai-chris':86,
  };
  const capTarget:Record<string,number>={
    'ai-elijah':270,'ai-tyler':260,'ai-jay':280,'ai-mike':275,'ai-marcus':205,'ai-dave':260,'ai-chris':300,
  };
  const stableJitter=(id:string)=>{
    let hash=seed+17;
    for(const char of `${archetype.id}-${id}`) hash=(hash*31+char.charCodeAt(0))>>>0;
    return (hash%31)/20;
  };
  const maxOvrFor=(group:DraftPositionGroup)=>{
    if(archetype.id==='ai-chris') return ['QB','WR','DL_EDGE'].includes(group)?99:83;
    return Math.min(96,(archetypeTarget[archetype.id]||88)+Math.round(((groupWeights[group]||1)-1)*22));
  };
  const score=(player:Player,group:DraftPositionGroup)=>{
    const weight=groupWeights[group]||1;
    const iq=Number(player.attributes?.footballIQ)||player.ovr;
    const athletic=Number(player.attributes?.athleticism)||player.ovr;
    const moneyballPenalty=archetype.id==='ai-marcus'?player.salary*.32:player.salary*.04;
    return (player.ovr*.84+iq*.1+athletic*.06)*weight-moneyballPenalty+stableJitter(player.id);
  };

  const pool=PLAYERS_DATABASE.filter(player=>player.active!==false&&!player.isFreeAgent&&getDraftPositionGroup(player));
  const roster:Player[]=[];
  for(const [group,required] of Object.entries(ROSTER_REQUIREMENTS) as [DraftPositionGroup,number][]){
    const cheapest=pool
      .filter(player=>getDraftPositionGroup(player)===group)
      .sort((a,b)=>a.salary-b.salary||b.ovr-a.ovr)
      .slice(0,required);
    roster.push(...cheapest);
  }

  let spent=roster.reduce((sum,player)=>sum+player.salary,0);
  for(let pass=0;pass<180;pass++){
    const selectedIds=new Set(roster.map(player=>player.id));
    let best:{slot:number;player:Player;gain:number;cost:number;efficiency:number}|null=null;
    roster.forEach((current,slot)=>{
      const group=getDraftPositionGroup(current);
      if(!group)return;
      for(const candidate of pool){
        if(getDraftPositionGroup(candidate)!==group||candidate.ovr>maxOvrFor(group)||(selectedIds.has(candidate.id)&&candidate.id!==current.id))continue;
        const gain=score(candidate,group)-score(current,group);
        const cost=candidate.salary-current.salary;
        if(gain<=0||spent+cost>(capTarget[archetype.id]||DEFAULT_SALARY_CAP)+.0001)continue;
        const efficiency=gain/Math.max(.25,cost+.25);
        if(!best||efficiency>best.efficiency||(efficiency===best.efficiency&&gain>best.gain)) best={slot,player:candidate,gain,cost,efficiency};
      }
    });
    if(!best)break;
    roster[best.slot]=best.player;
    spent+=best.cost;
  }

  if(roster.length!==20||validateRosterShape(roster).length||spent>DEFAULT_SALARY_CAP+.0001){
    throw new Error(`CPU roster generation failed for ${archetype.name}.`);
  }
  return roster;
}

export function generateAiLeagueMembers(count: number, startIndex = 0): LeagueMember[] {
  const members: LeagueMember[] = [];
  for (let i = 0; i < count; i++) {
    const arch = AI_ARCHETYPES[(startIndex + i) % AI_ARCHETYPES.length];
    const roster = buildRosterForArchetype(arch,startIndex+i);
    const ratings = calculateTeamRatings(roster);
    members.push({
      id: `member-${arch.id}-${Date.now()}-${i}`,
      userId: `${arch.id}-${startIndex+i}`,
      userName: `${arch.name.split(' (')[0]} CPU${Math.floor((startIndex+i)/AI_ARCHETYPES.length)>0?` ${Math.floor((startIndex+i)/AI_ARCHETYPES.length)+1}`:''}`,
      userAvatar: arch.avatar,
      isCommissioner: false,
      isAi: true,
      aiArchetype: arch.name,
      status: 'ready',
      roster,
      teamRatings: ratings,
      submittedAt: new Date().toISOString(),
    });
  }
  return members;
}
