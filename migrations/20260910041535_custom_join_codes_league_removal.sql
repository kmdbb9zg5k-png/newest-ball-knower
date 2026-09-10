-- Let commissioners choose memorable, case-insensitive join codes and let
-- authenticated users remove leagues from their own dashboard safely.

create unique index if not exists bk_leagues_code_case_insensitive_idx
  on public.ball_knower_leagues (upper(code));

alter table public.ball_knower_leagues
  drop constraint if exists ball_knower_leagues_code_format;

alter table public.ball_knower_leagues
  add constraint ball_knower_leagues_code_format
  check (
    code = upper(code)
    and char_length(code) between 4 and 20
    and code ~ '^[A-Z0-9][A-Z0-9-]{3,19}$'
  ) not valid;

alter table public.ball_knower_leagues
  validate constraint ball_knower_leagues_code_format;

drop policy if exists ball_knower_leagues_delete on public.ball_knower_leagues;
create policy ball_knower_leagues_delete
on public.ball_knower_leagues
for delete
to authenticated
using (commissioner_auth_id = (select auth.uid()));

drop policy if exists ball_knower_members_leave_self on public.ball_knower_league_members;
create policy ball_knower_members_leave_self
on public.ball_knower_league_members
for delete
to authenticated
using (
  auth_user_id = (select auth.uid())
  and not public.is_ball_knower_commissioner(league_id)
);

grant delete on table public.ball_knower_leagues to authenticated;

comment on policy ball_knower_leagues_delete on public.ball_knower_leagues is
  'Only the authenticated commissioner may permanently delete their league.';

comment on policy ball_knower_members_leave_self on public.ball_knower_league_members is
  'A non-commissioner may remove only their own authenticated membership.';
