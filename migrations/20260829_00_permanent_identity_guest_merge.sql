-- Preserve anonymous play when the browser later signs into an existing
-- permanent Supabase account. A short-lived, one-time claim token proves that
-- the permanent session originated from the browser that owned the guest.
create table if not exists public.ball_knower_guest_account_claims (
  token_hash bytea primary key,
  guest_user_id uuid not null unique references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null,
  guest_gauntlet_v2 jsonb,
  guest_gauntlet_v1 jsonb,
  gauntlet_events_copied integer not null default 0,
  verified_events_copied integer not null default 0,
  leagues_transferred integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.ball_knower_guest_account_claims enable row level security;
revoke all on table public.ball_knower_guest_account_claims from public,anon,authenticated;

create index if not exists ball_knower_guest_claims_expiry_idx
on public.ball_knower_guest_account_claims(expires_at)
where claimed_at is null;

create or replace function ball_knower_private.rebuild_progress_profile(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path='public','ball_knower_private','pg_temp'
as $function$
declare
  v_event public.ball_knower_progress_events%rowtype;
  v_display_name text;
  v_xp bigint:=0;
  v_football_iq integer:=50;
  v_gm integer:=50;
  v_prediction integer:=50;
  v_trivia integer:=50;
  v_agent integer:=50;
  v_owner integer:=50;
  v_championships integer:=0;
  v_current_streak integer:=0;
  v_longest_streak integer:=0;
begin
  select display_name into v_display_name
  from public.ball_knower_progress_profiles where user_id=p_user_id;

  for v_event in
    select * from public.ball_knower_progress_events
    where user_id=p_user_id order by occurred_at,id
  loop
    v_xp:=v_xp+greatest(0,v_event.xp_awarded);
    if v_event.category='football_iq' then v_football_iq:=greatest(0,least(99,v_football_iq+v_event.rating_delta)); end if;
    if v_event.category='gm' then v_gm:=greatest(0,least(99,v_gm+v_event.rating_delta)); end if;
    if v_event.category='prediction' then v_prediction:=greatest(0,least(99,v_prediction+v_event.rating_delta)); end if;
    if v_event.category='trivia' then v_trivia:=greatest(0,least(99,v_trivia+v_event.rating_delta)); end if;
    if v_event.category='agent' then v_agent:=greatest(0,least(99,v_agent+v_event.rating_delta)); end if;
    if v_event.category='owner' then v_owner:=greatest(0,least(99,v_owner+v_event.rating_delta)); end if;
    if v_event.event_type='league_championship' then v_championships:=v_championships+1; end if;
    if v_event.event_type in ('trivia_correct','trivia_hof_correct','prediction_correct','league_win') then
      v_current_streak:=v_current_streak+1;
      v_longest_streak:=greatest(v_longest_streak,v_current_streak);
    elsif v_event.event_type in ('trivia_wrong','prediction_wrong','league_loss') then
      v_current_streak:=0;
    end if;
  end loop;

  insert into public.ball_knower_progress_profiles(
    user_id,display_name,bk_rating,xp,level,football_iq,gm_rating,prediction_rating,
    trivia_rating,agent_rating,owner_rating,championships,current_streak,longest_streak,updated_at
  ) values (
    p_user_id,coalesce(v_display_name,'Ball Knower'),
    round((v_football_iq+v_gm+v_prediction+v_trivia+v_agent+v_owner)/6.0)::integer,
    v_xp,greatest(1,1+floor(v_xp/1000.0)::integer),v_football_iq,v_gm,v_prediction,
    v_trivia,v_agent,v_owner,v_championships,v_current_streak,v_longest_streak,clock_timestamp()
  )
  on conflict(user_id) do update set
    bk_rating=excluded.bk_rating,xp=excluded.xp,level=excluded.level,
    football_iq=excluded.football_iq,gm_rating=excluded.gm_rating,
    prediction_rating=excluded.prediction_rating,trivia_rating=excluded.trivia_rating,
    agent_rating=excluded.agent_rating,owner_rating=excluded.owner_rating,
    championships=excluded.championships,current_streak=excluded.current_streak,
    longest_streak=excluded.longest_streak,updated_at=excluded.updated_at;
end;
$function$;

revoke all on function ball_knower_private.rebuild_progress_profile(uuid) from public,anon,authenticated;

create or replace function public.prepare_ball_knower_guest_merge()
returns text
language plpgsql
security definer
set search_path='public','extensions','pg_temp'
as $function$
declare
  v_guest uuid:=(select auth.uid());
  v_token text:=encode(extensions.gen_random_bytes(32),'hex');
  v_is_anonymous boolean;
  v_gauntlet_v2 jsonb;
  v_gauntlet_v1 jsonb;
begin
  if v_guest is null then raise exception 'Authentication required'; end if;
  select is_anonymous into v_is_anonymous from auth.users where id=v_guest;
  if coalesce(v_is_anonymous,false) is not true then raise exception 'Only a guest account can prepare a merge'; end if;

  select value into v_gauntlet_v2 from public.ball_knower_user_state
  where user_id=v_guest and state_key='gauntlet_progress_v2';
  select value into v_gauntlet_v1 from public.ball_knower_user_state
  where user_id=v_guest and state_key='gauntlet_progress_v1';

  insert into public.ball_knower_guest_account_claims(
    token_hash,guest_user_id,expires_at,guest_gauntlet_v2,guest_gauntlet_v1,
    claimed_at,claimed_by,gauntlet_events_copied,verified_events_copied,leagues_transferred,created_at
  ) values (
    extensions.digest(v_token,'sha256'),v_guest,clock_timestamp()+interval '24 hours',
    v_gauntlet_v2,v_gauntlet_v1,null,null,0,0,0,clock_timestamp()
  )
  on conflict(guest_user_id) do update set
    token_hash=excluded.token_hash,expires_at=excluded.expires_at,
    guest_gauntlet_v2=excluded.guest_gauntlet_v2,guest_gauntlet_v1=excluded.guest_gauntlet_v1,
    claimed_at=null,claimed_by=null,gauntlet_events_copied=0,
    verified_events_copied=0,leagues_transferred=0,created_at=excluded.created_at;
  return v_token;
end;
$function$;

revoke all on function public.prepare_ball_knower_guest_merge() from public,anon;
grant execute on function public.prepare_ball_knower_guest_merge() to authenticated;

create or replace function public.claim_ball_knower_guest_merge(p_token text)
returns table(
  guest_user_id uuid,
  guest_gauntlet_v2 jsonb,
  guest_gauntlet_v1 jsonb,
  gauntlet_events_copied integer,
  verified_events_copied integer,
  leagues_transferred integer
)
language plpgsql
security definer
set search_path='public','ball_knower_private','extensions','pg_temp'
as $function$
declare
  v_target uuid:=(select auth.uid());
  v_target_is_anonymous boolean;
  v_claim public.ball_knower_guest_account_claims%rowtype;
  v_gauntlet_count integer:=0;
  v_verified_count integer:=0;
  v_league_count integer:=0;
begin
  if v_target is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(coalesce(p_token,'')),'') is null then raise exception 'Guest merge token required'; end if;
  select is_anonymous into v_target_is_anonymous from auth.users where id=v_target;
  if coalesce(v_target_is_anonymous,true) then raise exception 'Sign in to a permanent account before claiming guest progress'; end if;

  select * into v_claim from public.ball_knower_guest_account_claims
  where token_hash=extensions.digest(p_token,'sha256') for update;
  if v_claim.guest_user_id is null then raise exception 'Guest merge token is invalid'; end if;
  if v_claim.expires_at<clock_timestamp() then raise exception 'Guest merge token expired'; end if;
  if v_claim.guest_user_id=v_target then raise exception 'Guest and permanent identities must differ'; end if;
  if v_claim.claimed_at is not null and v_claim.claimed_by is distinct from v_target then
    raise exception 'Guest progress was already claimed by another account';
  end if;

  if v_claim.claimed_at is null then
    insert into public.ball_knower_gauntlet_progress_events(user_id,event_id,occurred_at,payload,created_at)
    select v_target,event_id,occurred_at,payload,created_at
    from public.ball_knower_gauntlet_progress_events where user_id=v_claim.guest_user_id
    on conflict(user_id,event_id) do nothing;
    get diagnostics v_gauntlet_count=row_count;

    insert into public.ball_knower_progress_events(
      user_id,event_key,event_type,category,xp_awarded,rating_delta,metadata,occurred_at
    )
    select v_target,event_key,event_type,category,xp_awarded,rating_delta,metadata,occurred_at
    from public.ball_knower_progress_events where user_id=v_claim.guest_user_id
    on conflict(user_id,event_key) do nothing;
    get diagnostics v_verified_count=row_count;

    insert into public.ball_knower_user_achievements(user_id,achievement_key,unlocked_at,source_event_key)
    select v_target,achievement_key,unlocked_at,source_event_key
    from public.ball_knower_user_achievements where user_id=v_claim.guest_user_id
    on conflict(user_id,achievement_key) do update set
      unlocked_at=least(public.ball_knower_user_achievements.unlocked_at,excluded.unlocked_at);

    perform ball_knower_private.rebuild_progress_profile(v_target);

    -- Preserve the most recently saved non-Gauntlet mode state. Gauntlet v2 is
    -- merged by the event-aware client immediately after this RPC returns.
    insert into public.ball_knower_user_state as target(user_id,state_key,value,updated_at)
    select v_target,state_key,value,updated_at
    from public.ball_knower_user_state
    where user_id=v_claim.guest_user_id and state_key not in ('gauntlet_progress_v1','gauntlet_progress_v2')
    on conflict(user_id,state_key) do update set
      value=case when excluded.updated_at>target.updated_at then excluded.value else target.value end,
      updated_at=greatest(target.updated_at,excluded.updated_at);

    -- Transfer every league that the permanent identity does not already own.
    update public.ball_knower_league_members member set
      auth_user_id=v_target,
      app_user_id=v_target::text
    where member.auth_user_id=v_claim.guest_user_id
      and not exists (
        select 1 from public.ball_knower_league_members existing
        where existing.league_id=member.league_id and existing.auth_user_id=v_target
      );
    get diagnostics v_league_count=row_count;

    -- If both identities already joined the same league, keep one human owner
    -- and safely convert the superseded guest slot to CPU instead of deleting
    -- its roster, scores, waiver history, or draft references.
    update public.ball_knower_league_members guest set
      auth_user_id=null,app_user_id=null,is_ai=true,is_commissioner=false,
      ai_archetype=coalesce(guest.ai_archetype,'balanced')
    where guest.auth_user_id=v_claim.guest_user_id
      and exists (
        select 1 from public.ball_knower_league_members existing
        where existing.league_id=guest.league_id and existing.auth_user_id=v_target
      );

    update public.ball_knower_league_members permanent set is_commissioner=true
    where permanent.auth_user_id=v_target and exists (
      select 1 from public.ball_knower_leagues league
      where league.id=permanent.league_id and league.commissioner_auth_id=v_claim.guest_user_id
    );
    update public.ball_knower_leagues set commissioner_auth_id=v_target
    where commissioner_auth_id=v_claim.guest_user_id;

    update public.ball_knower_league_messages set auth_user_id=v_target
    where auth_user_id=v_claim.guest_user_id;
    update public.ball_knower_notifications set auth_user_id=v_target
    where auth_user_id=v_claim.guest_user_id;
    update public.ball_knower_roster_revisions set auth_user_id=v_target
    where auth_user_id=v_claim.guest_user_id;

    -- Answered attempts are immutable history used by repeat suppression. Open
    -- guest attempts remain with the guest so they cannot conflict with an
    -- active attempt already open on the permanent account.
    update ball_knower_private.trivia_attempts set user_id=v_target
    where user_id=v_claim.guest_user_id and answered_at is not null;

    update public.ball_knower_guest_account_claims set
      claimed_at=clock_timestamp(),claimed_by=v_target,
      gauntlet_events_copied=v_gauntlet_count,
      verified_events_copied=v_verified_count,
      leagues_transferred=v_league_count
    where token_hash=v_claim.token_hash;
  else
    v_gauntlet_count:=v_claim.gauntlet_events_copied;
    v_verified_count:=v_claim.verified_events_copied;
    v_league_count:=v_claim.leagues_transferred;
  end if;

  return query select
    v_claim.guest_user_id,v_claim.guest_gauntlet_v2,v_claim.guest_gauntlet_v1,
    v_gauntlet_count,v_verified_count,v_league_count;
end;
$function$;

revoke all on function public.claim_ball_knower_guest_merge(text) from public,anon;
grant execute on function public.claim_ball_knower_guest_merge(text) to authenticated;
