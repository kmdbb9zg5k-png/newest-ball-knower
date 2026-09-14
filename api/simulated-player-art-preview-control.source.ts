import handler from './simulated-player-art';
import { defaultAppearance } from '../solo/appearance';
import { SOLO_PLAYERS_DATABASE, SOLO_TEAM_THEMES } from '../soloUniverse';
import { STAFF_ART_PROFILES, staffPortraitPlayer } from '../solo/staffPortraits';

const APPROVED_LOCAL = new Set([
  'bk-001-eli-rodriguez','solo-brk-02','solo-slc-02','solo-brk-05','solo-slc-05','solo-brk-10','solo-slc-10','solo-brk-15','solo-slc-15',
  'solo-brk-21','solo-slc-20','solo-brk-30','solo-slc-30','solo-brk-38','solo-slc-38','solo-brk-46','solo-slc-45','solo-brk-52','solo-slc-52',
]);

const groupFor = (position:string) => {
  if (['LT','RT','LG','RG','C','OT','OG'].includes(position)) return 'OL';
  if (['EDGE','DE','DT','NT'].includes(position)) return 'DL';
  if (['CB','S','FS','SS'].includes(position)) return 'DB';
  return position;
};

const samplePlayers = () => {
  const wanted = ['QB','QB','RB','RB','WR','WR','TE','TE','OL','OL','DL','DL','LB','LB','DB','K'];
  const pool = SOLO_PLAYERS_DATABASE.filter(player => !APPROVED_LOCAL.has(player.id));
  const used = new Set<string>();
  return wanted.map(group => {
    const player = pool.find(candidate => !used.has(candidate.id) && groupFor(candidate.position) === group);
    if (!player) throw new Error(`No ${group} player is available for the preview batch.`);
    used.add(player.id);
    return player;
  });
};

const jobFor = (player:any,attempt:number) => ({
  playerId:player.id,team:player.team,variant:'home',position:player.position,name:player.name,number:player.jerseyNumber,
  age:player.age,heightInches:player.heightInches,weightLbs:player.weightLbs,appearance:defaultAppearance(player),attempt,
});

export default async function previewControl(req:any,res:any) {
  if (process.env.VERCEL_ENV !== 'preview') return res.status(404).json({error:'Not found'});
  const adminKey = process.env.SIMULATED_PLAYER_ART_ADMIN_KEY || '';
  if (!adminKey) return res.status(503).json({error:'Preview artwork control is not configured.'});
  const action = String(req.query?.action || 'status');
  req.method = 'POST';
  req.headers['x-ball-knower-art-key'] = adminKey;
  if (action === 'submit-sample') {
    req.body = {
      action:'submit-batch',
      qualityTier:'economy',
      jobs:samplePlayers().map(player => jobFor(player,5)),
    };
  } else if (action === 'submit-staff') {
    req.body = {
      action:'submit-batch',
      qualityTier:'economy',
      jobs:STAFF_ART_PROFILES.map(profile => jobFor(staffPortraitPlayer(profile),0)),
    };
  } else if (action === 'retry-ids') {
    const ids = String(req.query?.ids || '').split(',').map(id => id.trim()).filter(Boolean);
    const requested = new Set(ids.slice(0,16));
    const knownPlayers = [
      ...SOLO_PLAYERS_DATABASE,
      ...STAFF_ART_PROFILES.map(profile => staffPortraitPlayer(profile)),
    ];
    const players = knownPlayers.filter(player => requested.has(player.id));
    if (!players.length || players.length !== requested.size) return res.status(400).json({error:'Supply one to sixteen valid simulated player IDs.'});
    const attempt = Math.max(1,Math.min(20,Number(req.query?.attempt) || 1));
    const requestedTeam = String(req.query?.team || '').toUpperCase();
    const uniformTeam = requestedTeam ? SOLO_TEAM_THEMES.find(team => team.abbr === requestedTeam) : undefined;
    if (requestedTeam && !uniformTeam) return res.status(400).json({error:'Supply a valid fictional team abbreviation.'});
    req.body = {
      action:'submit-batch',
      qualityTier:'economy',
      jobs:players.map(player => jobFor(uniformTeam ? {...player,team:uniformTeam.abbr} : player,attempt)),
    };
  } else if (action === 'submit-slice' || action === 'retry-slice') {
    const team = String(req.query?.team || '').toUpperCase();
    const offset = Math.max(0,Math.min(SOLO_PLAYERS_DATABASE.length,Number(req.query?.offset) || 0));
    const players = SOLO_PLAYERS_DATABASE.filter(player => player.team === team).slice(offset,offset+16);
    if (!players.length) return res.status(400).json({error:'No simulated players found for that team slice.'});
    req.body = {action:'submit-batch',qualityTier:action === 'retry-slice' ? 'review' : 'economy',jobs:players.map(player => jobFor(player,0))};
  } else if (action === 'sync') req.body = {action:'sync-open-batches'};
  else req.body = {action:'status'};
  return handler(req,res);
}
