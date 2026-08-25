-- The fantasy-value helper is an internal dependency of security-definer trade
-- RPCs. Do not expose it as a directly callable app-role endpoint.
revoke all on function public.ball_knower_standard_fantasy_value(jsonb)
from public,anon,authenticated;
grant execute on function public.ball_knower_standard_fantasy_value(jsonb)
to service_role;
