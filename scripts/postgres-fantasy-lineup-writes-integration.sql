\set ON_ERROR_STOP on
begin;
do $$begin
 if not exists(select 1 from pg_roles where rolname='anon')then create role anon nologin;end if;
 if not exists(select 1 from pg_roles where rolname='authenticated')then create role authenticated nologin;end if;
 if not exists(select 1 from pg_roles where rolname='service_role')then create role service_role nologin bypassrls;end if;
end $$;
create schema auth;
create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;
create table public.ball_knower_leagues(id text primary key,settings jsonb);
create table public.ball_knower_league_members(id text primary key,league_id text,auth_user_id uuid,user_name text,is_ai boolean default false,roster jsonb);
create table public.ball_knower_nfl_games(provider_game_id text primary key,season int,week_number int,home_team text,away_team text,kickoff_at timestamptz,season_type text default 'reg');
create table public.ball_knower_weekly_lineups(id uuid primary key default gen_random_uuid(),league_id text,member_id text,week_number int,starters jsonb,bench jsonb,locked boolean default false,locked_player_ids jsonb default '[]',submitted_at timestamptz,updated_at timestamptz,unique(league_id,member_id,week_number));
create table public.ball_knower_transactions(league_id text,member_id text,transaction_type text,summary text,metadata jsonb);
grant select,insert,update,delete on public.ball_knower_weekly_lineups to authenticated;
alter table public.ball_knower_weekly_lineups enable row level security;
create policy fixture_lineup_owner on public.ball_knower_weekly_lineups for all to authenticated using(true)with check(true);
\ir ../migrations/20261106023523_secure_fantasy_lineup_writes.sql
insert into public.ball_knower_leagues values('fixture-lineups','{"nflSeason":2026}');
insert into public.ball_knower_league_members values('fixture-manager','fixture-lineups','00000000-0000-4000-8000-000000000001','Synthetic Manager',false,'[{"id":"qb","position":"QB","team":"CHI"},{"id":"rb1","position":"RB","team":"SEA"},{"id":"rb2","position":"RB","team":"SEA"},{"id":"wr1","position":"WR","team":"SEA"},{"id":"wr2","position":"WR","team":"SEA"},{"id":"te","position":"TE","team":"SEA"},{"id":"flex","position":"WR","team":"SEA"},{"id":"k","position":"K","team":"SEA"},{"id":"dst-chi","position":"DST","team":"CHI"},{"id":"qb-bench","position":"QB","team":"CHI"},{"id":"wr-bench","position":"WR","team":"SEA"}]');
insert into public.ball_knower_nfl_games(provider_game_id,season,week_number,home_team,away_team,kickoff_at)values('fixture-chi',2026,8,'CHI','ARI',clock_timestamp()+interval '1 day'),('fixture-sea',2026,8,'SEA','SF',clock_timestamp()+interval '3 days');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$declare s jsonb:='{"QB":"qb","RB1":"rb1","RB2":"rb2","WR1":"wr1","WR2":"wr2","TE":"te","FLEX":"flex","K":"k","DST":"dst-chi"}';begin
 perform public.save_my_ball_knower_weekly_lineup('fixture-lineups',8,s,'["qb-bench","wr-bench"]');
 if not exists(select 1 from public.ball_knower_weekly_lineups where starters=s)then raise exception 'Pre-kickoff authenticated save failed';end if;
 begin update public.ball_knower_weekly_lineups set starters=s;raise exception 'Direct update allowed';exception when insufficient_privilege then null;end;
 begin delete from public.ball_knower_weekly_lineups;raise exception 'Direct delete allowed';exception when insufficient_privilege then null;end;
 begin insert into public.ball_knower_weekly_lineups(league_id,member_id,week_number)values('fixture-lineups','fixture-manager',9);raise exception 'Direct insert allowed';exception when insufficient_privilege then null;end;
 begin perform public.save_my_ball_knower_weekly_lineup('fixture-lineups',8,s||'{"extra":"qb-bench"}','[]');raise exception 'Extra slot accepted';exception when others then if sqlerrm='Extra slot accepted'then raise;end if;end;
 begin perform public.save_my_ball_knower_weekly_lineup('fixture-lineups',8,s,'["qb"]');raise exception 'Duplicate bench accepted';exception when others then if sqlerrm='Duplicate bench accepted'then raise;end if;end;
end $$;
reset role;
update public.ball_knower_nfl_games set kickoff_at=clock_timestamp()-interval '1 minute'where provider_game_id='fixture-chi';
set local role authenticated;
do $$declare s jsonb;begin
 select starters into s from public.ball_knower_weekly_lineups;
 begin perform public.save_my_ball_knower_weekly_lineup('fixture-lineups',8,jsonb_set(s,'{QB}','"qb-bench"'),'["qb","wr-bench"]');raise exception 'Started bench QB entered lineup';exception when others then if sqlerrm='Started bench QB entered lineup'then raise;end if;end;
 -- Thursday's QB and D/ST remain in place while Sunday WR swaps still work.
 s:=jsonb_set(s,'{WR1}','"wr-bench"');
 perform public.save_my_ball_knower_weekly_lineup('fixture-lineups',8,s,'["qb-bench","wr1"]');
 if not exists(select 1 from public.ball_knower_weekly_lineups where starters->>'WR1'='wr-bench'and locked_player_ids?'qb'and locked_player_ids?'dst-chi'and not locked)then raise exception 'Partial kickoff locked unstarted Sunday players';end if;
end $$;
reset role;
update public.ball_knower_weekly_lineups set locked=true;
set local role authenticated;
do $$declare s jsonb;b jsonb;begin
 select starters,bench into s,b from public.ball_knower_weekly_lineups;
 perform public.save_my_ball_knower_weekly_lineup('fixture-lineups',8,s,b);
 if not(select locked from public.ball_knower_weekly_lineups)then raise exception 'Same-lineup save cleared explicit lock';end if;
end $$;
reset role;
rollback;
select 'fantasy lineup writes integration passed: RPC survives DML revocation, exact slots/bench, kickoff locks and unstarted swaps' as result;
