-- Private league rows contain invite credentials, commissioner identifiers,
-- settings, and season history. Direct table reads are therefore limited to
-- the commissioner or a league member. Exact invite-code joins and public
-- matchmaking remain available through their authenticated SECURITY DEFINER
-- RPCs, while spectator links continue through the sanitized public RPC.

create or replace function public.fantasy_requester_id()
returns uuid
language sql
stable
set search_path = ''
as $function$
  with headers as (
    select coalesce(current_setting('request.headers', true), '{}')::jsonb as h
  ), client as (
    select coalesce(h ->> 'x-client-info', '') as v from headers
  ), parsed as (
    select (regexp_match(
      v,
      '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})'
    ))[1] as device_id
    from client
  )
  select coalesce(auth.uid(), nullif(device_id, '')::uuid) from parsed;
$function$;

create or replace function public.is_ball_knower_commissioner(p_league_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
      from public.ball_knower_leagues l
     where l.id = p_league_id
       and l.commissioner_auth_id = public.fantasy_requester_id()
  );
$function$;

create or replace function public.can_access_ball_knower_league(p_league_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select public.is_ball_knower_commissioner(p_league_id)
      or exists (
        select 1
          from public.ball_knower_league_members m
         where m.league_id = p_league_id
           and m.auth_user_id = public.fantasy_requester_id()
      );
$function$;

revoke all on function public.can_access_ball_knower_league(text)
  from public, anon;
revoke all on function public.is_ball_knower_commissioner(text)
  from public, anon;
grant execute on function public.can_access_ball_knower_league(text)
  to authenticated, service_role;
grant execute on function public.is_ball_knower_commissioner(text)
  to authenticated, service_role;

drop policy if exists ball_knower_leagues_select
  on public.ball_knower_leagues;
drop policy if exists "bk leagues readable"
  on public.ball_knower_leagues;

create policy ball_knower_leagues_select
on public.ball_knower_leagues
for select
to authenticated
using (public.can_access_ball_knower_league(id));

revoke select on table public.ball_knower_leagues from public, anon;
grant select on table public.ball_knower_leagues to authenticated, service_role;

comment on policy ball_knower_leagues_select on public.ball_knower_leagues is
  'Only commissioners and league members can read the full league row. Joining, public matchmaking, and spectators use scoped RPC contracts.';
