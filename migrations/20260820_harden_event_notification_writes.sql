-- Harden league activity and notification writes at the database boundary.
-- Keeps the existing browser API compatible while deriving/validating identity server-side.

create or replace function public.ball_knower_enforce_event_actor()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_requester uuid := public.fantasy_requester_id();
  v_actor_name text;
begin
  if v_requester is null then
    raise exception 'Authentication required';
  end if;

  if not public.can_access_ball_knower_league(new.league_id) then
    raise exception 'League access required';
  end if;

  select m.user_name
    into v_actor_name
  from public.ball_knower_league_members m
  where m.league_id = new.league_id
    and m.auth_user_id = v_requester
  limit 1;

  if v_actor_name is null then
    select l.commissioner_name
      into v_actor_name
    from public.ball_knower_leagues l
    where l.id = new.league_id
      and l.commissioner_auth_id = v_requester
    limit 1;
  end if;

  new.actor_auth_id := v_requester;
  new.actor_name := coalesce(nullif(trim(v_actor_name), ''), 'Ball Knower');
  return new;
end;
$$;

revoke all on function public.ball_knower_enforce_event_actor() from public;

drop trigger if exists ball_knower_enforce_event_actor on public.ball_knower_league_events;
create trigger ball_knower_enforce_event_actor
before insert on public.ball_knower_league_events
for each row execute function public.ball_knower_enforce_event_actor();

create or replace function public.ball_knower_enforce_notification_target()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_requester uuid := public.fantasy_requester_id();
begin
  if v_requester is null then
    raise exception 'Authentication required';
  end if;

  if new.league_id is null then
    if new.auth_user_id <> v_requester then
      raise exception 'Cannot create a notification for another user';
    end if;
    return new;
  end if;

  if new.auth_user_id = v_requester then
    if not public.can_access_ball_knower_league(new.league_id) then
      raise exception 'League access required';
    end if;
    return new;
  end if;

  if not public.is_ball_knower_commissioner(new.league_id) then
    raise exception 'Commissioner access required for league notification fanout';
  end if;

  if not exists (
    select 1
    from public.ball_knower_league_members m
    where m.league_id = new.league_id
      and m.auth_user_id = new.auth_user_id
      and coalesce(m.is_ai, false) = false
  ) then
    raise exception 'Notification recipient is not a human member of this league';
  end if;

  return new;
end;
$$;

revoke all on function public.ball_knower_enforce_notification_target() from public;

drop trigger if exists ball_knower_enforce_notification_target on public.ball_knower_notifications;
create trigger ball_knower_enforce_notification_target
before insert on public.ball_knower_notifications
for each row execute function public.ball_knower_enforce_notification_target();

-- Tighten the event insert policy now that the trigger always supplies the
-- authenticated actor identity before RLS WITH CHECK is evaluated.
drop policy if exists bk_events_insert on public.ball_knower_league_events;
create policy bk_events_insert
on public.ball_knower_league_events
for insert
to authenticated
with check (
  public.can_access_ball_knower_league(league_id)
  and actor_auth_id = public.fantasy_requester_id()
);

-- Preferred write API: event identity is derived from the authenticated league member.
create or replace function public.log_ball_knower_league_event(
  p_league_id text,
  p_event_type text,
  p_message text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester uuid := public.fantasy_requester_id();
  v_actor_name text;
  v_id uuid;
begin
  if v_requester is null then
    raise exception 'Authentication required';
  end if;
  if not public.can_access_ball_knower_league(p_league_id) then
    raise exception 'League access required';
  end if;
  if nullif(trim(p_event_type), '') is null or length(p_event_type) > 64 then
    raise exception 'Invalid event type';
  end if;
  if nullif(trim(p_message), '') is null or length(p_message) > 1000 then
    raise exception 'Invalid event message';
  end if;

  select m.user_name into v_actor_name
  from public.ball_knower_league_members m
  where m.league_id = p_league_id and m.auth_user_id = v_requester
  limit 1;

  if v_actor_name is null then
    select l.commissioner_name into v_actor_name
    from public.ball_knower_leagues l
    where l.id = p_league_id and l.commissioner_auth_id = v_requester
    limit 1;
  end if;

  insert into public.ball_knower_league_events(
    league_id, actor_auth_id, actor_name, event_type, message, metadata
  ) values (
    p_league_id, v_requester,
    coalesce(nullif(trim(v_actor_name), ''), 'Ball Knower'),
    trim(p_event_type), trim(p_message), coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.log_ball_knower_league_event(text,text,text,jsonb) from public, anon;
grant execute on function public.log_ball_knower_league_event(text,text,text,jsonb) to authenticated;

-- Preferred notification API: recipients are selected from current human league members server-side.
create or replace function public.notify_ball_knower_league_members(
  p_league_id text,
  p_title text,
  p_body text,
  p_kind text default 'league'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if public.fantasy_requester_id() is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_ball_knower_commissioner(p_league_id) then
    raise exception 'Commissioner access required';
  end if;
  if nullif(trim(p_title), '') is null or length(p_title) > 160 then
    raise exception 'Invalid notification title';
  end if;
  if nullif(trim(p_body), '') is null or length(p_body) > 1000 then
    raise exception 'Invalid notification body';
  end if;
  if nullif(trim(p_kind), '') is null or length(p_kind) > 64 then
    raise exception 'Invalid notification kind';
  end if;

  insert into public.ball_knower_notifications(league_id, auth_user_id, title, body, kind)
  select p_league_id, m.auth_user_id, trim(p_title), trim(p_body), trim(p_kind)
  from public.ball_knower_league_members m
  where m.league_id = p_league_id
    and m.auth_user_id is not null
    and coalesce(m.is_ai, false) = false;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.notify_ball_knower_league_members(text,text,text,text) from public, anon;
grant execute on function public.notify_ball_knower_league_members(text,text,text,text) to authenticated;
