import type {LeagueNotification} from './leagueCloud';

export type FantasyNotificationDestination='draft'|'roster'|'trades'|'waivers'|'messages'|'matchup'|'results'|'activity'|'league';

/** Route known server event kinds inside the already selected, joined league. */
export function notificationDestination(notification:Pick<LeagueNotification,'kind'|'category'>):FantasyNotificationDestination{
 const kind=(notification.kind||'').toLowerCase();
 if(kind.startsWith('draft_'))return 'draft';
 if(kind==='fantasy_dm'||kind==='league_message')return 'messages';
 if(kind.startsWith('trade_')||kind==='trading_block')return 'trades';
 if(kind.startsWith('waiver_')||kind==='watched_player_available')return 'waivers';
 if(kind==='matchup_final'||kind==='season_results'||kind==='league_results')return 'results';
 if(kind.startsWith('matchup_'))return 'matchup';
 if(['player_status','lineup_incomplete','starter_ruled_out','roster_lock','roster_submitted'].includes(kind))return 'roster';
 if(kind==='league_event')return 'activity';
 return notification.category==='draft'?'draft':notification.category==='roster'?'roster':notification.category==='transactions'?'trades':'league';
}

export function visibleLeagueNotifications(notifications:LeagueNotification[],leagueId:string){
 const seen=new Set<string>();
 return notifications.filter(notification=>{
  if(notification.inAppVisible===false||notification.leagueId&&notification.leagueId!==leagueId||seen.has(notification.id))return false;
  seen.add(notification.id);return true;
 });
}
