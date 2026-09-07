import fs from 'node:fs';
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
