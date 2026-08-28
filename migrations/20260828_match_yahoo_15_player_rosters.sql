-- Yahoo-style standard fantasy rosters: 9 starters, 6 bench players, and
-- 2 separate IR slots. Existing 20-round drafts remain valid and unchanged.

alter table public.ball_knower_live_drafts
  alter column rounds set default 15;

alter table public.ball_knower_live_drafts
  drop constraint if exists ball_knower_live_drafts_rounds_check;

alter table public.ball_knower_live_drafts
  add constraint ball_knower_live_drafts_rounds_check
  check (rounds in (15,20));

create or replace function public.ball_knower_fantasy_roster_size(p_league_id text)
returns integer
language sql
stable
security invoker
set search_path=''
as $$
  select coalesce(
    (select d.rounds from public.ball_knower_live_drafts d where d.league_id=p_league_id),
    (select nullif(l.settings->>'rosterSize','')::integer from public.ball_knower_leagues l where l.id=p_league_id),
    20
  );
$$;

revoke all on function public.ball_knower_fantasy_roster_size(text) from public,anon;
grant execute on function public.ball_knower_fantasy_roster_size(text) to authenticated,service_role;

-- Patch the current authoritative functions in place so their existing
-- security attributes and grants are retained. Each guard makes the migration
-- fail loudly if a later function version no longer matches the reviewed form.
do $$
declare v_sql text;v_next text;
begin
  select pg_get_functiondef('public.start_ball_knower_live_draft(text)'::regprocedure) into v_sql;
  v_next:=replace(v_sql,
    'values (p_league_id, ''active'', v_order, 20, 0, ''[]''::jsonb)',
    'values (p_league_id, ''active'', v_order, 15, 0, ''[]''::jsonb)');
  if v_next=v_sql then raise exception 'start_ball_knower_live_draft roster-size patch did not match'; end if;
  execute v_next;

  select pg_get_functiondef('public.apply_ball_knower_player_move(text,text,jsonb,text,numeric,text,uuid)'::regprocedure) into v_sql;
  v_next:=replace(v_sql,
    'v_limit:=coalesce(nullif(v_settings->>''rosterSize'','''')::integer,20);',
    'v_limit:=public.ball_knower_fantasy_roster_size(p_league_id);');
  if v_next=v_sql then raise exception 'apply_ball_knower_player_move roster-size patch did not match'; end if;
  execute v_next;

  select pg_get_functiondef('public.propose_ball_knower_trade_v2(text,text,text[],text[],text[],text)'::regprocedure) into v_sql;
  v_next:=replace(v_sql,
    'v_current_count-array_length(p_offered_player_ids,1)+array_length(p_requested_player_ids,1)-20',
    'v_current_count-array_length(p_offered_player_ids,1)+array_length(p_requested_player_ids,1)-public.ball_knower_fantasy_roster_size(p_league_id)');
  v_next:=replace(v_next,
    'raise exception ''Choose % roster cut(s) to keep your team at 20 players'',v_required_drops;',
    'raise exception ''Choose % roster cut(s) to keep your team at % players'',v_required_drops,public.ball_knower_fantasy_roster_size(p_league_id);');
  if v_next=v_sql then raise exception 'propose_ball_knower_trade_v2 roster-size patch did not match'; end if;
  execute v_next;

  select pg_get_functiondef('public.counter_ball_knower_trade_v2(uuid,text[],text[],text[],text)'::regprocedure) into v_sql;
  v_next:=replace(v_sql,
    'v_current_count-array_length(p_offered_player_ids,1)+array_length(p_requested_player_ids,1)-20',
    'v_current_count-array_length(p_offered_player_ids,1)+array_length(p_requested_player_ids,1)-public.ball_knower_fantasy_roster_size(v_trade.league_id)');
  v_next:=replace(v_next,
    'raise exception ''Choose % roster cut(s) to keep your team at 20 players'',v_required_drops;',
    'raise exception ''Choose % roster cut(s) to keep your team at % players'',v_required_drops,public.ball_knower_fantasy_roster_size(v_trade.league_id);');
  if v_next=v_sql then raise exception 'counter_ball_knower_trade_v2 roster-size patch did not match'; end if;
  execute v_next;

  select pg_get_functiondef('public.resolve_ball_knower_trade_v2_impl(uuid,text,text[])'::regprocedure) into v_sql;
  v_next:=replace(v_sql,
    'jsonb_array_length(coalesce(r.roster,''[]''::jsonb))-array_length(t.requested_player_ids,1)+array_length(t.offered_player_ids,1)-20',
    'jsonb_array_length(coalesce(r.roster,''[]''::jsonb))-array_length(t.requested_player_ids,1)+array_length(t.offered_player_ids,1)-public.ball_knower_fantasy_roster_size(t.league_id)');
  v_next:=replace(v_next,'jsonb_array_length(r_new)=20','jsonb_array_length(r_new)=public.ball_knower_fantasy_roster_size(t.league_id)');
  v_next:=replace(v_next,'jsonb_array_length(p_new)>20','jsonb_array_length(p_new)>public.ball_knower_fantasy_roster_size(t.league_id)');
  v_next:=replace(v_next,'jsonb_array_length(r_new)>20','jsonb_array_length(r_new)>public.ball_knower_fantasy_roster_size(t.league_id)');
  if v_next=v_sql then raise exception 'resolve_ball_knower_trade_v2_impl roster-size patch did not match'; end if;
  execute v_next;

  select pg_get_functiondef('public.resolve_ball_knower_trade(uuid,text)'::regprocedure) into v_sql;
  v_next:=replace(v_sql,
    'jsonb_array_length(p_new)<>20 or jsonb_array_length(r_new)<>20',
    'jsonb_array_length(p_new)<>public.ball_knower_fantasy_roster_size(t.league_id) or jsonb_array_length(r_new)<>public.ball_knower_fantasy_roster_size(t.league_id)');
  if v_next=v_sql then raise exception 'resolve_ball_knower_trade roster-size patch did not match'; end if;
  execute v_next;

  select pg_get_functiondef('public.enforce_ball_knower_member_update()'::regprocedure) into v_sql;
  v_next:=replace(v_sql,
    'if v_roster_count>20 then raise exception ''Roster cannot exceed 20 players''; end if;',
    'if v_roster_count>public.ball_knower_fantasy_roster_size(new.league_id) then raise exception ''Roster cannot exceed % players'',public.ball_knower_fantasy_roster_size(new.league_id); end if;');
  v_next:=replace(v_next,
    'elsif v_roster_count<>20 then raise exception ''A ready roster must contain exactly 20 players''; end if;',
    'elsif v_roster_count<>public.ball_knower_fantasy_roster_size(new.league_id) then raise exception ''A ready roster must contain exactly % players'',public.ball_knower_fantasy_roster_size(new.league_id); end if;');
  if v_next=v_sql then raise exception 'enforce_ball_knower_member_update roster-size patch did not match'; end if;
  execute v_next;

  select pg_get_functiondef('public.commissioner_set_member_roster_status(text,text,text)'::regprocedure) into v_sql;
  v_next:=replace(v_sql,
    'jsonb_array_length(v_member.roster)<>20',
    'jsonb_array_length(v_member.roster)<>public.ball_knower_fantasy_roster_size(p_league_id)');
  v_next:=replace(v_next,
    'raise exception ''Roster must contain exactly 20 players'';',
    'raise exception ''Roster must contain exactly % players'',public.ball_knower_fantasy_roster_size(p_league_id);');
  if v_next=v_sql then raise exception 'commissioner_set_member_roster_status roster-size patch did not match'; end if;
  execute v_next;
end;
$$;

comment on function public.ball_knower_fantasy_roster_size(text) is
  'Returns the authoritative drafted roster size. Existing drafts keep 20; new Yahoo-style drafts use 15.';
