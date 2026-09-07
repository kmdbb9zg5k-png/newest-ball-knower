import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
// Use the existing production RPC bodies instead of testing reimplementations.
const migration=fs.readFileSync('migrations/20260830_yahoo_fantasy_parity_upgrade.sql','utf8');
const names=['ball_knower_private.notify_fantasy_user','public.open_ball_knower_dm','public.send_ball_knower_dm','public.send_ball_knower_trade_message'];
const functions=names.map(name=>{
  const start=migration.indexOf(`create or replace function ${name}(`);
  const end=migration.indexOf('end;$function$;',start);
  assert.ok(start>=0&&end>start,`Missing production RPC: ${name}`);
  return migration.slice(start,end+'end;$function$;'.length);
});
fs.writeFileSync('/tmp/bk-community-rpcs.sql',functions.join('\n'));

// Run the same complete fixture with the production reply foreign key and the
// follow-up column-scoped triggers. All existing authorization tests remain.
let fixture=fs.readFileSync('scripts/postgres-community-safety-integration.sql','utf8');
const replaceOnce=(before,after)=>{
  assert.equal(fixture.split(before).length,2,`Fixture anchor must be unique: ${before}`);
  fixture=fixture.replace(before,after);
};
replaceOnce('reply_to uuid,created_at','reply_to uuid references public.ball_knower_league_messages(id) on delete set null,created_at');
replaceOnce('\\ir ../migrations/20260907010000_community_safety.sql',
  `\\i ${path.resolve('migrations/20260907010000_community_safety.sql')}\n\\i ${path.resolve('migrations/20260907010100_scope_community_safety_trigger_updates.sql')}`);
replaceOnce("set local role service_role;\nselect public.moderate_ball_knower_report",`-- Parent removal must preserve another manager's reply, even with a JWT claim.
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
insert into public.ball_knower_league_messages(id,league_id,auth_user_id,member_name,body,reply_to)
values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','league-one','22222222-2222-4222-8222-222222222222','Manager B','Reply retained after parent removal','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role service_role;
select public.moderate_ball_knower_report`);
replaceOnce("'Moderator must actually remove message');",`'Moderator must actually remove message');
select public.test_assert((select reply_to is null from public.ball_knower_league_messages where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'),'Foreign-key reply cleanup must not invoke message sending enforcement');
select set_config('request.jwt.claim.sub','',true);`);
fs.writeFileSync('/tmp/bk-community-safety-integration.sql',fixture);
