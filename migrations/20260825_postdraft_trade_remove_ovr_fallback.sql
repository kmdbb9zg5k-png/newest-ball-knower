-- Fantasy trade evaluation must not silently become Madden-overall evaluation
-- when a 2026 projection row is unavailable. Keep a conservative,
-- position-level replacement value only as an internal CPU safety fallback.
-- The UI reports missing projections explicitly instead of presenting this as
-- a player projection.
create or replace function public.ball_knower_standard_fantasy_value(p_player jsonb)
returns numeric
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_projection numeric;
  v_position text:=coalesce(p_player->>'position','');
begin
  select r.projected_points_2026 into v_projection
  from public.ball_knower_fantasy_rankings r
  where r.season=2026
    and r.scoring_format='ppr'
    and lower(regexp_replace(r.player_name,'[^a-z0-9]','','g'))=
        lower(regexp_replace(coalesce(p_player->>'name',''),'[^a-z0-9]','','g'))
  order by case when upper(r.team)=upper(coalesce(p_player->>'team','')) then 0 else 1 end,
           r.overall_rank asc
  limit 1;

  if v_projection is not null then return v_projection; end if;

  -- Internal replacement-level fallback only; never derived from Madden OVR.
  return case v_position
    when 'QB' then 220
    when 'RB' then 120
    when 'WR' then 115
    when 'TE' then 85
    when 'K' then 100
    when 'DST' then 100
    else 0
  end;
end;
$$;

revoke all on function public.ball_knower_standard_fantasy_value(jsonb)
from public,anon,authenticated;
grant execute on function public.ball_knower_standard_fantasy_value(jsonb)
to service_role;
