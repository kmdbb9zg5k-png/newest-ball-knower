import { Player, LeagueMember } from '../types';
import { PLAYERS_DATABASE } from '../data/players';
import { calculateTeamRatings } from './evaluation';

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

export function buildRosterForArchetype(archetype: AiArchetype): Player[] {
  const roster: Player[] = [];
  archetype.playerIds.forEach(id => {
    const player = PLAYERS_DATABASE.find(p => p.id === id);
    if (player) {
      roster.push(player);
    }
  });
  return roster;
}

export function generateAiLeagueMembers(count: number, startIndex = 0): LeagueMember[] {
  const members: LeagueMember[] = [];
  for (let i = 0; i < count; i++) {
    const arch = AI_ARCHETYPES[(startIndex + i) % AI_ARCHETYPES.length];
    const roster = buildRosterForArchetype(arch);
    const ratings = calculateTeamRatings(roster);
    members.push({
      id: `member-${arch.id}-${Date.now()}-${i}`,
      userId: arch.id,
      userName: arch.name.split(' (')[0], // clean display name
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
