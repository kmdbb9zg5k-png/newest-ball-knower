-- Draft Order Game builds are a 20-player salary-cap contest that determines
-- the later 15-round fantasy draft order. Keep those two roster contracts separate.

create or replace function public.ball_knower_fantasy_roster_size(p_league_id text)
returns integer
language sql
stable
security invoker
set search_path=''
as $$
  select coalesce(
    (select d.rounds
       from public.ball_knower_live_drafts d
      where d.league_id=p_league_id),
    (select case
       when lower(coalesce(l.settings->>'draftOrderMethod',l.settings->>'draft_order_method',''))='game'
        and l.status='drafting'
        and l.season_result is null
       then 20
       else nullif(l.settings->>'rosterSize','')::integer
     end
       from public.ball_knower_leagues l
      where l.id=p_league_id),
    20
  );
$$;

revoke all on function public.ball_knower_fantasy_roster_size(text) from public,anon;
grant execute on function public.ball_knower_fantasy_roster_size(text) to authenticated,service_role;

comment on function public.ball_knower_fantasy_roster_size(text) is
  'Returns 20 during the Draft Order Game, then the authoritative live-draft or standard fantasy roster size.';
