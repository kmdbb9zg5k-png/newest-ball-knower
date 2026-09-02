\set ON_ERROR_STOP on

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end;
$roles$;

create schema ball_knower_private;

create table public.ball_knower_league_members (
  id text primary key,
  league_id text not null,
  auth_user_id uuid,
  is_ai boolean not null default false
);

create table public.ball_knower_notifications (
  league_id text,
  auth_user_id uuid,
  title text,
  body text,
  kind text
);

create or replace function ball_knower_private.notify_fantasy_user(
  p_league_id text,
  p_auth_user_id uuid,
  p_title text,
  p_body text,
  p_kind text
)
returns void
language sql
set search_path = ''
as $function$
  insert into public.ball_knower_notifications(
    league_id, auth_user_id, title, body, kind
  ) values (
    p_league_id, p_auth_user_id, p_title, p_body, p_kind
  );
$function$;

-- Deliberately omit is_final. This is the production relation that exposed
-- the shared-trigger row-shape bug.
create table public.ball_knower_live_drafts (
  league_id text primary key,
  status text not null,
  order_member_ids jsonb not null,
  pick_index integer not null,
  picks jsonb not null default '[]'::jsonb
);

create table public.ball_knower_weekly_scores (
  league_id text not null,
  member_id text not null,
  week_number integer not null,
  live_points numeric not null,
  is_final boolean not null default false,
  primary key (league_id, member_id, week_number)
);

\ir ../migrations/20260902151805_fix_fantasy_notification_trigger_schema_safety.sql

create trigger fantasy_live_draft_notification
after insert or update on public.ball_knower_live_drafts
for each row execute function ball_knower_private.fantasy_notification_fanout();

create trigger fantasy_matchup_final_notification
after insert or update of is_final on public.ball_knower_weekly_scores
for each row execute function ball_knower_private.fantasy_notification_fanout();

insert into public.ball_knower_league_members(
  id, league_id, auth_user_id, is_ai
) values
  ('member-a', 'integration-league', '11111111-1111-1111-1111-111111111111', false),
  ('member-b', 'integration-league', '22222222-2222-2222-2222-222222222222', false);

insert into public.ball_knower_live_drafts(
  league_id, status, order_member_ids, pick_index, picks
) values (
  'integration-league',
  'active',
  '["member-a", "member-b"]'::jsonb,
  0,
  '[]'::jsonb
);

update public.ball_knower_live_drafts
set pick_index = 1,
    picks = '[{"memberId":"member-a","playerId":"player-a","source":"autopick"}]'::jsonb
where league_id = 'integration-league';

insert into public.ball_knower_weekly_scores(
  league_id, member_id, week_number, live_points, is_final
) values (
  'integration-league', 'member-a', 1, 17.5, false
);

update public.ball_knower_weekly_scores
set is_final = true
where league_id = 'integration-league'
  and member_id = 'member-a'
  and week_number = 1;

-- Replaying a final update must not duplicate the final notification.
update public.ball_knower_weekly_scores
set is_final = true
where league_id = 'integration-league'
  and member_id = 'member-a'
  and week_number = 1;

do $assertions$
begin
  if (select count(*) from public.ball_knower_notifications where kind='draft_on_clock') <> 2 then
    raise exception 'Expected two on-clock notifications';
  end if;
  if (select count(*) from public.ball_knower_notifications where kind='draft_autopick') <> 1 then
    raise exception 'Expected one autopick notification';
  end if;
  if (select count(*) from public.ball_knower_notifications where kind='matchup_final') <> 1 then
    raise exception 'Expected exactly one weekly-score final notification';
  end if;
end;
$assertions$;

rollback;

select 'heterogeneous notification trigger integration passed' as result;
