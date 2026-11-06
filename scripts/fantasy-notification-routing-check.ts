import assert from 'node:assert/strict';
import {FantasyNotificationInbox} from '../FantasyNotificationInbox';
import {notificationDestination,visibleLeagueNotifications,type FantasyNotificationDestination} from '../fantasyNotificationRouting';
import type {LeagueNotification} from '../leagueCloud';

const item=(id:string,kind:string,overrides:Partial<LeagueNotification>={}):LeagueNotification=>({id,kind,category:'league',leagueId:'joined-league',title:kind,body:'Saved event',inAppVisible:true,pushEligible:true,createdAt:'2026-11-05T10:00:00Z',...overrides});
const cases:Record<string,FantasyNotificationDestination>={draft_started:'draft',draft_reminder:'draft',draft_on_clock:'draft',trade_pending:'trades',trade_message:'trades',trading_block:'trades',waiver_success:'waivers',watched_player_available:'waivers',fantasy_dm:'messages',league_message:'messages',player_status:'roster',lineup_incomplete:'roster',starter_ruled_out:'roster',roster_lock:'roster',matchup_starting:'matchup',matchup_final:'results',season_results:'results',league_event:'activity',unknown_kind:'league'};
for(const [kind,destination]of Object.entries(cases))assert.equal(notificationDestination(item(kind,kind)),destination);
const notifications=[item('one','draft_started'),item('one','draft_started'),item('two','trade_pending'),item('hidden','trade_pending',{inAppVisible:false}),item('other','waiver_success',{leagueId:'other-league'}),item('global','league_message',{leagueId:undefined})];
assert.deepEqual(visibleLeagueNotifications(notifications,'joined-league').map(n=>n.id),['one','two','global'],'Only current league/owner-visible rows appear, with row-ID deduplication');
const actions:string[]=[],errors:string[]=[];
const tree=FantasyNotificationInbox({leagueId:'joined-league',notifications,onOpenDestination:destination=>actions.push(destination),onMarkRead:async id=>{actions.push('read:'+id);throw Error('Receipt unavailable');},onError:message=>errors.push(message)});
const first=(tree.props as any).children[0];first.props.onClick();assert.deepEqual(actions,['draft','read:one'],'The known destination opens even if receipt persistence fails');await Promise.resolve();await Promise.resolve();assert.deepEqual(errors,['Receipt unavailable']);
console.log('PASS notification routing: 19 server kinds, current-league isolation, hidden-channel filtering, row-ID deduplication and actionable inbox despite receipt failures');
