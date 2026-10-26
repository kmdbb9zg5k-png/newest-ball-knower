-- Casual, device-reported game challenges. Server owns invitations, attempts,
-- stat validation, comparison, expiry and immutable results. No trivia rating writes.
create schema if not exists bk_minigames_private;
revoke all on schema bk_minigames_private from public,anon;
grant usage on schema bk_minigames_private to authenticated;
create table bk_minigames_private.challenges(
 id uuid primary key default gen_random_uuid(),
 game text not null check(game in('dash','broad-jump','shuttle','bench','routes','one-on-one','rb','db','two-minute','five-minute')),
 challenger_id uuid not null references auth.users(id) on delete cascade,
 opponent_id uuid references auth.users(id) on delete cascade,
 status text not null check(status in('open','pending','active','completed','cancelled','declined','expired')),
 seed bigint not null default floor(random()*2147483647),
 challenger_stats jsonb,opponent_stats jsonb,challenger_score numeric[],opponent_score numeric[],winner_id uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '24 hours',
 check(challenger_id is distinct from opponent_id)
);
create index mini_challenger_created on bk_minigames_private.challenges(challenger_id,created_at desc);
create index mini_opponent_created on bk_minigames_private.challenges(opponent_id,created_at desc);
create index mini_open_created on bk_minigames_private.challenges(created_at desc) where status='open';
create index mini_winner on bk_minigames_private.challenges(winner_id);
create table bk_minigames_private.attempts(
 challenge_id uuid not null references bk_minigames_private.challenges(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 token uuid not null default gen_random_uuid(),started_at timestamptz not null default now(),
 primary key(challenge_id,user_id)
);
create index mini_attempt_user on bk_minigames_private.attempts(user_id);
alter table bk_minigames_private.challenges enable row level security;
alter table bk_minigames_private.attempts enable row level security;
revoke all on all tables in schema bk_minigames_private from public,anon,authenticated;

create function bk_minigames_private.available(p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from auth.users where id=p_user_id and not coalesce(is_anonymous,false))
 and not exists(select 1 from ball_knower_private.community_suspensions where auth_user_id=p_user_id and expires_at>now())
$$;
revoke all on function bk_minigames_private.available(uuid) from public,anon,authenticated;

-- Only this narrowly scoped function can mutate the private tables.
create function bk_minigames_private.challenge_api(p_action text,p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=ball_knower_private.require_permanent_community_user();
 m bk_minigames_private.challenges%rowtype; a bk_minigames_private.attempts%rowtype;
 opponent uuid; challenge uuid; stats jsonb; scores numeric[]; key text; val jsonb; n numeric; maxval numeric; allowed text[];
begin
 if p_args is null or jsonb_typeof(p_args)<>'object' or octet_length(p_args::text)>4096 then raise exception 'Invalid challenge request'; end if;
 if p_action='list' then
   update bk_minigames_private.challenges set status='expired' where status in('open','pending','active') and expires_at<=now() and (me in(challenger_id,opponent_id) or status='open');
   return coalesce((select jsonb_agg(row) from (
     select c.id,c.game,c.challenger_id,c.opponent_id,c.status,c.seed,c.expires_at,c.created_at,c.challenger_stats,c.opponent_stats,c.winner_id,
       coalesce(p.display_name,'Ball Knower') challenger_name,q.display_name opponent_name
     from bk_minigames_private.challenges c left join public.ball_knower_progress_profiles p on p.user_id=c.challenger_id left join public.ball_knower_progress_profiles q on q.user_id=c.opponent_id
     where (me in(c.challenger_id,c.opponent_id) or (c.status='open' and c.expires_at>now()))
       and not exists(select 1 from public.ball_knower_user_blocks b where (b.blocker_id=me and b.blocked_id in(c.challenger_id,c.opponent_id)) or (b.blocked_id=me and b.blocker_id in(c.challenger_id,c.opponent_id)))
       and not exists(select 1 from ball_knower_private.community_suspensions s where s.auth_user_id in(c.challenger_id,c.opponent_id) and s.expires_at>now())
     order by coalesce(me in(c.challenger_id,c.opponent_id),false) desc,c.created_at desc limit 100
   ) row),'[]'::jsonb);
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bk-mini-user:'||me::text,0));
 if p_action='create' then
   if coalesce(p_args->>'game','') not in('dash','broad-jump','shuttle','bench','routes','one-on-one','rb','db','two-minute','five-minute') then raise exception 'Choose an available game'; end if;
   if (select count(*) from bk_minigames_private.challenges where challenger_id=me and created_at>now()-interval '1 hour')>=20 then raise exception 'Challenge limit reached. Try again later.'; end if;
   if (select count(*) from bk_minigames_private.challenges where challenger_id=me and status in('open','pending','active') and expires_at>now())>=5 then raise exception 'Finish or cancel an existing challenge first'; end if;
   opponent:=(p_args->>'opponent')::uuid;
   if opponent is not null then
     if opponent=me then raise exception 'Choose another Ball Knower'; end if;
     if not exists(select 1 from public.ball_knower_friendships where status='accepted' and (requester_id=me and recipient_id=opponent or requester_id=opponent and recipient_id=me)) then raise exception 'Choose an accepted friend'; end if;
     if not bk_minigames_private.available(opponent) then raise exception 'Opponent is unavailable'; end if;
     if exists(select 1 from public.ball_knower_user_blocks where (blocker_id=me and blocked_id=opponent) or (blocker_id=opponent and blocked_id=me)) then raise exception 'Opponent is unavailable'; end if;
   end if;
   insert into bk_minigames_private.challenges(game,challenger_id,opponent_id,status) values(p_args->>'game',me,opponent,case when opponent is null then 'open' else 'pending' end) returning id into challenge;
   return jsonb_build_object('id',challenge);
 end if;
 challenge:=(p_args->>'id')::uuid;
 select * into m from bk_minigames_private.challenges where id=challenge for update;
 if not found then raise exception 'Challenge is unavailable'; end if;
 if exists(select 1 from public.ball_knower_user_blocks b where (b.blocker_id=me and b.blocked_id in(m.challenger_id,m.opponent_id)) or (b.blocked_id=me and b.blocker_id in(m.challenger_id,m.opponent_id))) then raise exception 'Challenge is unavailable'; end if;
 if m.expires_at<=now() and m.status in('open','pending','active') then raise exception 'This challenge has expired. Start a new one.'; end if;
 if p_action='accept' then
   if m.challenger_id=me or m.status not in('open','pending') or (m.status='pending' and m.opponent_id<>me) then raise exception 'Challenge cannot be accepted'; end if;
   if not bk_minigames_private.available(m.challenger_id) then raise exception 'Opponent is unavailable'; end if;
   if (select count(*) from bk_minigames_private.challenges where opponent_id=me and status='active' and expires_at>now())>=10 then raise exception 'Finish your active challenges first'; end if;
   update bk_minigames_private.challenges set opponent_id=me,status='active' where id=challenge;
   return jsonb_build_object('id',challenge);
 end if;
 if me<>m.challenger_id and me is distinct from m.opponent_id then raise exception 'Challenge is unavailable'; end if;
 if p_action='cancel' and me=m.challenger_id and m.status in('open','pending') then
   update bk_minigames_private.challenges set status='cancelled' where id=challenge;return '{}'::jsonb;
 elsif p_action='decline' and me=m.opponent_id and m.status='pending' then
   update bk_minigames_private.challenges set status='declined' where id=challenge;return '{}'::jsonb;
 end if;
 if p_action='submit' and ((me=m.challenger_id and m.challenger_stats is not null) or (me=m.opponent_id and m.opponent_stats is not null)) then
   -- Retry after a lost response is safe, but never changes a locked result.
   return jsonb_build_object('status',m.status,'winner_id',m.winner_id);
 end if;
 if m.status<>'active' then raise exception 'This challenge is not active'; end if;
 if not bk_minigames_private.available(case when me=m.challenger_id then m.opponent_id else m.challenger_id end) then raise exception 'Opponent is unavailable'; end if;
 if p_action='begin' then
   if (me=m.challenger_id and m.challenger_stats is not null) or (me=m.opponent_id and m.opponent_stats is not null) then raise exception 'Your result is already locked'; end if;
   insert into bk_minigames_private.attempts(challenge_id,user_id) values(challenge,me) on conflict do nothing;
   select * into a from bk_minigames_private.attempts where challenge_id=challenge and user_id=me;
   return jsonb_build_object('token',a.token);
 elsif p_action='submit' then
   select * into a from bk_minigames_private.attempts where challenge_id=challenge and user_id=me;
   if not found or a.token is distinct from (p_args->>'token')::uuid then raise exception 'Start your challenge turn before posting a result'; end if;
   if a.started_at>now()-interval '2 seconds' then raise exception 'Finish the game before posting a result'; end if;
   stats:=p_args->'stats';
   if stats is null or jsonb_typeof(stats)<>'object' then raise exception 'Invalid game stats'; end if;
   allowed:=case when m.game='dash' then array['time','split10','split20','dnf'] when m.game='shuttle' then array['time','penalty'] when m.game='bench' then array['reps'] when m.game='broad-jump' then array['distance'] when m.game in('two-minute','five-minute') then array['points','yards','passYards','rushYards','turnovers','touchdowns','plays'] else array['score','reps','catches','stops','picks','yards','touchdowns'] end;
   for key,val in select * from jsonb_each(stats) loop
     if not key=any(allowed) or jsonb_typeof(val)<>'number' then raise exception 'Invalid game stat'; end if;
     n:=val::text::numeric;
     maxval:=case when key in('time','penalty') then 120 when key='distance' then 5 when key in('score','points') then 100 when key='dnf' then 1 when key in('yards','passYards','rushYards') then 2000 else 200 end;
     if n<(case when key in('yards','passYards','rushYards') then -200 else 0 end) or n>maxval then raise exception 'Game stat is outside the supported range'; end if;
     if key not in('time','penalty','distance','split10','split20') and n<>trunc(n) then raise exception 'Game count must be a whole number'; end if;
   end loop;
   if m.game in('dash','shuttle') then
     if not stats?'time' or (stats->>'time')::numeric<1 then raise exception 'A completed time is required'; end if;
     if m.game='dash' and coalesce((stats->>'dnf')::int,0)=0 and (not stats?'split10' or not stats?'split20' or (stats->>'split10')::numeric<=0 or (stats->>'split10')::numeric>=(stats->>'split20')::numeric or (stats->>'split20')::numeric>=(stats->>'time')::numeric) then raise exception 'Invalid split times'; end if;
     scores:=array[case when coalesce((stats->>'dnf')::int,0)=1 then -120000 else -round((stats->>'time')::numeric*1000) end];
   elsif m.game='broad-jump' then
     if not stats?'distance' then raise exception 'Jump distance is required'; end if;scores:=array[round((stats->>'distance')::numeric*1000)];
   elsif m.game='bench' then
     if not stats?'reps' then raise exception 'Rep count is required'; end if;scores:=array[(stats->>'reps')::numeric];
   elsif m.game in('two-minute','five-minute') then
     if not stats ?& array['points','yards','turnovers'] then raise exception 'Complete game stats are required'; end if;
     scores:=array[(stats->>'points')::numeric,(stats->>'yards')::numeric,-(stats->>'turnovers')::numeric];
   else
     if not stats ?& array['score','reps'] or (stats->>'reps')::int<>(case when m.game='routes' then 8 else 5 end) then raise exception 'Complete every rep before posting a score'; end if;
     scores:=array[(stats->>'score')::numeric];
   end if;
   if me=m.challenger_id then update bk_minigames_private.challenges set challenger_stats=stats,challenger_score=scores where id=challenge;
   else update bk_minigames_private.challenges set opponent_stats=stats,opponent_score=scores where id=challenge;end if;
   select * into m from bk_minigames_private.challenges where id=challenge;
   if m.challenger_stats is not null and m.opponent_stats is not null then
     update bk_minigames_private.challenges set status='completed',winner_id=case when challenger_score>opponent_score then challenger_id when opponent_score>challenger_score then opponent_id else null end where id=challenge;
   end if;
   return jsonb_build_object('saved',true);
 end if;
 raise exception 'Unsupported challenge action';
end $$;
revoke all on function bk_minigames_private.challenge_api(text,jsonb) from public,anon;
grant execute on function bk_minigames_private.challenge_api(text,jsonb) to authenticated;
create function public.ball_knower_mini_challenges(p_action text,p_args jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select bk_minigames_private.challenge_api(p_action,p_args) $$;
revoke all on function public.ball_knower_mini_challenges(text,jsonb) from public,anon;
grant execute on function public.ball_knower_mini_challenges(text,jsonb) to authenticated;
