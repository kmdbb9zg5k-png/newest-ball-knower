-- Season 1: asynchronous, casual, device-reported offensive drives.
-- Private tables; only the authenticated API owns participants, attempts and standings.
create schema if not exists bk_football_private;
revoke all on schema bk_football_private from public, anon;
grant usage on schema bk_football_private to authenticated;
create table bk_football_private.matches (
 id uuid primary key default gen_random_uuid(),
 challenger_id uuid not null references auth.users(id) on delete cascade,
 opponent_id uuid references auth.users(id) on delete cascade,
 challenger_team text not null, opponent_team text,
 rules_version integer not null default 1 check(rules_version=1),
 status text not null check(status in ('open','pending','active','completed','cancelled','declined','expired')),
 seed integer not null default floor(random()*2147483647),
 winner_id uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '24 hours',
 completed_at timestamptz,
 check(challenger_id is distinct from opponent_id)
);
create index football_challenger on bk_football_private.matches(challenger_id,created_at desc);
create index football_opponent on bk_football_private.matches(opponent_id,created_at desc);
create index football_open on bk_football_private.matches(created_at desc) where status='open';
create table bk_football_private.drives (
 match_id uuid not null references bk_football_private.matches(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 ordinal integer not null check(ordinal between 1 and 3),
 launch_id uuid not null, token uuid not null default gen_random_uuid(),
 started_at timestamptz not null default now(), deadline timestamptz not null default now()+interval '12 minutes',
 finished_at timestamptz, points integer check(points in (0,3,6,7,8)),
 yards integer check(yards between -200 and 500), plays integer check(plays between 0 and 200),
 forfeited boolean not null default false,
 primary key(match_id,user_id,ordinal)
);
create index football_drive_user on bk_football_private.drives(user_id);
alter table bk_football_private.matches enable row level security;
alter table bk_football_private.drives enable row level security;
revoke all on all tables in schema bk_football_private from public,anon,authenticated;

create function bk_football_private.settle(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare m bk_football_private.matches%rowtype; a integer; b integer;
begin
 select * into m from bk_football_private.matches where id=p_id for update;
 if m.status<>'active' then return; end if;
 update bk_football_private.drives set points=0,yards=0,plays=0,forfeited=true,finished_at=now()
 where match_id=p_id and finished_at is null and (deadline<=now() or m.expires_at<=now());
 if m.expires_at<=now() then
   insert into bk_football_private.drives(match_id,user_id,ordinal,launch_id,points,yards,plays,forfeited,finished_at)
   select p_id,u,n,gen_random_uuid(),0,0,0,true,now() from unnest(array[m.challenger_id,m.opponent_id]) u cross join generate_series(1,3) n
   on conflict do nothing;
 end if;
 if (select count(*) from bk_football_private.drives where match_id=p_id and finished_at is not null)=6 then
   select coalesce(sum(points) filter(where user_id=m.challenger_id),0),coalesce(sum(points) filter(where user_id=m.opponent_id),0) into a,b from bk_football_private.drives where match_id=p_id;
   update bk_football_private.matches set status='completed',completed_at=now(),winner_id=case when a>b then m.challenger_id when b>a then m.opponent_id else null end where id=p_id;
 end if;
end $$;
revoke all on function bk_football_private.settle(uuid) from public,anon,authenticated;

create function bk_football_private.arena_api(p_action text,p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=ball_knower_private.require_permanent_community_user();
 m bk_football_private.matches%rowtype; d bk_football_private.drives%rowtype;
 opponent uuid; mid uuid; team text; n integer; pts integer; yds integer; snaps integer; stats jsonb; result jsonb; standings jsonb; cleanup record;
begin
 if p_args is null or jsonb_typeof(p_args)<>'object' or octet_length(p_args::text)>4096 then raise exception 'Invalid football request'; end if;
 if p_action='home' then
   -- Settle expired attempts and matches without relying on a player's device clock.
   for cleanup in select id from bk_football_private.matches where status='active' and (me in(challenger_id,opponent_id) or expires_at<=now()) order by created_at limit 200 loop
     perform bk_football_private.settle(cleanup.id);
   end loop;
   update bk_football_private.matches set status='expired' where status in('open','pending') and expires_at<=now();
   select coalesce(jsonb_agg(row),'[]'::jsonb) into result from (
     select c.*,coalesce(p.display_name,'Ball Knower') challenger_name,coalesce(q.display_name,'Opponent') opponent_name,
       coalesce((select jsonb_agg(jsonb_build_object('user_id',x.user_id,'ordinal',x.ordinal,'points',x.points,'yards',x.yards,'plays',x.plays,'forfeited',x.forfeited,'finished_at',x.finished_at,'deadline',x.deadline) order by x.user_id,x.ordinal) from bk_football_private.drives x where x.match_id=c.id),'[]'::jsonb) drives
     from bk_football_private.matches c left join public.ball_knower_progress_profiles p on p.user_id=c.challenger_id left join public.ball_knower_progress_profiles q on q.user_id=c.opponent_id
     where (me in(c.challenger_id,c.opponent_id) or c.status='open')
       and not exists(select 1 from public.ball_knower_user_blocks b where (b.blocker_id=me and b.blocked_id in(c.challenger_id,c.opponent_id)) or (b.blocked_id=me and b.blocker_id in(c.challenger_id,c.opponent_id)))
       and bk_minigames_private.available(c.challenger_id) and (c.opponent_id is null or bk_minigames_private.available(c.opponent_id))
     order by (c.status='active') desc,c.created_at desc limit 100
   ) row;
   select coalesce(jsonb_agg(row),'[]'::jsonb) into standings from (
     select u.user_id,coalesce(p.display_name,'Ball Knower') name,count(*) games,
       count(*) filter(where c.winner_id=u.user_id) wins,count(*) filter(where c.winner_id is not null and c.winner_id<>u.user_id) losses,count(*) filter(where c.winner_id is null) ties,
       count(*) filter(where c.winner_id=u.user_id)*3+count(*) filter(where c.winner_id is null) rating
     from bk_football_private.matches c cross join lateral unnest(array[c.challenger_id,c.opponent_id]) u(user_id)
     left join public.ball_knower_progress_profiles p on p.user_id=u.user_id
     where c.status='completed' and bk_minigames_private.available(u.user_id)
       and not exists(select 1 from public.ball_knower_user_blocks b where (b.blocker_id=me and b.blocked_id=u.user_id) or (b.blocked_id=me and b.blocker_id=u.user_id))
     group by u.user_id,p.display_name order by rating desc,wins desc,u.user_id limit 50
   ) row;
   return jsonb_build_object('matches',result,'standings',standings);
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bk-football:'||me::text,0));
 if p_action in('create','accept') then
   team:=p_args->>'team';
   if team is null or not team=any(array['ABQ','ANC','AUS','BIR','BOI','BRK','CHS','CLB','DSM','HFD','HNL','JCY','LOU','MEM','MIL','OKC','OMA','ORL','POR','RAL','RIC','RNO','SAC','SLC','SAT','SDG','STL','TOR','VBH','ALB','ELP','FAR']) then raise exception 'Choose a season 1 team'; end if;
 end if;
 if p_action='create' then
   if (select count(*) from bk_football_private.matches where challenger_id=me and created_at>now()-interval '1 hour')>=20 then raise exception 'Challenge limit reached. Try again later.'; end if;
   if (select count(*) from bk_football_private.matches where me in(challenger_id,opponent_id) and status in('open','pending','active') and expires_at>now())>=5 then raise exception 'Finish or cancel an existing match first'; end if;
   opponent:=(p_args->>'opponent')::uuid;
   if opponent is not null then
     if opponent=me or not exists(select 1 from public.ball_knower_friendships where status='accepted' and (requester_id=me and recipient_id=opponent or requester_id=opponent and recipient_id=me)) then raise exception 'Choose an accepted friend'; end if;
     if not bk_minigames_private.available(opponent) or exists(select 1 from public.ball_knower_user_blocks where (blocker_id=me and blocked_id=opponent) or (blocker_id=opponent and blocked_id=me)) then raise exception 'Opponent is unavailable'; end if;
   end if;
   insert into bk_football_private.matches(challenger_id,opponent_id,challenger_team,status) values(me,opponent,team,case when opponent is null then 'open' else 'pending' end) returning id into mid;
   return jsonb_build_object('id',mid);
 end if;
 mid:=(p_args->>'id')::uuid;
 select * into m from bk_football_private.matches where id=mid for update;
 if not found then raise exception 'Match is unavailable'; end if;
 if exists(select 1 from public.ball_knower_user_blocks b where (b.blocker_id=me and b.blocked_id in(m.challenger_id,m.opponent_id)) or (b.blocked_id=me and b.blocker_id in(m.challenger_id,m.opponent_id))) then raise exception 'Match is unavailable'; end if;
 if not bk_minigames_private.available(m.challenger_id) or (m.opponent_id is not null and not bk_minigames_private.available(m.opponent_id)) then raise exception 'Opponent is unavailable'; end if;
 if p_action='accept' then
   if m.expires_at<=now() or m.status not in('open','pending') or m.challenger_id=me or (m.status='pending' and m.opponent_id<>me) then raise exception 'This challenge cannot be accepted'; end if;
   if (select count(*) from bk_football_private.matches where me in(challenger_id,opponent_id) and status='active' and expires_at>now())>=5 then raise exception 'Finish an active match first'; end if;
   update bk_football_private.matches set opponent_id=me,opponent_team=team,status='active',expires_at=now()+interval '24 hours' where id=mid;
   return jsonb_build_object('id',mid);
 end if;
 if me<>m.challenger_id and me is distinct from m.opponent_id then raise exception 'Match is unavailable'; end if;
 if p_action='cancel' and m.challenger_id=me and m.status in('open','pending') then
   update bk_football_private.matches set status='cancelled' where id=mid;return '{}'::jsonb;
 elsif p_action='decline' and m.opponent_id=me and m.status='pending' then
   update bk_football_private.matches set status='declined' where id=mid;return '{}'::jsonb;
 end if;
 perform bk_football_private.settle(mid);
 select * into m from bk_football_private.matches where id=mid;
 n:=(p_args->>'drive')::integer;
 if n is null or n not between 1 and 3 then raise exception 'Choose drive 1, 2 or 3'; end if;
 select * into d from bk_football_private.drives where match_id=mid and user_id=me and ordinal=n;
 -- Result retries are immutable and require the original attempt token, even after finalization.
 if p_action='submit' and d.finished_at is not null then
   if d.token is distinct from (p_args->>'token')::uuid then raise exception 'Invalid drive token'; end if;
   return jsonb_build_object('saved',true,'points',d.points,'forfeited',d.forfeited);
 end if;
 if p_action='forfeit' and d.finished_at is not null then return jsonb_build_object('saved',true); end if;
 if m.status<>'active' then raise exception 'This match is not active'; end if;
 if p_action='begin' then
   if d.match_id is not null then
     if d.finished_at is not null or d.launch_id is distinct from (p_args->>'launch')::uuid then raise exception 'This drive was already started. Record zero for the interrupted drive to continue.'; end if;
   else
     if n<>(select count(*)+1 from bk_football_private.drives where match_id=mid and user_id=me and finished_at is not null) then raise exception 'Finish the previous drive first'; end if;
     insert into bk_football_private.drives(match_id,user_id,ordinal,launch_id) values(mid,me,n,(p_args->>'launch')::uuid) returning * into d;
   end if;
   return jsonb_build_object('token',d.token,'drive',d.ordinal,'deadline',d.deadline,'seed',(m.seed::bigint+n*104729)%2147483647,'team',case when me=m.challenger_id then m.challenger_team else m.opponent_team end,'opponent',case when me=m.challenger_id then m.opponent_team else m.challenger_team end);
 elsif p_action in('submit','forfeit') then
   if d.match_id is null then raise exception 'Start this drive first'; end if;
   if p_action='forfeit' then pts:=0;yds:=0;snaps:=0;
   else
     if d.token is distinct from (p_args->>'token')::uuid then raise exception 'Invalid drive token'; end if;
     if d.started_at>now()-interval '2 seconds' then raise exception 'Complete your drive before submitting'; end if;
     stats:=p_args->'stats';
     if stats is null or jsonb_typeof(stats)<>'object' or not stats ?& array['points','yards','plays'] or stats-array['points','yards','plays']<>'{}'::jsonb then raise exception 'Complete drive stats are required'; end if;
     if exists(select 1 from jsonb_each(stats) v where jsonb_typeof(v.value)<>'number' or v.value::text::numeric<>trunc(v.value::text::numeric)) then raise exception 'Drive stats must be whole numbers'; end if;
     pts:=(stats->>'points')::integer;yds:=(stats->>'yards')::integer;snaps:=(stats->>'plays')::integer;
     if pts not in(0,3,6,7,8) or yds not between -200 and 500 or snaps not between 0 and 200 or (pts>=6 and snaps=0) then raise exception 'Invalid drive stats'; end if;
   end if;
   update bk_football_private.drives set points=pts,yards=yds,plays=snaps,forfeited=p_action='forfeit',finished_at=now() where match_id=mid and user_id=me and ordinal=n;
   perform bk_football_private.settle(mid);
   return jsonb_build_object('saved',true,'points',pts,'forfeited',p_action='forfeit');
 end if;
 raise exception 'Unsupported football action';
end $$;
revoke all on function bk_football_private.arena_api(text,jsonb) from public,anon;
grant execute on function bk_football_private.arena_api(text,jsonb) to authenticated;
create function public.ball_knower_football_arena(p_action text,p_args jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select bk_football_private.arena_api(p_action,p_args) $$;
revoke all on function public.ball_knower_football_arena(text,jsonb) from public,anon;
grant execute on function public.ball_knower_football_arena(text,jsonb) to authenticated;
