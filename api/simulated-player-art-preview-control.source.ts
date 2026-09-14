import handler from './simulated-player-art';
import { defaultAppearance } from '../solo/appearance';
import { SOLO_PLAYERS_DATABASE } from '../soloUniverse';

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
