-- Authenticated, immutable receipts for Solo mode milestones. Rewards are
-- server-owned and event keys make retries/multi-device restores idempotent.
create or replace function public.record_ball_knower_mode_progress(
  p_event_key text,
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path='public','ball_knower_private','pg_temp'
as $function$
declare
  v_user uuid:=(select auth.uid());
  v_category text;
  v_xp integer;
  v_rating integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(coalesce(p_event_key,'')),'') is null or length(p_event_key)>180 then raise exception 'Invalid event key'; end if;
  if p_event_type='owner_season_complete' then v_category:='owner';v_xp:=35;v_rating:=1;
  elsif p_event_type='owner_playoff_appearance' then v_category:='owner';v_xp:=50;v_rating:=1;
  elsif p_event_type='owner_conference_title' then v_category:='owner';v_xp:=90;v_rating:=2;
  elsif p_event_type='owner_championship' then v_category:='owner';v_xp:=180;v_rating:=3;
  elsif p_event_type='agent_client_signed' then v_category:='agent';v_xp:=25;v_rating:=1;
  elsif p_event_type='agent_trade_resolved' then v_category:='agent';v_xp:=45;v_rating:=1;
  elsif p_event_type='agent_contract_signed' then v_category:='agent';v_xp:=60;v_rating:=1;
  elsif p_event_type='agent_promise_fulfilled' then v_category:='agent';v_xp:=35;v_rating:=1;
  elsif p_event_type='prediction_correct' then v_category:='prediction';v_xp:=20;v_rating:=1;
  elsif p_event_type='prediction_wrong' then v_category:='prediction';v_xp:=2;v_rating:=-1;
  elsif p_event_type='prediction_push' then v_category:='prediction';v_xp:=5;v_rating:=0;
  else raise exception 'Unsupported progression event';
  end if;
  return ball_knower_private.apply_progress_event(
    v_user,'mode:'||p_event_key,p_event_type,v_category,v_xp,v_rating,
    coalesce(p_metadata,'{}'::jsonb)
  );
end;
$function$;

revoke all on function public.record_ball_knower_mode_progress(text,text,jsonb) from public,anon;
grant execute on function public.record_ball_knower_mode_progress(text,text,jsonb) to authenticated;
