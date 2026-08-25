-- Keep direct RPC callers from supplying the same recipient roster cut more
-- than once. Wrap the hardened resolver so the final public contract rejects
-- duplicate ids before any roster mutation is attempted.

alter function public.resolve_ball_knower_trade_v2(uuid,text,text[])
rename to resolve_ball_knower_trade_v2_impl;

revoke all on function public.resolve_ball_knower_trade_v2_impl(uuid,text,text[])
from public,anon,authenticated;
grant execute on function public.resolve_ball_knower_trade_v2_impl(uuid,text,text[])
to service_role;

create or replace function public.resolve_ball_knower_trade_v2(
  p_trade_id uuid,
  p_action text,
  p_recipient_drop_player_ids text[] default '{}'::text[]
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  if coalesce(array_length(p_recipient_drop_player_ids,1),0) <>
     (select count(distinct drop_id) from unnest(p_recipient_drop_player_ids) drop_id) then
    raise exception 'A player can only be selected once as a roster cut';
  end if;

  return public.resolve_ball_knower_trade_v2_impl(
    p_trade_id,
    p_action,
    p_recipient_drop_player_ids
  );
end;
$$;

revoke all on function public.resolve_ball_knower_trade_v2(uuid,text,text[])
from public,anon;
grant execute on function public.resolve_ball_knower_trade_v2(uuid,text,text[])
to authenticated,service_role;
