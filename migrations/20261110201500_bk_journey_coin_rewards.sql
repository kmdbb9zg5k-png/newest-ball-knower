-- BK Journey: verified-XP milestone rewards. No client-writeable balances.
-- Rewards deliberately do not auto-equip an item the Locker cannot yet render.
create table if not exists public.ball_knower_journey_wallet (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  coins integer not null default 0 check (coins >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.ball_knower_journey_claims (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  checkpoint integer not null check (checkpoint between 1 and 5),
  required_xp integer not null check (required_xp >= 0),
  coins_awarded integer not null default 0 check (coins_awarded >= 0),
  gift_id text,
  claimed_at timestamptz not null default now(),
  primary key (auth_user_id, checkpoint)
);
create index if not exists ball_knower_journey_claims_user_claimed
  on public.ball_knower_journey_claims(auth_user_id, claimed_at desc);
alter table public.ball_knower_journey_wallet enable row level security;
alter table public.ball_knower_journey_claims enable row level security;
revoke all on public.ball_knower_journey_wallet from public, anon, authenticated;
revoke all on public.ball_knower_journey_claims from public, anon, authenticated;

-- Read-only report. XP comes only from the preexisting server-verified profile.
create or replace function public.bk_journey_state()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_start timestamptz := ((now() at time zone 'UTC')::date::timestamp at time zone 'UTC');
  v_xp bigint := 0;
  v_level integer := 1;
  v_coins integer := 0;
  v_trivia integer := 0;
  v_picks integer := 0;
  v_h2h integer := 0;
  v_claims jsonb := '[]'::jsonb;
begin
  if v_user is null then raise exception 'Sign in to view BK Journey' using errcode='42501'; end if;
  select coalesce(xp,0),coalesce(level,1) into v_xp,v_level
  from public.ball_knower_progress_profiles where user_id=v_user;
  select coalesce(coins,0) into v_coins
  from public.ball_knower_journey_wallet where auth_user_id=v_user;
  select coalesce(jsonb_agg(jsonb_build_object(
    'checkpoint',c.checkpoint,'coins',c.coins_awarded,
    'gift',c.gift_id,'claimedAt',c.claimed_at
  ) order by c.checkpoint),'[]'::jsonb)
  into v_claims from public.ball_knower_journey_claims c where c.auth_user_id=v_user;
  select count(*)::integer into v_trivia
  from public.ball_knower_progress_events e
  where e.user_id=v_user and e.category='trivia' and e.xp_awarded>0
  and e.occurred_at>=v_start and e.occurred_at<v_start+interval '1 day';
  select count(*)::integer into v_picks
  from public.ball_knower_progress_events e
  where e.user_id=v_user and e.category='prediction'
  and e.event_type in('prediction_correct','prediction_wrong','prediction_push')
  and e.occurred_at>=v_start and e.occurred_at<v_start+interval '1 day';
  select count(*)::integer into v_h2h
  from public.ball_knower_h2h_matches m
  where (m.challenger_id=v_user or m.opponent_id=v_user)
    and m.status in('completed','finished','final')
    and m.finished_at>=v_start and m.finished_at<v_start+interval '1 day';
  return jsonb_build_object(
    'xp',coalesce(v_xp,0),'level',coalesce(v_level,1),
    'coins',coalesce(v_coins,0),'claims',v_claims,
    'today',jsonb_build_object('trivia',v_trivia,'prediction',v_picks,'h2h',v_h2h),
    'todayDate',(now() at time zone 'UTC')::date::text,
    'source','verified'
  );
end;
$$;

-- Atomically claim one permanent XP milestone; concurrent requests cannot mint twice.
create or replace function public.bk_journey_claim(p_checkpoint integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_xp bigint := 0;
  v_need integer;
  v_coins integer;
  v_gift text;
  v_inserted integer := 0;
begin
  if v_user is null then raise exception 'Sign in to claim BK rewards' using errcode='42501'; end if;
  if p_checkpoint is null or p_checkpoint not between 1 and 5
  then raise exception 'Unknown BK Journey milestone' using errcode='22023'; end if;
  v_need := (array[25,100,250,500,1000])[p_checkpoint];
  v_coins := (array[50,100,0,200,100])[p_checkpoint];
  v_gift := case p_checkpoint when 3 then 'rookie-crown-badge'
                              when 5 then 'golden-bk-nameplate' else null end;
  select coalesce(xp,0) into v_xp
  from public.ball_knower_progress_profiles where user_id=v_user;
  if coalesce(v_xp,0)<v_need then
    raise exception 'Earn verified XP to unlock this reward' using errcode='22023';
  end if;
  insert into public.ball_knower_journey_claims
    (auth_user_id,checkpoint,required_xp,coins_awarded,gift_id)
  values (v_user,p_checkpoint,v_need,v_coins,v_gift)
  on conflict (auth_user_id,checkpoint) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted=1 and v_coins>0 then
    insert into public.ball_knower_journey_wallet(auth_user_id,coins,updated_at)
    values (v_user,v_coins,now())
    on conflict (auth_user_id) do update
      set coins=public.ball_knower_journey_wallet.coins+excluded.coins,updated_at=now();
  end if;
  return jsonb_build_object('claimed',v_inserted=1,'alreadyOwned',v_inserted=0,
    'checkpoint',p_checkpoint,'coinsAwarded',case when v_inserted=1 then v_coins else 0 end,
    'gift',v_gift);
end;
$$;
revoke all on function public.bk_journey_state() from public,anon;
revoke all on function public.bk_journey_claim(integer) from public,anon;
grant execute on function public.bk_journey_state() to authenticated;
grant execute on function public.bk_journey_claim(integer) to authenticated;
