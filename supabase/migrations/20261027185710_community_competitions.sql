-- Community competition v1: private tables, permanent-account RPC, immutable device-reported results.
create schema if not exists bk_competition_private;
revoke all on schema bk_competition_private from public,anon;
grant usage on schema bk_competition_private to authenticated;
create table bk_competition_private.crews(
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 3 and 32),
 emblem text not null check(emblem in ('shield','bolt','crown','football')), color text not null check(color in ('green','gold','blue','red')),
 captain uuid references auth.users(id) on delete set null, archived_at timestamptz,
 join_code text unique not null default upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)), created_at timestamptz not null default now()
);
create table bk_competition_private.members(
 user_id uuid primary key references auth.users(id) on delete cascade, crew_id uuid not null references bk_competition_private.crews(id) on delete cascade, joined_at timestamptz not null default now()
);
create index competition_members_crew on bk_competition_private.members(crew_id);
create table bk_competition_private.events(
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 3 and 60),
 crew_id uuid references bk_competition_private.crews(id) on delete restrict,
 creator uuid references auth.users(id) on delete set null, week_start timestamptz unique,
 games text[] not null check(cardinality(games)=3), seed integer not null,
 starts_at timestamptz not null default now(), ends_at timestamptz not null, finalized_at timestamptz,
 check(ends_at>starts_at), check((crew_id is null)=(week_start is not null))
);
create index competition_events_crew on bk_competition_private.events(crew_id,ends_at desc);
create table bk_competition_private.entries(
 event_id uuid references bk_competition_private.events(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 crew_id uuid references bk_competition_private.crews(id) on delete set null,
 joined_at timestamptz not null default now(), final_rank integer,
 primary key(event_id,user_id)
);
create index competition_entries_user on bk_competition_private.entries(user_id,event_id);
create index competition_entries_crew on bk_competition_private.entries(crew_id);
create table bk_competition_private.attempts(
 event_id uuid not null, user_id uuid not null, game text not null, token uuid not null default gen_random_uuid(),
 started_at timestamptz not null default now(), submitted_at timestamptz, stats jsonb, score numeric check(score between 0 and 100),
 primary key(event_id,user_id,game), foreign key(event_id,user_id) references bk_competition_private.entries(event_id,user_id) on delete cascade
);
create table bk_competition_private.rewards(
 event_id uuid not null, user_id uuid not null, badge text not null check(badge in ('champion','finisher')), awarded_at timestamptz not null default now(),
 primary key(event_id,user_id), foreign key(event_id,user_id) references bk_competition_private.entries(event_id,user_id) on delete cascade
);
create index competition_rewards_user on bk_competition_private.rewards(user_id);
create table bk_competition_private.equipment(user_id uuid primary key references auth.users(id) on delete cascade,event_id uuid not null,foreign key(event_id,user_id) references bk_competition_private.rewards(event_id,user_id) on delete cascade);
alter table bk_competition_private.crews enable row level security;
alter table bk_competition_private.members enable row level security;
alter table bk_competition_private.events enable row level security;
alter table bk_competition_private.entries enable row level security;
alter table bk_competition_private.attempts enable row level security;
alter table bk_competition_private.rewards enable row level security;
alter table bk_competition_private.equipment enable row level security;
revoke all on all tables in schema bk_competition_private from public,anon,authenticated;

create table bk_competition_private.activity(user_id uuid references auth.users(id) on delete cascade,action text not null,created_at timestamptz not null default now());
create index competition_activity_user_time on bk_competition_private.activity(user_id,created_at);
alter table bk_competition_private.activity enable row level security;
revoke all on bk_competition_private.activity from public,anon,authenticated;

create function bk_competition_private.score(p_game text,p_stats jsonb) returns numeric
language plpgsql immutable set search_path='' as $$
declare k text; v jsonb; n numeric; allowed text[]; result numeric;
begin
 if p_stats is null or jsonb_typeof(p_stats)<>'object' or octet_length(p_stats::text)>2048 then raise exception 'Invalid stats'; end if;
 allowed:=case p_game when 'dash' then array['time','split10','split20','dnf'] when 'shuttle' then array['time','penalty'] when 'bench' then array['reps'] when 'broad-jump' then array['distance'] else array['score','reps','catches','stops','picks','yards','touchdowns'] end;
 if p_game not in ('dash','shuttle','bench','broad-jump','routes','one-on-one','rb','db') then raise exception 'Unsupported event game'; end if;
 for k,v in select * from jsonb_each(p_stats) loop
  if not k=any(allowed) or jsonb_typeof(v)<>'number' then raise exception 'Invalid stat'; end if;
  n:=v::text::numeric;
  if n<case when k='yards' then -200 else 0 end or n>case when k='yards' then 2000 when k in ('time','penalty','split10','split20') then 120 when k='distance' then 5 when k='dnf' then 1 else 200 end then raise exception 'Stat outside supported range'; end if;
  if k not in ('time','penalty','split10','split20','distance') and n<>trunc(n) then raise exception 'Counts must be whole numbers'; end if;
 end loop;
 if p_game='dash' then
  if coalesce((p_stats->>'dnf')::int,0)=1 then return 0; end if;
  if not p_stats ?& array['time','split10','split20'] or (p_stats->>'split10')::numeric<=0 or (p_stats->>'split10')::numeric>=(p_stats->>'split20')::numeric or (p_stats->>'split20')::numeric>=(p_stats->>'time')::numeric or (p_stats->>'time')::numeric<3 then raise exception 'Invalid split times'; end if;
  result:=(8-(p_stats->>'time')::numeric)*25;
 elsif p_game='shuttle' then
  if not p_stats?'time' or (p_stats->>'time')::numeric<2 then raise exception 'Complete shuttle time required'; end if;
  result:=(10-(p_stats->>'time')::numeric)*20;
 elsif p_game='bench' then
  if not p_stats?'reps' then raise exception 'Rep count required'; end if; result:=(p_stats->>'reps')::numeric*2;
 elsif p_game='broad-jump' then
  if not p_stats?'distance' then raise exception 'Distance required'; end if; result:=(p_stats->>'distance')::numeric*25;
 else
  if not p_stats ?& array['score','reps'] or (p_stats->>'score')::numeric>100 or (p_stats->>'reps')::int<>case when p_game='routes' then 8 else 5 end then raise exception 'Complete every rep'; end if;
  result:=(p_stats->>'score')::numeric;
 end if;
 return round(greatest(0,least(100,result)),3);
end $$;
revoke all on function bk_competition_private.score(text,jsonb) from public,anon,authenticated;

create function bk_competition_private.finalize(p_event uuid) returns void language plpgsql security definer set search_path='' as $$
declare e bk_competition_private.events%rowtype;
begin
 select * into e from bk_competition_private.events where id=p_event for update;
 if not found or e.ends_at>clock_timestamp() or e.finalized_at is not null then return; end if;
 with scores as (select x.user_id,sum(a.score) points from bk_competition_private.entries x join bk_competition_private.attempts a using(event_id,user_id) where x.event_id=e.id and a.submitted_at is not null and bk_minigames_private.available(x.user_id) group by x.user_id having count(*)=3), ranks as(select user_id,rank() over(order by points desc)::integer r from scores)
 update bk_competition_private.entries x set final_rank=r.r from ranks r where x.event_id=e.id and x.user_id=r.user_id;
 insert into bk_competition_private.rewards(event_id,user_id,badge) select event_id,user_id,case when final_rank=1 then 'champion' else 'finisher' end from bk_competition_private.entries where event_id=e.id and final_rank is not null on conflict do nothing;
 update bk_competition_private.events set finalized_at=now() where id=e.id;
end $$;
revoke all on function bk_competition_private.finalize(uuid) from public,anon,authenticated;

create function bk_competition_private.api(p_action text,p_args jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=ball_knower_private.require_permanent_community_user(); crew uuid; c bk_competition_private.crews%rowtype; e bk_competition_private.events%rowtype; a bk_competition_private.attempts%rowtype; eid uuid; week timestamptz:=date_trunc('week',now() at time zone 'UTC') at time zone 'UTC'; games text[]; g text; uid uuid; res jsonb; points numeric;
begin
 if p_args is null or jsonb_typeof(p_args)<>'object' or octet_length(p_args::text)>4096 then raise exception 'Invalid request'; end if;
 perform pg_advisory_xact_lock(hashtextextended('bk-competition-user:'||me::text,0));
 -- Serialize roster/event mutations so a removal cannot race an already-read membership.
 -- Reads only lock the individual event when finalizing.
 if p_action not in ('home','event') then perform pg_advisory_xact_lock(hashtextextended('bk-competition-mutations-v1',0));end if;
 if p_action in ('create_crew','join_crew','create_night','rotate_code') then
  if (select count(*) from bk_competition_private.activity where user_id=me and created_at>now()-interval '24 hours')>=20 then raise exception 'Daily crew action limit reached';end if;
  insert into bk_competition_private.activity(user_id,action) values(me,p_action);
 end if;
 select crew_id into crew from bk_competition_private.members where user_id=me;
 if p_action='create_crew' then
  if crew is not null then raise exception 'Leave your current crew first'; end if;
  insert into bk_competition_private.crews(name,emblem,color,captain) values(trim(p_args->>'name'),p_args->>'emblem',p_args->>'color',me) returning id into crew;
  insert into bk_competition_private.members(user_id,crew_id) values(me,crew);return jsonb_build_object('id',crew);
 elsif p_action='join_crew' then
  if crew is not null then raise exception 'Leave your current crew first'; end if;
  select * into c from bk_competition_private.crews where join_code=upper(trim(p_args->>'code')) and archived_at is null for update;
  if not found or c.captain is null or not coalesce(bk_minigames_private.available(c.captain),false) then raise exception 'Crew code unavailable'; end if;
  if exists(select 1 from public.ball_knower_user_blocks b join bk_competition_private.members m on m.crew_id=c.id and (b.blocker_id=m.user_id or b.blocked_id=m.user_id) where (b.blocker_id=me or b.blocked_id=me)) then raise exception 'Crew unavailable'; end if;
  if (select count(*) from bk_competition_private.members where crew_id=c.id)>=32 then raise exception 'Crew is full'; end if;
  insert into bk_competition_private.members(user_id,crew_id) values(me,c.id);return '{}'::jsonb;
 elsif p_action in ('leave_crew','transfer_captain','rotate_code','remove_member') then
  select * into c from bk_competition_private.crews where id=crew for update;
  if not found then raise exception 'Join a crew first'; end if;
  if p_action='leave_crew' then
   if c.captain=me then
    if exists(select 1 from bk_competition_private.members where crew_id=crew and user_id<>me) then raise exception 'Transfer captaincy before leaving'; end if;
    if exists(select 1 from bk_competition_private.events where crew_id=crew and ends_at>now()) then raise exception 'Wait for your challenge night to finish before disbanding'; end if;
    update bk_competition_private.crews set archived_at=now() where id=crew; delete from bk_competition_private.members where user_id=me;
   else delete from bk_competition_private.members where user_id=me; end if;
  else
   if c.captain<>me then raise exception 'Only the captain can manage the crew'; end if;
   if p_action='rotate_code' then update bk_competition_private.crews set join_code=upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)) where id=crew;
   else
    uid:=(p_args->>'user_id')::uuid;
    if uid is null or uid=me or (p_action='transfer_captain' and not bk_minigames_private.available(uid)) or not exists(select 1 from bk_competition_private.members where crew_id=crew and user_id=uid) then raise exception 'Choose another crew member'; end if;
    if p_action='transfer_captain' then update bk_competition_private.crews set captain=uid where id=crew;
    else delete from bk_competition_private.members where user_id=uid; end if;
   end if;
  end if;return '{}'::jsonb;
 elsif p_action='create_night' then
  select * into c from bk_competition_private.crews where id=crew for update;
  if not found or c.captain<>me then raise exception 'Only your crew captain can host'; end if;
  if (select count(*) from bk_competition_private.events where crew_id=crew and starts_at>now()-interval '7 days')>=7 then raise exception 'Crew event limit reached this week'; end if;
  if exists(select 1 from bk_competition_private.events where crew_id=crew and ends_at>now()) then raise exception 'Finish your current challenge night first'; end if;
  select array_agg(value) into games from jsonb_array_elements_text(p_args->'games');
  if games is null or cardinality(games)<>3 or (select count(distinct x) from unnest(games)x)<>3 or not games<@array['dash','shuttle','bench','broad-jump','routes','one-on-one','rb','db'] then raise exception 'Choose three different drills'; end if;
  if coalesce((p_args->>'hours')::integer,0) not in (1,3,24,72) then raise exception 'Choose an event duration'; end if;
  insert into bk_competition_private.events(title,crew_id,creator,games,seed,ends_at) values(trim(p_args->>'title'),crew,me,games,floor(random()*2147483647)::integer,now()+make_interval(hours=>(p_args->>'hours')::integer)) returning id into eid;return jsonb_build_object('id',eid);
 elsif p_action='home' then
  games:=case mod(floor(extract(epoch from week)/604800)::bigint,3) when 0 then array['dash','broad-jump','bench'] when 1 then array['shuttle','routes','db'] else array['dash','one-on-one','rb'] end;
  insert into bk_competition_private.events(title,week_start,games,seed,starts_at,ends_at) values('Weekly Combine Cup',week,games,mod(extract(epoch from week)::bigint,2147483647)::integer,week,week+interval '7 days') on conflict(week_start) do nothing;
  for eid in select distinct x.event_id from bk_competition_private.entries x join bk_competition_private.events ev on ev.id=x.event_id where x.user_id=me and ev.ends_at<=now() and ev.finalized_at is null order by x.event_id limit 20 loop perform bk_competition_private.finalize(eid);end loop;
  return jsonb_build_object('crew',(select to_jsonb(z) from(select c.*, (select jsonb_agg(jsonb_build_object('user_id',m.user_id,'name',case when not bk_minigames_private.available(m.user_id) or exists(select 1 from public.ball_knower_user_blocks b where (b.blocker_id=me and b.blocked_id=m.user_id) or (b.blocked_id=me and b.blocker_id=m.user_id)) then 'Unavailable member' else coalesce(p.display_name,'Ball Knower') end) order by m.joined_at) from bk_competition_private.members m left join public.ball_knower_progress_profiles p on p.user_id=m.user_id where m.crew_id=c.id) members from bk_competition_private.crews c where c.id=crew)z),
   'events',coalesce((select jsonb_agg(z order by z.starts_at desc) from(select ev.*,exists(select 1 from bk_competition_private.entries x where x.event_id=ev.id and x.user_id=me) joined from bk_competition_private.events ev where ev.week_start=week or ev.crew_id=crew or exists(select 1 from bk_competition_private.entries x where x.event_id=ev.id and x.user_id=me) order by ev.starts_at desc limit 30)z),'[]'::jsonb),
   'rewards',coalesce((select jsonb_agg(z order by z.awarded_at desc) from(select r.*,ev.title,exists(select 1 from bk_competition_private.equipment q where q.user_id=me and q.event_id=r.event_id) equipped from bk_competition_private.rewards r join bk_competition_private.events ev on ev.id=r.event_id where r.user_id=me order by r.awarded_at desc limit 100)z),'[]'::jsonb));
 elsif p_action='equip' then
  eid:=(p_args->>'id')::uuid;
  if not exists(select 1 from bk_competition_private.rewards where event_id=eid and user_id=me) then raise exception 'Earn this badge first'; end if;
  insert into bk_competition_private.equipment(user_id,event_id) values(me,eid) on conflict(user_id) do update set event_id=excluded.event_id;return '{}'::jsonb;
 end if;
 eid:=(p_args->>'id')::uuid;
 select * into e from bk_competition_private.events where id=eid for update;
 if not found then raise exception 'Event unavailable'; end if;
 if e.crew_id is not null and e.crew_id is distinct from crew and not exists(select 1 from bk_competition_private.entries where event_id=e.id and user_id=me) then raise exception 'Event is private to its crew'; end if;
 if p_action='event' then
  perform bk_competition_private.finalize(e.id);
  select * into e from bk_competition_private.events where id=eid;
  return jsonb_build_object('event',to_jsonb(e),'joined',exists(select 1 from bk_competition_private.entries where event_id=e.id and user_id=me),
   'mine',coalesce((select jsonb_agg(jsonb_build_object('game',game,'stats',stats,'score',score,'submitted_at',submitted_at)) from bk_competition_private.attempts where event_id=e.id and user_id=me),'[]'::jsonb),
   'crew_standings',coalesce((select jsonb_agg(z order by z.points desc,z.name) from (
    select c.id,c.name,round(sum(t.points)/5,3) points,count(*) contributors from (
      select x.crew_id,x.user_id,sum(coalesce(a.score,0)) points,row_number() over(partition by x.crew_id order by sum(coalesce(a.score,0)) desc,x.user_id) slot
      from bk_competition_private.entries x left join bk_competition_private.attempts a using(event_id,user_id)
      where x.event_id=e.id and x.crew_id is not null and bk_minigames_private.available(x.user_id)
      group by x.crew_id,x.user_id
    )t join bk_competition_private.crews c on c.id=t.crew_id where t.slot<=5 group by c.id,c.name order by points desc,c.id limit 30)z),'[]'::jsonb),
   'standings',coalesce((select jsonb_agg(z order by z.points desc,z.name) from(select x.user_id,coalesce(p.display_name,'Ball Knower') name,sum(coalesce(a.score,0)) points,count(a.submitted_at) completed,x.final_rank,c.name crew_name,(select r.badge from bk_competition_private.equipment q join bk_competition_private.rewards r using(user_id,event_id) where q.user_id=x.user_id) badge from bk_competition_private.entries x left join bk_competition_private.attempts a using(event_id,user_id) left join public.ball_knower_progress_profiles p on p.user_id=x.user_id left join bk_competition_private.crews c on c.id=x.crew_id where x.event_id=e.id and bk_minigames_private.available(x.user_id) and not exists(select 1 from public.ball_knower_user_blocks b where (b.blocker_id=me and b.blocked_id=x.user_id) or (b.blocked_id=me and b.blocker_id=x.user_id)) group by x.user_id,p.display_name,x.final_rank,c.name order by points desc,x.user_id limit 100)z),'[]'::jsonb));
 end if;
 -- A lost-response retry may retrieve its own immutable result after closure/removal.
 if p_action='submit' then
  select * into a from bk_competition_private.attempts where event_id=e.id and user_id=me and game=p_args->>'game';
  if a.submitted_at is not null then
   if a.token is distinct from (p_args->>'token')::uuid then raise exception 'Start the drill first';end if;
   return jsonb_build_object('score',a.score,'stats',a.stats);
  end if;
 end if;
 if e.crew_id is not null and exists(select 1 from public.ball_knower_user_blocks b join bk_competition_private.members m on m.crew_id=e.crew_id and (b.blocker_id=m.user_id or b.blocked_id=m.user_id) where b.blocker_id=me or b.blocked_id=me) then raise exception 'Crew competition unavailable while a member is blocked';end if;
 if e.finalized_at is not null or clock_timestamp()<e.starts_at or clock_timestamp()>=e.ends_at then raise exception 'Event is closed'; end if;
 if e.crew_id is not null and e.crew_id is distinct from crew then raise exception 'Rejoin the crew to compete'; end if;
 if p_action='join_event' then
  insert into bk_competition_private.entries(event_id,user_id,crew_id) values(e.id,me,crew) on conflict do nothing;return '{}'::jsonb;
 end if;
 if not exists(select 1 from bk_competition_private.entries where event_id=e.id and user_id=me) then raise exception 'Join the event first'; end if;
 g:=p_args->>'game';if g is null or not g=any(e.games) then raise exception 'Choose an event drill'; end if;
 select * into a from bk_competition_private.attempts where event_id=e.id and user_id=me and game=g;
 if p_action='begin' then
  if a.submitted_at is not null then raise exception 'This result is locked'; end if;
  insert into bk_competition_private.attempts(event_id,user_id,game) values(e.id,me,g) on conflict do nothing;
  select * into a from bk_competition_private.attempts where event_id=e.id and user_id=me and game=g;
  return jsonb_build_object('token',a.token,'seed',e.seed);
 elsif p_action='submit' then
  if a.token is null or a.token is distinct from (p_args->>'token')::uuid then raise exception 'Start the drill first'; end if;
  if a.submitted_at is not null then return jsonb_build_object('score',a.score,'stats',a.stats);end if;
  if a.started_at>now()-interval '2 seconds' then raise exception 'Complete your attempt before submitting';end if;
  points:=bk_competition_private.score(g,p_args->'stats');
  update bk_competition_private.attempts set stats=p_args->'stats',score=points,submitted_at=clock_timestamp() where event_id=e.id and user_id=me and game=g;
  return jsonb_build_object('score',points,'stats',p_args->'stats');
 end if;
 raise exception 'Unsupported competition action';
end $$;
revoke all on function bk_competition_private.api(text,jsonb) from public,anon;
grant execute on function bk_competition_private.api(text,jsonb) to authenticated;
create function public.ball_knower_competitions(p_action text,p_args jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select bk_competition_private.api(p_action,p_args)$$;
revoke all on function public.ball_knower_competitions(text,jsonb) from public,anon;
grant execute on function public.ball_knower_competitions(text,jsonb) to authenticated;
