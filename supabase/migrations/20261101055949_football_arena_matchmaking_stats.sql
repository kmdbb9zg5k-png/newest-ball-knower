-- Additive detail storage: NULL means unavailable (legacy/forfeited drives).
alter table bk_football_private.drives add column offense_stats jsonb;
alter table bk_football_private.matches add column matchmaking boolean not null default false;

create or replace function bk_football_private.arena_api(p_action text,p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=ball_knower_private.require_permanent_community_user();
 m bk_football_private.matches%rowtype; d bk_football_private.drives%rowtype;
 opponent uuid; mid uuid; team text; n integer; pts integer; yds integer; snaps integer; stats jsonb; details jsonb; result jsonb; standings jsonb; cleanup record;
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
       coalesce((select jsonb_agg(jsonb_build_object('user_id',x.user_id,'ordinal',x.ordinal,'points',x.points,'yards',x.yards,'plays',x.plays,'passingYards',x.offense_stats->'passingYards','rushingYards',x.offense_stats->'rushingYards','passAttempts',x.offense_stats->'passAttempts','completions',x.offense_stats->'completions','touchdowns',x.offense_stats->'touchdowns','turnovers',x.offense_stats->'turnovers','returnTouchdowns',x.offense_stats->'returnTouchdowns','forfeited',x.forfeited,'finished_at',x.finished_at,'deadline',x.deadline) order by x.user_id,x.ordinal) from bk_football_private.drives x where x.match_id=c.id),'[]'::jsonb) drives
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
 -- Queue requests take the shared queue lock before the per-user lock. Nested
 -- create/accept calls retain the same order and cannot pair the same open slot.
 if p_action='quick_match' then
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bk-football-quick-match',0));
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bk-football:'||me::text,0));
 if p_action in('create','accept','quick_match') then
   team:=p_args->>'team';
   if team is null or not team=any(array['ABQ','ANC','AUS','BIR','BOI','BRK','CHS','CLB','DSM','HFD','HNL','JCY','LOU','MEM','MIL','OKC','OMA','ORL','POR','RAL','RIC','RNO','SAC','SLC','SAT','SDG','STL','TOR','VBH','ALB','ELP','FAR']) then raise exception 'Choose a season 1 team'; end if;
 end if;
 if p_action='quick_match' then
   -- Retry lost responses without creating a second match. Friend challenges
   -- are not queue entries and are never silently resumed by quick play.
   select * into m from bk_football_private.matches c where c.matchmaking
     and me in(c.challenger_id,c.opponent_id) and c.status in('open','active') and c.expires_at>now()
     and bk_minigames_private.available(c.challenger_id)
     and (c.opponent_id is null or bk_minigames_private.available(c.opponent_id))
     and not exists(select 1 from public.ball_knower_user_blocks b where
       (b.blocker_id=me and b.blocked_id in(c.challenger_id,c.opponent_id)) or
       (b.blocked_id=me and b.blocker_id in(c.challenger_id,c.opponent_id)))
     order by (c.status='active') desc,c.created_at limit 1;
   if found then return jsonb_build_object('id',m.id,'status',m.status); end if;
   select * into m from bk_football_private.matches c where c.matchmaking
     and c.status='open' and c.expires_at>now() and c.challenger_id<>me
     and bk_minigames_private.available(c.challenger_id)
     and not exists(select 1 from public.ball_knower_user_blocks b where
       (b.blocker_id=me and b.blocked_id=c.challenger_id) or (b.blocked_id=me and b.blocker_id=c.challenger_id))
     order by c.created_at,c.id limit 1 for update;
   if found then
     perform bk_football_private.arena_api('accept',jsonb_build_object('id',m.id,'team',team));
     return jsonb_build_object('id',m.id,'status','active');
   end if;
   result:=bk_football_private.arena_api('create',jsonb_build_object('team',team));
   mid:=(result->>'id')::uuid;
   update bk_football_private.matches set matchmaking=true,expires_at=now()+interval '45 seconds' where id=mid;
   return jsonb_build_object('id',mid,'status','open');
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
     if stats is null or jsonb_typeof(stats)<>'object' or not stats ?& array['points','yards','plays'] or stats-array['points','yards','plays','passingYards','rushingYards','passAttempts','completions','touchdowns','turnovers','returnTouchdowns']<>'{}'::jsonb then raise exception 'Complete drive stats are required'; end if;
     if exists(select 1 from jsonb_each(stats) v where jsonb_typeof(v.value)<>'number' or v.value::text::numeric<>trunc(v.value::text::numeric)) then raise exception 'Drive stats must be whole numbers'; end if;
     details:=stats-array['points','yards','plays'];
     if details<>'{}'::jsonb then
       if not details ?& array['passingYards','rushingYards','passAttempts','completions','touchdowns','turnovers'] then raise exception 'Complete offensive stats are required'; end if;
       if (details->>'passingYards')::numeric not between -200 and 500
         or (details->>'rushingYards')::numeric not between -200 and 500
         or (details->>'passAttempts')::numeric not between 0 and 200
         or (details->>'completions')::numeric not between 0 and (details->>'passAttempts')::numeric
         or (details->>'passAttempts')::numeric>(stats->>'plays')::numeric
         or (details->>'touchdowns')::numeric not between 0 and 1
         or (details->>'turnovers')::numeric not between 0 and 1
         or coalesce((details->>'returnTouchdowns')::numeric,0) not between 0 and 1
         or (details->>'touchdowns')::numeric+coalesce((details->>'returnTouchdowns')::numeric,0)>1
         or (coalesce((details->>'returnTouchdowns')::numeric,0)=1 and (stats->>'points')::numeric<6)
       then raise exception 'Invalid offensive stats'; end if;
     else details:=null; end if;
     pts:=(stats->>'points')::integer;yds:=(stats->>'yards')::integer;snaps:=(stats->>'plays')::integer;
     if pts not in(0,3,6,7,8) or yds not between -200 and 500 or snaps not between 0 and 200 or (pts>=6 and snaps=0 and coalesce((details->>'returnTouchdowns')::integer,0)<>1) then raise exception 'Invalid drive stats'; end if;
   end if;
   update bk_football_private.drives set points=pts,yards=yds,plays=snaps,offense_stats=details,forfeited=p_action='forfeit',finished_at=now() where match_id=mid and user_id=me and ordinal=n;
   perform bk_football_private.settle(mid);
   return jsonb_build_object('saved',true,'points',pts,'forfeited',p_action='forfeit');
 end if;
 raise exception 'Unsupported football action';
end $$;
