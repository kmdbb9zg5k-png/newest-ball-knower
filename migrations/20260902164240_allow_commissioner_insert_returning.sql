-- INSERT ... RETURNING is evaluated against the SELECT policy in the same
-- Production migration: 20260902164240.
-- command snapshot. The security-definer membership lookup cannot see a row
-- that was inserted earlier in that command, so allow the new row's own
-- commissioner identifier to prove access directly. This does not expose any
-- other league: non-commissioners still need an existing membership.

drop policy if exists ball_knower_leagues_select
  on public.ball_knower_leagues;

create policy ball_knower_leagues_select
on public.ball_knower_leagues
for select
to authenticated
using (
  commissioner_auth_id = public.fantasy_requester_id()
  or public.can_access_ball_knower_league(id)
);

comment on policy ball_knower_leagues_select on public.ball_knower_leagues is
  'Full rows are visible only to their commissioner or members. The direct commissioner branch also permits secure INSERT ... RETURNING for newly created leagues.';
