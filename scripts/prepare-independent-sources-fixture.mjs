import fs from 'node:fs';
import assert from 'node:assert/strict';
const migration=fs.readFileSync('migrations/20260907020000_independent_football_sources.sql','utf8').split('-- NETWORK_BOOTSTRAP:')[0];
const snapshot=fs.readFileSync('data/published-independent-football.json','utf8');
assert.ok(!snapshot.includes('$snapshot$'));
const rankings=fs.readFileSync('migrations/20260822_add_fantasy_projection_rankings.sql','utf8').split('insert into public.ball_knower_fantasy_rankings')[0];
const catalog=fs.readFileSync('migrations/20260825_secure_draft_order_game_catalog.sql','utf8').split('insert into ball_knower_private.draft_order_game_players')[0];
const sql=`\\set ON_ERROR_STOP on
begin;
do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if; end$$;
create schema if not exists ball_knower_private;
create table public.ball_knower_leagues(id text primary key,settings jsonb,season_result jsonb);
create table public.bk_saved_progress(id text,roster jsonb,points numeric);
insert into public.ball_knower_leagues values('finished','{"draftOrderMethod":"game"}','{"draftOrder":["manager"]}');
insert into public.bk_saved_progress values('saved','[{"id":"ea-legacy","salary":12}]',125.4);
${rankings}
alter table public.ball_knower_fantasy_rankings alter column actual_points_2025 drop not null;
alter table public.ball_knower_fantasy_rankings add column adp numeric;
${catalog}
${migration}
create table public.bk_test_snapshot(payload jsonb);
insert into public.bk_test_snapshot values($snapshot$${snapshot}$snapshot$::jsonb);
select ball_knower_private.install_independent_snapshot(payload) from public.bk_test_snapshot;
do $$declare before_count integer; before_rating integer; begin
  select count(*) into before_count from public.ball_knower_fantasy_rankings;
  if before_count<>2379 then raise exception 'Missing format projections'; end if;
  if (select count(*) from ball_knower_private.draft_order_game_players where active)<>2477 then raise exception 'Missing active players'; end if;
  if has_function_privilege('authenticated','public.refresh_ball_knower_fantasy_rankings()','EXECUTE') then raise exception 'Public refresh must not be callable'; end if;
  if has_function_privilege('authenticated','ball_knower_private.install_independent_snapshot(jsonb)','EXECUTE') then raise exception 'Private install must not be callable'; end if;
  if (select points from public.bk_saved_progress where id='saved')<>125.4 then raise exception 'Saved results changed'; end if;
  if (select roster from public.bk_saved_progress where id='saved')<>'[{"id":"ea-legacy","salary":12}]'::jsonb then raise exception 'Saved roster changed'; end if;
  begin
    perform ball_knower_private.install_independent_snapshot(jsonb_set((select payload from public.bk_test_snapshot),'{rankings}','[]'::jsonb));
    raise exception 'BAD_SNAPSHOT_ACCEPTED';
  exception when raise_exception then
    if sqlerrm='BAD_SNAPSHOT_ACCEPTED' then raise; end if;
  end;
  if (select count(*) from public.ball_knower_fantasy_rankings)<>before_count then raise exception 'Bad snapshot partially replaced data'; end if;
  insert into public.ball_knower_leagues values('unfinished','{"draftOrderMethod":"game"}',null);
  begin
    perform ball_knower_private.install_independent_snapshot((select payload from public.bk_test_snapshot));
    raise exception 'UNFINISHED_GAME_ACCEPTED';
  exception when raise_exception then
    if sqlerrm='UNFINISHED_GAME_ACCEPTED' then raise; end if;
  end;
  delete from public.ball_knower_leagues where id='unfinished';
  perform public.refresh_ball_knower_fantasy_rankings();
  if (select count(*) from public.ball_knower_fantasy_rankings)<>before_count then raise exception 'Refresh is not idempotent'; end if;
end$$;
rollback;
`;
fs.writeFileSync('/tmp/bk-independent-sources.sql',sql);
console.log('Prepared disposable fixture using published snapshot and existing table constraints.');
