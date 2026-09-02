-- Owner-scoped fantasy notification controls. Every event keeps an auditable
-- owner-only row while independent delivery flags allow in-app and future
-- native push channels to be configured without coupling them together.

create table if not exists public.ball_knower_notification_preferences (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('draft','roster','transactions','league')),
  in_app_enabled boolean not null default true,
  push_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (auth_user_id, category)
);

alter table public.ball_knower_notification_preferences enable row level security;
revoke all on table public.ball_knower_notification_preferences from public, anon, authenticated;
grant select on table public.ball_knower_notification_preferences to authenticated;

drop policy if exists bk_notification_preferences_owner_read
  on public.ball_knower_notification_preferences;
create policy bk_notification_preferences_owner_read
on public.ball_knower_notification_preferences
for select
to authenticated
using (auth_user_id = (select auth.uid()));

create or replace function ball_knower_private.fantasy_notification_category(p_kind text)
returns text
language sql
immutable
set search_path = ''
as $function$
  select case
    when coalesce(p_kind, '') like 'draft_%' then 'draft'
    when coalesce(p_kind, '') like 'trade_%'
      or coalesce(p_kind, '') like 'waiver_%'
      or coalesce(p_kind, '') in ('trading_block','fantasy_dm') then 'transactions'
    when coalesce(p_kind, '') in (
      'player_status','matchup_starting','lineup_incomplete','starter_ruled_out',
      'roster_lock','watched_player_available'
    ) then 'roster'
    else 'league'
  end
$function$;

revoke all on function ball_knower_private.fantasy_notification_category(text)
  from public, anon, authenticated;

alter table public.ball_knower_notifications
  add column if not exists category text not null default 'league'
  check (category in ('draft','roster','transactions','league'));
alter table public.ball_knower_notifications
  add column if not exists in_app_visible boolean not null default true;
alter table public.ball_knower_notifications
  add column if not exists push_eligible boolean not null default true;

update public.ball_knower_notifications notification
set category = ball_knower_private.fantasy_notification_category(notification.kind)
where notification.category is distinct from ball_knower_private.fantasy_notification_category(notification.kind);

create index if not exists ball_knower_notifications_owner_delivery_created_idx
  on public.ball_knower_notifications(auth_user_id, in_app_visible, category, created_at desc);

create or replace function ball_knower_private.fantasy_notification_preference_enabled(
  p_user uuid,
  p_kind text,
  p_channel text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select case p_channel
    when 'in_app' then coalesce((
      select preference.in_app_enabled
      from public.ball_knower_notification_preferences preference
      where preference.auth_user_id = p_user
        and preference.category = ball_knower_private.fantasy_notification_category(p_kind)
    ), true)
    when 'push' then coalesce((
      select preference.push_enabled
      from public.ball_knower_notification_preferences preference
      where preference.auth_user_id = p_user
        and preference.category = ball_knower_private.fantasy_notification_category(p_kind)
    ), true)
    else false
  end
$function$;

revoke all on function ball_knower_private.fantasy_notification_preference_enabled(uuid,text,text)
  from public, anon, authenticated;

create or replace function public.ball_knower_apply_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  new.category := ball_knower_private.fantasy_notification_category(new.kind);
  new.in_app_visible := ball_knower_private.fantasy_notification_preference_enabled(
    new.auth_user_id,
    new.kind,
    'in_app'
  );
  new.push_eligible := ball_knower_private.fantasy_notification_preference_enabled(
    new.auth_user_id,
    new.kind,
    'push'
  );
  return new;
end
$function$;

revoke all on function public.ball_knower_apply_notification_preferences()
  from public, anon, authenticated;

drop trigger if exists ball_knower_notification_preferences
  on public.ball_knower_notifications;
create trigger ball_knower_notification_preferences
before insert on public.ball_knower_notifications
for each row execute function public.ball_knower_apply_notification_preferences();

create or replace function public.get_my_ball_knower_notification_preferences()
returns table(category text, in_app_enabled boolean, push_enabled boolean)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_auth uuid := (select auth.uid());
begin
  if v_auth is null then raise exception 'Authentication required'; end if;
  return query
  select defaults.category,
         coalesce(preference.in_app_enabled, true),
         coalesce(preference.push_enabled, true)
  from (values ('draft'),('roster'),('transactions'),('league')) defaults(category)
  left join public.ball_knower_notification_preferences preference
    on preference.auth_user_id = v_auth
   and preference.category = defaults.category
  order by case defaults.category
    when 'draft' then 1
    when 'roster' then 2
    when 'transactions' then 3
    else 4
  end;
end
$function$;

create or replace function public.save_my_ball_knower_notification_preference(
  p_category text,
  p_in_app_enabled boolean,
  p_push_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_auth uuid := (select auth.uid());
begin
  if v_auth is null then raise exception 'Authentication required'; end if;
  if p_category is null or p_category not in ('draft','roster','transactions','league') then
    raise exception 'Invalid notification category';
  end if;
  if p_in_app_enabled is null or p_push_enabled is null then
    raise exception 'Notification preferences must be explicit';
  end if;

  insert into public.ball_knower_notification_preferences(
    auth_user_id, category, in_app_enabled, push_enabled, updated_at
  ) values (
    v_auth, p_category, p_in_app_enabled, p_push_enabled, now()
  )
  on conflict (auth_user_id, category) do update
  set in_app_enabled = excluded.in_app_enabled,
      push_enabled = excluded.push_enabled,
      updated_at = excluded.updated_at;
end
$function$;

create or replace function public.mark_all_ball_knower_notifications_read(
  p_league_id text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_auth uuid := (select auth.uid());
  v_count integer;
begin
  if v_auth is null then raise exception 'Authentication required'; end if;
  if p_league_id is not null and not public.can_access_ball_knower_league(p_league_id) then
    raise exception 'League access required';
  end if;

  update public.ball_knower_notifications notification
  set read_at = now()
  where notification.auth_user_id = v_auth
    and notification.read_at is null
    and notification.in_app_visible
    and (p_league_id is null or notification.league_id = p_league_id);
  get diagnostics v_count = row_count;
  return v_count;
end
$function$;

revoke all on function public.get_my_ball_knower_notification_preferences()
  from public, anon;
revoke all on function public.save_my_ball_knower_notification_preference(text,boolean,boolean)
  from public, anon;
revoke all on function public.mark_all_ball_knower_notifications_read(text)
  from public, anon;
grant execute on function public.get_my_ball_knower_notification_preferences()
  to authenticated;
grant execute on function public.save_my_ball_knower_notification_preference(text,boolean,boolean)
  to authenticated;
grant execute on function public.mark_all_ball_knower_notifications_read(text)
  to authenticated;

comment on table public.ball_knower_notification_preferences is
  'Owner-scoped fantasy category preferences. Push flags are consumed only after a device registers and grants notification permission.';
comment on column public.ball_knower_notifications.in_app_visible is
  'Immutable per-event delivery decision derived from the owner preference at insert time.';
comment on column public.ball_knower_notifications.push_eligible is
  'Per-event push decision for a future registered-device delivery worker; it is not proof of delivery.';
comment on function public.mark_all_ball_knower_notifications_read(text) is
  'Marks only the authenticated owner notification rows as read, optionally scoped to one current league.';
