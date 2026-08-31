-- Phase 4B post-merge hardening.
-- Keep Owner snapshots monotonic across tabs/devices and preserve the most
-- advanced verified Owner run when guest progress is claimed.

-- Backfill pre-revision Owner cloud snapshots before the new client can sync.
-- This makes an old revision-zero device lose to the existing cloud copy
-- instead of uploading stale local progress over it during rollout.
update public.ball_knower_user_state
set value=value||jsonb_build_object('cloudRevision',1)
where state_key='owner_business_career_v1'
  and jsonb_typeof(value)='object'
  and (
    not (value ? 'cloudRevision')
    or value->>'cloudRevision' is null
    or (value->>'cloudRevision')!~'^[0-9]{1,16}$'
  );
-- Phase 4B redefinition: leave Owner snapshots for the revision-aware claim trigger.
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
    where user_id=v_claim.guest_user_id and state_key not in ('gauntlet_progress_v1','gauntlet_progress_v2','owner_business_career_v1')
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

create or replace function ball_knower_private.owner_state_revision(p_value jsonb)
returns bigint
language plpgsql
immutable
set search_path=pg_catalog,pg_temp
as $$
declare
  v_revision text;
begin
  if p_value is null or jsonb_typeof(p_value)<>'object' then return 0; end if;
  v_revision:=p_value->>'cloudRevision';
  if v_revision is null then return 0; end if;
  if v_revision!~'^[0-9]{1,16}$' then return 0; end if;
  return v_revision::bigint;
exception when others then
  return 0;
end;
$$;
revoke all on function ball_knower_private.owner_state_revision(jsonb) from public,anon,authenticated;

create or replace function ball_knower_private.guard_ball_knower_owner_state_write()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,pg_temp
as $$
begin
  if new.state_key='owner_business_career_v1'
     and coalesce(current_setting('ball_knower.owner_revision_write',true),'')<>'on' then
    raise exception 'Owner state must use the revisioned save RPC';
  end if;
  return new;
end;
$$;
revoke all on function ball_knower_private.guard_ball_knower_owner_state_write() from public,anon,authenticated;

drop trigger if exists guard_ball_knower_owner_state_write on public.ball_knower_user_state;
create trigger guard_ball_knower_owner_state_write
before insert or update on public.ball_knower_user_state
for each row execute function ball_knower_private.guard_ball_knower_owner_state_write();

create or replace function public.save_ball_knower_revisioned_user_state(
  p_state_key text,
  p_value jsonb
)
returns table(state_key text,value jsonb,updated_at timestamptz)
language plpgsql
security definer
set search_path=public,ball_knower_private,pg_temp
as $$
declare
  v_user uuid:=auth.uid();
  v_incoming_revision bigint;
  v_stored_revision bigint;
  v_row public.ball_knower_user_state%rowtype;
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  if p_state_key<>'owner_business_career_v1' then raise exception 'Unsupported revisioned state'; end if;
  if p_value is null or jsonb_typeof(p_value)<>'object' then raise exception 'Object state required'; end if;
  perform set_config('ball_knower.owner_revision_write','on',true);

  insert into public.ball_knower_user_state(user_id,state_key,value,updated_at)
  values(v_user,p_state_key,p_value||jsonb_build_object('cloudRevision',0),now())
  on conflict(user_id,state_key) do nothing;

  select * into v_row
  from public.ball_knower_user_state s
  where s.user_id=v_user and s.state_key=p_state_key
  for update;

  v_incoming_revision:=ball_knower_private.owner_state_revision(p_value);
  v_stored_revision:=ball_knower_private.owner_state_revision(v_row.value);
  if v_incoming_revision=v_stored_revision then
    update public.ball_knower_user_state s
    set value=p_value||jsonb_build_object('cloudRevision',v_stored_revision+1),
        updated_at=now()
    where s.user_id=v_user and s.state_key=p_state_key
    returning s.* into v_row;
  end if;

  return query select v_row.state_key,v_row.value,v_row.updated_at;
end;
$$;
revoke all on function public.save_ball_knower_revisioned_user_state(text,jsonb) from public,anon;
grant execute on function public.save_ball_knower_revisioned_user_state(text,jsonb) to authenticated;

create or replace function public.commit_ball_knower_expected_agent_signing(
  p_expected_user_id uuid,
  p_before_value jsonb,
  p_after_value jsonb
)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_existing jsonb;
begin
  if auth.uid() is null or auth.uid()<>p_expected_user_id then
    raise exception 'Authenticated account changed before Agent signing';
  end if;
  if p_before_value is null or jsonb_typeof(p_before_value)<>'object'
     or p_after_value is null or jsonb_typeof(p_after_value)<>'object' then
    raise exception 'Object Agent states required';
  end if;

  insert into public.ball_knower_user_state(user_id,state_key,value,updated_at)
  values(p_expected_user_id,'player_agent_career',p_before_value,now())
  on conflict(user_id,state_key) do nothing;

  select value into v_existing
  from public.ball_knower_user_state
  where user_id=p_expected_user_id and state_key='player_agent_career'
  for update;

  if v_existing=p_after_value then return; end if;
  if v_existing is distinct from p_before_value then
    raise exception 'Agent career changed before signing; reload the latest career';
  end if;

  update public.ball_knower_user_state
  set value=p_after_value,updated_at=now()
  where user_id=p_expected_user_id and state_key='player_agent_career';
end;
$$;
revoke all on function public.commit_ball_knower_expected_agent_signing(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.commit_ball_knower_expected_agent_signing(uuid,jsonb,jsonb) to authenticated;

create or replace function ball_knower_private.transfer_verified_mode_state_on_guest_claim()
returns trigger
language plpgsql
security definer
set search_path=public,ball_knower_private,pg_temp
as $$
declare
  v_guest_owner_wins boolean:=false;
begin
  if new.claimed_at is null or new.claimed_by is null
     or old.claimed_at is not null or new.guest_user_id=new.claimed_by then
    return new;
  end if;

  insert into ball_knower_private.verified_mode_milestones(
    user_id,mode,milestone_type,source_key,payload,verified_at,verified_by,claimed_at
  )
  select new.claimed_by,mode,milestone_type,source_key,payload,verified_at,verified_by,claimed_at
  from ball_knower_private.verified_mode_milestones where user_id=new.guest_user_id
  on conflict(user_id,mode,source_key) do nothing;
  delete from ball_knower_private.verified_mode_milestones where user_id=new.guest_user_id;

  insert into ball_knower_private.verified_prediction_picks(
    user_id,game_id,pick_id,market,selection,locked_line,label,kickoff_at,away_team,home_team,locked_at,result,graded_at
  )
  select new.claimed_by,game_id,pick_id,market,selection,locked_line,label,kickoff_at,away_team,home_team,locked_at,result,graded_at
  from ball_knower_private.verified_prediction_picks where user_id=new.guest_user_id
  on conflict(user_id,game_id) do nothing;
  delete from ball_knower_private.verified_prediction_picks where user_id=new.guest_user_id;

  select case
    when target.user_id is null then true
    when public_state.value is not null
      and public_state.value->>'abbr'=guest.abbr
      and public_state.value->>'season'=guest.season::text
      and public_state.value->>'stage'=guest.stage
      and public_state.value->>'week'=guest.week::text
      and public_state.value->>'wins'=guest.wins::text
      and public_state.value->>'losses'=guest.losses::text then true
    when public_state.value is not null
      and public_state.value->>'abbr'=target.abbr
      and public_state.value->>'season'=target.season::text
      and public_state.value->>'stage'=target.stage
      and public_state.value->>'week'=target.week::text
      and public_state.value->>'wins'=target.wins::text
      and public_state.value->>'losses'=target.losses::text then false
    else (
      guest.season,
      case guest.stage
        when 'preseason' then 0 when 'regular' then 1 when 'wild-card' then 2
        when 'divisional' then 3 when 'conference' then 4 when 'super-bowl' then 5 else -1 end,
      guest.week,
      guest.wins,
      -guest.losses,
      guest.abbr
    ) > (
      target.season,
      case target.stage
        when 'preseason' then 0 when 'regular' then 1 when 'wild-card' then 2
        when 'divisional' then 3 when 'conference' then 4 when 'super-bowl' then 5 else -1 end,
      target.week,
      target.wins,
      -target.losses,
      target.abbr
    )
  end
  into v_guest_owner_wins
  from ball_knower_private.verified_owner_runs guest
  left join ball_knower_private.verified_owner_runs target on target.user_id=new.claimed_by
  left join public.ball_knower_user_state public_state
    on public_state.user_id=new.claimed_by
   and public_state.state_key='owner_business_career_v1'
  where guest.user_id=new.guest_user_id;

  insert into ball_knower_private.verified_owner_runs(
    user_id,abbr,season,week,stage,wins,losses,playoff_seed,version,updated_at
  )
  select new.claimed_by,abbr,season,week,stage,wins,losses,playoff_seed,version,updated_at
  from ball_knower_private.verified_owner_runs where user_id=new.guest_user_id
  on conflict(user_id) do update set
    abbr=excluded.abbr,
    season=excluded.season,
    week=excluded.week,
    stage=excluded.stage,
    wins=excluded.wins,
    losses=excluded.losses,
    playoff_seed=excluded.playoff_seed,
    version=greatest(ball_knower_private.verified_owner_runs.version,excluded.version)+1,
    updated_at=greatest(ball_knower_private.verified_owner_runs.updated_at,excluded.updated_at)
  where v_guest_owner_wins;
  if v_guest_owner_wins then
    perform set_config('ball_knower.owner_revision_write','on',true);
    insert into public.ball_knower_user_state as target(user_id,state_key,value,updated_at)
    select new.claimed_by,state_key,
      value||jsonb_build_object(
        'cloudRevision',
        ball_knower_private.owner_state_revision(value)+1
      ),
      now()
    from public.ball_knower_user_state
    where user_id=new.guest_user_id
      and state_key='owner_business_career_v1'
      and jsonb_typeof(value)='object'
    on conflict(user_id,state_key) do update set
      value=excluded.value||jsonb_build_object(
        'cloudRevision',
        greatest(
          ball_knower_private.owner_state_revision(target.value),
          ball_knower_private.owner_state_revision(excluded.value)
        )+1
      ),
      updated_at=now();
  end if;
  delete from ball_knower_private.verified_owner_runs where user_id=new.guest_user_id;

  insert into ball_knower_private.verified_agent_clients(
    user_id,player_id,legacy_baseline,signed_at,last_contract_season,last_trade_season,fulfilled_promises
  )
  select new.claimed_by,player_id,legacy_baseline,signed_at,last_contract_season,last_trade_season,fulfilled_promises
  from ball_knower_private.verified_agent_clients where user_id=new.guest_user_id
  on conflict(user_id,player_id) do nothing;
  delete from ball_knower_private.verified_agent_clients where user_id=new.guest_user_id;

  return new;
end;
$$;
revoke all on function ball_knower_private.transfer_verified_mode_state_on_guest_claim() from public,anon,authenticated;
