import { Player, Position, PositionGroup } from './types';
import { AFC_EAST_PLAYERS } from './afcEast';
import { AFC_NORTH_PLAYERS } from './afcNorth';
import { AFC_SOUTH_PLAYERS } from './afcSouth';
import { AFC_WEST_PLAYERS } from './afcWest';
import { NFC_EAST_PLAYERS } from './nfcEast';
import { NFC_NORTH_PLAYERS } from './nfcNorth';
import { NFC_SOUTH_PLAYERS } from './nfcSouth';
import { NFC_WEST_PLAYERS } from './nfcWest';
import { validateDatabase } from './databaseValidator';
import { CURRENT_ROSTER_METADATA, HISTORICAL_ROSTER_MIGRATIONS, detectRosterMismatches, generateRosterMigrationReport } from './rosterSync';
import { MADDEN_RATING_METADATA, OFFICIAL_MADDEN_RATINGS, getOfficialMaddenRating } from './maddenRatings';
import { MASTER_2026_ROSTER_REGISTRY, enforce2026Roster, validateAndSyncRoster, generateFull2026RosterValidationReport } from './masterRoster2026';
import { validatePlayerRatings } from './ratingsValidator';
import { applyCurrent2026Roster } from './currentSeasonRoster';

export { CURRENT_ROSTER_METADATA, HISTORICAL_ROSTER_MIGRATIONS, detectRosterMismatches, generateRosterMigrationReport, MADDEN_RATING_METADATA, OFFICIAL_MADDEN_RATINGS, getOfficialMaddenRating, validatePlayerRatings, MASTER_2026_ROSTER_REGISTRY, enforce2026Roster, validateAndSyncRoster, generateFull2026RosterValidationReport };

export interface NFLTeamInfo { code:string; name:string; city:string; conference:'AFC'|'NFC'; division:'East'|'North'|'South'|'West'; primaryColor?:string; secondaryColor?:string; }

export const NFL_TEAMS:NFLTeamInfo[]=[
 {code:'BUF',name:'Bills',city:'Buffalo',conference:'AFC',division:'East',primaryColor:'#00338D',secondaryColor:'#C60C30'},{code:'MIA',name:'Dolphins',city:'Miami',conference:'AFC',division:'East',primaryColor:'#008E97',secondaryColor:'#FC4C02'},{code:'NE',name:'Patriots',city:'New England',conference:'AFC',division:'East',primaryColor:'#002244',secondaryColor:'#C60C30'},{code:'NYJ',name:'Jets',city:'New York',conference:'AFC',division:'East',primaryColor:'#125740',secondaryColor:'#000000'},
 {code:'BAL',name:'Ravens',city:'Baltimore',conference:'AFC',division:'North',primaryColor:'#241773',secondaryColor:'#9E7C0C'},{code:'CIN',name:'Bengals',city:'Cincinnati',conference:'AFC',division:'North',primaryColor:'#FB4F14',secondaryColor:'#000000'},{code:'CLE',name:'Browns',city:'Cleveland',conference:'AFC',division:'North',primaryColor:'#311D00',secondaryColor:'#FF3C00'},{code:'PIT',name:'Steelers',city:'Pittsburgh',conference:'AFC',division:'North',primaryColor:'#FFB612',secondaryColor:'#101820'},
 {code:'HOU',name:'Texans',city:'Houston',conference:'AFC',division:'South',primaryColor:'#03202F',secondaryColor:'#A71930'},{code:'IND',name:'Colts',city:'Indianapolis',conference:'AFC',division:'South',primaryColor:'#002C5F',secondaryColor:'#A2AAAD'},{code:'JAX',name:'Jaguars',city:'Jacksonville',conference:'AFC',division:'South',primaryColor:'#006778',secondaryColor:'#D7A22A'},{code:'TEN',name:'Titans',city:'Tennessee',conference:'AFC',division:'South',primaryColor:'#0C2340',secondaryColor:'#4B92DB'},
 {code:'DEN',name:'Broncos',city:'Denver',conference:'AFC',division:'West',primaryColor:'#FB4F14',secondaryColor:'#002244'},{code:'KC',name:'Chiefs',city:'Kansas City',conference:'AFC',division:'West',primaryColor:'#E31837',secondaryColor:'#FFB81C'},{code:'LV',name:'Raiders',city:'Las Vegas',conference:'AFC',division:'West',primaryColor:'#000000',secondaryColor:'#A5ACAF'},{code:'LAC',name:'Chargers',city:'Los Angeles',conference:'AFC',division:'West',primaryColor:'#0080C6',secondaryColor:'#FFC20E'},
 {code:'DAL',name:'Cowboys',city:'Dallas',conference:'NFC',division:'East',primaryColor:'#003594',secondaryColor:'#041E42'},{code:'NYG',name:'Giants',city:'New York',conference:'NFC',division:'East',primaryColor:'#0B2265',secondaryColor:'#A71930'},{code:'PHI',name:'Eagles',city:'Philadelphia',conference:'NFC',division:'East',primaryColor:'#004C54',secondaryColor:'#A5ACAF'},{code:'WAS',name:'Commanders',city:'Washington',conference:'NFC',division:'East',primaryColor:'#5A1414',secondaryColor:'#FFB612'},
 {code:'CHI',name:'Bears',city:'Chicago',conference:'NFC',division:'North',primaryColor:'#0B162A',secondaryColor:'#C83803'},{code:'DET',name:'Lions',city:'Detroit',conference:'NFC',division:'North',primaryColor:'#0076B6',secondaryColor:'#B0B7BC'},{code:'GB',name:'Packers',city:'Green Bay',conference:'NFC',division:'North',primaryColor:'#203731',secondaryColor:'#FFB612'},{code:'MIN',name:'Vikings',city:'Minnesota',conference:'NFC',division:'North',primaryColor:'#4F2683',secondaryColor:'#FFC62F'},
 {code:'ATL',name:'Falcons',city:'Atlanta',conference:'NFC',division:'South',primaryColor:'#A71930',secondaryColor:'#000000'},{code:'CAR',name:'Panthers',city:'Carolina',conference:'NFC',division:'South',primaryColor:'#0085CA',secondaryColor:'#101820'},{code:'NO',name:'Saints',city:'New Orleans',conference:'NFC',division:'South',primaryColor:'#D3BC8D',secondaryColor:'#101820'},{code:'TB',name:'Buccaneers',city:'Tampa Bay',conference:'NFC',division:'South',primaryColor:'#D50A0A',secondaryColor:'#34302B'},
 {code:'ARI',name:'Cardinals',city:'Arizona',conference:'NFC',division:'West',primaryColor:'#97233F',secondaryColor:'#000000'},{code:'LAR',name:'Rams',city:'Los Angeles',conference:'NFC',division:'West',primaryColor:'#003594',secondaryColor:'#FFA300'},{code:'SF',name:'49ers',city:'San Francisco',conference:'NFC',division:'West',primaryColor:'#AA0000',secondaryColor:'#B3995D'},{code:'SEA',name:'Seahawks',city:'Seattle',conference:'NFC',division:'West',primaryColor:'#002244',secondaryColor:'#69BE28'}
];

export function getTeamData(code:string){ return NFL_TEAMS.find(team=>team.code===String(code||'').toUpperCase()); }
export function getPositionGroup(pos:Position):PositionGroup{ const p=String(pos).toUpperCase(); if(p==='QB')return 'QB' as PositionGroup; if(['RB','FB'].includes(p))return 'RB' as PositionGroup; if(p==='WR')return 'WR' as PositionGroup; if(p==='TE')return 'TE' as PositionGroup; if(['OT','LT','RT','OG','LG','RG','C','OL'].includes(p))return 'OL' as PositionGroup; if(p==='EDGE')return 'EDGE' as PositionGroup; if(['DT','DE','NT','DL'].includes(p))return 'DL' as PositionGroup; if(['LB','OLB','ILB','MLB'].includes(p))return 'LB' as PositionGroup; if(p==='CB')return 'CB' as PositionGroup; if(['S','FS','SS'].includes(p))return 'S' as PositionGroup; if(['K','P'].includes(p))return 'K' as PositionGroup; return 'ALL' as PositionGroup; }

const LEGACY_RAW_PLAYERS:Player[]=[...AFC_EAST_PLAYERS,...AFC_NORTH_PLAYERS,...AFC_SOUTH_PLAYERS,...AFC_WEST_PLAYERS,...NFC_EAST_PLAYERS,...NFC_NORTH_PLAYERS,...NFC_SOUTH_PLAYERS,...NFC_WEST_PLAYERS];
const RAW_PLAYERS_COMBINED:Player[]=applyCurrent2026Roster(LEGACY_RAW_PLAYERS);
function normalizePlayer(raw:Player):Player{ const teamData=NFL_TEAMS.find(t=>t.code===raw.team); const madden=getOfficialMaddenRating(raw.id,raw.name,raw.team,raw.position); const ovr=(raw as any).overallRating || (madden as any)?.overallRating || raw.ovr; return {...raw,playerId:(raw as any).playerId||raw.id,teamId:(raw as any).teamId||raw.team,teamAbbreviation:raw.team,teamCity:(raw as any).teamCity||teamData?.city||'NFL',teamName:(raw as any).teamName||teamData?.name||'',conference:(raw as any).conference||teamData?.conference||'AFC',division:(raw as any).division||teamData?.division||'East',positionGroup:(raw as any).positionGroup||getPositionGroup(raw.position),active:(raw as any).active!==false,rosterSeason:2026,overallRating:ovr,ovr,overall:ovr} as Player; }
export const PLAYERS_DATABASE:Player[]=RAW_PLAYERS_COMBINED.map(normalizePlayer);
export function searchPlayers(query:string){ const q=String(query||'').trim().toLowerCase(); if(!q)return PLAYERS_DATABASE; return PLAYERS_DATABASE.filter((p:any)=>`${p.name} ${p.team} ${p.position} ${p.teamCity||''} ${p.teamName||''}`.toLowerCase().includes(q)); }
export function getPlayersByTeam(team:string){ const t=String(team||'').toUpperCase(); return PLAYERS_DATABASE.filter(p=>String(p.team).toUpperCase()===t); }
export function getPlayersByPosition(position:string){ const p=String(position||'').toUpperCase(); return PLAYERS_DATABASE.filter(x=>String(x.position).toUpperCase()===p || String((x as any).positionGroup||'').toUpperCase()===p); }
export const DATABASE_VALIDATION_REPORT:any=validateDatabase(PLAYERS_DATABASE,NFL_TEAMS);
export const ROSTER_MIGRATION_REPORT:any=generateRosterMigrationReport(PLAYERS_DATABASE);
export const RATINGS_VALIDATION_REPORT:any=validatePlayerRatings(PLAYERS_DATABASE);
export const MASTER_2026_VALIDATION_REPORT:any=generateFull2026RosterValidationReport(PLAYERS_DATABASE);
