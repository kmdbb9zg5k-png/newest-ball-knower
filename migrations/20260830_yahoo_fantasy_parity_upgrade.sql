-- Yahoo-parity pass without changing Ball Knower's draft-order game or CPU logic.
-- Human live-draft selections are roster-size limited only; CPU/autopick remains
-- starter-aware and position-balanced.

alter table public.ball_knower_live_drafts
  drop constraint if exists ball_knower_live_drafts_rounds_check;
alter table public.ball_knower_live_drafts
  add constraint ball_knower_live_drafts_rounds_check check(rounds between 15 and 20) not valid;
alter table public.ball_knower_live_drafts
  validate constraint ball_knower_live_drafts_rounds_check;

create or replace function ball_knower_private.validate_fantasy_league_settings()
returns trigger language plpgsql security definer set search_path='' as $function$
declare s jsonb:=coalesce(new.settings,'{}'::jsonb);v integer;score record;
begin
  if coalesce(s->>'scoringFormat','ppr') not in ('ppr','half_ppr','standard') then raise exception 'Invalid scoring format'; end if;
  if coalesce(s->>'draftFormat','live_snake') not in ('live_snake','autopick','offline','mock','auction') then raise exception 'Invalid draft format'; end if;
  if coalesce(s->>'tradeReview','commissioner') not in ('none','commissioner','league_vote') then raise exception 'Invalid trade review'; end if;
  if coalesce(s->>'waiverType','priority') not in ('priority','faab') then raise exception 'Invalid waiver type'; end if;
  if coalesce(s->>'freeAgentMode','instant') not in ('instant','continuous') then raise exception 'Invalid free-agent mode'; end if;
  if coalesce(s->>'playoffSeeding','record_points') not in ('record_points','record_head_to_head','division_winners') then raise exception 'Invalid playoff seeding'; end if;
  v:=coalesce(nullif(s->>'regularSeasonWeeks','')::integer,17);if v not between 13 and 17 then raise exception 'Regular season must be 13-17 weeks';end if;
  v:=coalesce(nullif(s->>'playoffTeams','')::integer,6);if v not in (4,6,8) or v>new.max_members then raise exception 'Playoff field must be 4, 6 or 8 and fit the league';end if;
  v:=coalesce(nullif(s->>'benchSlots','')::integer,6);if v not between 6 and 11 then raise exception 'Bench slots must be 6-11';end if;
  if coalesce(nullif(s->>'rosterSize','')::integer,9+v)<>9+v then raise exception 'Roster size must equal nine starters plus bench slots';end if;
  v:=coalesce(nullif(s->>'irSlots','')::integer,2);if v not between 0 and 5 then raise exception 'IR slots must be 0-5';end if;
  v:=coalesce(nullif(s->>'waiverProcessHourUtc','')::integer,9);if v not between 0 and 23 then raise exception 'Waiver hour must be 0-23 UTC';end if;
  v:=coalesce(nullif(s->>'tradeDeadlineWeek','')::integer,11);if v not between 1 and 17 then raise exception 'Trade deadline must be Week 1-17';end if;
  v:=coalesce(nullif(s->>'maxAcquisitionsPerWeek','')::integer,0);if v not between 0 and 99 then raise exception 'Weekly acquisition limit must be 1-99 or disabled';end if;
  v:=coalesce(nullif(s->>'maxAcquisitionsPerSeason','')::integer,0);if v not between 0 and 999 then raise exception 'Season acquisition limit must be 1-999 or disabled';end if;
  if coalesce((s->>'divisionsEnabled')::boolean,false) and coalesce(nullif(s->>'divisionCount','')::integer,2) not in(2,4) then raise exception 'Divisions must use two or four groups';end if;
  if jsonb_typeof(coalesce(s->'customScoring','{}'::jsonb))<>'object' then raise exception 'Custom scoring must be an object';end if;
  for score in select key,value from jsonb_each_text(coalesce(s->'customScoring','{}'::jsonb)) loop
    if score.key not in('passYards','passTd','interception','rushYards','rushTd','reception','recYards','recTd','fumbleLost','fieldGoal','extraPoint','dstSack','dstTurnover','dstTd') then raise exception 'Unknown custom scoring category %',score.key;end if;
    if score.value!~'^[-]?[0-9]+([.][0-9]+)?$' or score.value::numeric not between -100 and 100 then raise exception 'Invalid custom scoring value for %',score.key;end if;
  end loop;
  if tg_op='UPDATE' then
    if coalesce(old.settings->>'regularSeasonWeeks','17')<>coalesce(s->>'regularSeasonWeeks','17')
      and exists(select 1 from jsonb_array_elements(coalesce(old.season_result->'games','[]'::jsonb)) game where not(game?'playoffRound'))
    then raise exception 'Regular-season length is locked after the schedule is created';end if;
    if (old.settings->'scoringFormat' is distinct from s->'scoringFormat' or old.settings->'customScoring' is distinct from s->'customScoring')
      and exists(select 1 from public.ball_knower_weekly_scores where league_id=new.id and (is_final or live_points<>0))
    then raise exception 'Scoring settings are locked after scoring begins';end if;
    if old.settings->'playoffTeams' is distinct from s->'playoffTeams'
      and (exists(select 1 from public.ball_knower_weekly_scores where league_id=new.id and week_number>coalesce(nullif(old.settings->>'regularSeasonWeeks','')::integer,17) and (is_final or live_points<>0))
        or exists(select 1 from jsonb_array_elements(coalesce(old.season_result->'games','[]'::jsonb)) game where game?'playoffRound' and (coalesce(game->>'winnerId','')<>'' or coalesce(nullif(game->>'homeScore','')::numeric,0)<>0 or coalesce(nullif(game->>'awayScore','')::numeric,0)<>0)))
    then raise exception 'Playoff field is locked after postseason scoring begins';end if;
  end if;
  return new;
end;$function$;
revoke all on function ball_knower_private.validate_fantasy_league_settings() from public,anon,authenticated;
drop trigger if exists validate_fantasy_league_settings on public.ball_knower_leagues;
create trigger validate_fantasy_league_settings before insert or update of settings,max_members on public.ball_knower_leagues for each row execute function ball_knower_private.validate_fantasy_league_settings();

-- Transactional limits: a failed move rolls this counter back with the roster
-- change, so simultaneous waiver/free-agent requests cannot overspend a limit.
create table if not exists ball_knower_private.fantasy_acquisition_counters(
  league_id text not null references public.ball_knower_leagues(id) on delete cascade,
  member_id text not null references public.ball_knower_league_members(id) on delete cascade,
  season integer not null,week integer not null,count integer not null default 0 check(count>=0),
  primary key(league_id,member_id,season,week)
);
alter table ball_knower_private.fantasy_acquisition_counters enable row level security;
revoke all on ball_knower_private.fantasy_acquisition_counters from public,anon,authenticated;
create or replace function public.reset_ball_knower_league_for_next_season(p_league_id text)
returns boolean language plpgsql security definer set search_path='' as $function$
declare v_auth uuid:=(select auth.uid());
begin
  if v_auth is null then raise exception 'Authentication required';end if;
  if not exists(select 1 from public.ball_knower_leagues where id=p_league_id and commissioner_auth_id=v_auth) then raise exception 'Commissioner authorization required';end if;
  delete from public.ball_knower_weekly_scores where league_id=p_league_id;
  delete from public.ball_knower_weekly_lineups where league_id=p_league_id;
  delete from public.ball_knower_injury_rolls where league_id=p_league_id;
  delete from public.ball_knower_live_drafts where league_id=p_league_id;
  delete from ball_knower_private.fantasy_acquisition_counters where league_id=p_league_id;
  update public.ball_knower_trades set status='cancelled',resolved_at=now() where league_id=p_league_id and status in('pending','accepted_pending_review');
  update public.ball_knower_league_members set status='building',roster=null,team_ratings=null,submitted_at=null,live_draft_ready=false,faab_balance=100,ir_player_ids='[]'::jsonb where league_id=p_league_id;
  update public.ball_knower_leagues set status='drafting',season_result=null,rosters_locked=false,draft_countdown_started_at=null,updated_at=now() where id=p_league_id;
  return true;
end;$function$;
revoke all on function public.reset_ball_knower_league_for_next_season(text) from public,anon;
grant execute on function public.reset_ball_knower_league_for_next_season(text) to authenticated,service_role;
create or replace function ball_knower_private.enforce_fantasy_acquisition_limit()
returns trigger language plpgsql security definer set search_path='' as $function$
declare s jsonb;season_no integer;week_no integer;weekly_limit integer;season_limit integer;weekly_used integer;season_used integer;
begin
  if new.transaction_type not in('waiver','free_agent') then return new;end if;
  select settings into s from public.ball_knower_leagues where id=new.league_id for update;
  season_no:=coalesce(nullif(s->>'nflSeason','')::integer,extract(year from now())::integer);
  week_no:=greatest(1,coalesce(nullif(s->>'currentWeek','')::integer,1));
  weekly_limit:=coalesce(nullif(s->>'maxAcquisitionsPerWeek','')::integer,0);
  season_limit:=coalesce(nullif(s->>'maxAcquisitionsPerSeason','')::integer,0);
  select coalesce(count,0) into weekly_used from ball_knower_private.fantasy_acquisition_counters where league_id=new.league_id and member_id=new.member_id and season=season_no and week=week_no for update;
  select coalesce(sum(count),0) into season_used from ball_knower_private.fantasy_acquisition_counters where league_id=new.league_id and member_id=new.member_id and season=season_no;
  if weekly_limit>0 and coalesce(weekly_used,0)>=weekly_limit then raise exception 'Weekly acquisition limit reached';end if;
  if season_limit>0 and season_used>=season_limit then raise exception 'Season acquisition limit reached';end if;
  insert into ball_knower_private.fantasy_acquisition_counters(league_id,member_id,season,week,count) values(new.league_id,new.member_id,season_no,week_no,1)
  on conflict(league_id,member_id,season,week) do update set count=ball_knower_private.fantasy_acquisition_counters.count+1;
  return new;
end;$function$;
revoke all on function ball_knower_private.enforce_fantasy_acquisition_limit() from public,anon,authenticated;
drop trigger if exists enforce_fantasy_acquisition_limit on public.ball_knower_transactions;
create trigger enforce_fantasy_acquisition_limit before insert on public.ball_knower_transactions for each row execute function ball_knower_private.enforce_fantasy_acquisition_limit();

create or replace function ball_knower_private.enforce_fantasy_trade_deadline()
returns trigger language plpgsql security definer set search_path='' as $function$
declare s jsonb;week_no integer;deadline integer;
begin
  select settings into s from public.ball_knower_leagues where id=new.league_id;
  week_no:=greatest(1,coalesce(nullif(s->>'currentWeek','')::integer,1));deadline:=coalesce(nullif(s->>'tradeDeadlineWeek','')::integer,11);
  if week_no>deadline then
    if tg_op='INSERT' then raise exception 'The Week % trade deadline has passed',deadline;
    elsif tg_op='UPDATE' and old.status is distinct from new.status and new.status in('accepted_pending_review','accepted') then raise exception 'The Week % trade deadline has passed',deadline;end if;
  end if;
  return new;
end;$function$;
revoke all on function ball_knower_private.enforce_fantasy_trade_deadline() from public,anon,authenticated;
drop trigger if exists enforce_fantasy_trade_deadline on public.ball_knower_trades;
create trigger enforce_fantasy_trade_deadline before insert or update of status on public.ball_knower_trades for each row execute function ball_knower_private.enforce_fantasy_trade_deadline();

-- Patch the reviewed authoritative pick function: CPU picks retain caps; human
-- picks accept any eligible position until the 15-pick roster is full.
do $patch$
declare v_sql text;v_next text;
begin
  select pg_get_functiondef('public.make_ball_knower_live_draft_pick(text,text,text,jsonb)'::regprocedure) into v_sql;
  v_next:=replace(v_sql,
    E'v_group_limit:=case v_canonical_group when ''QB'' then 2 when ''RB'' then 5 when ''WR'' then 7 when ''TE'' then 2 when ''K'' then 2 when ''DST'' then 2 end;\n  if v_group_count>=v_group_limit then raise exception ''% reached the % roster limit'',v_member.user_name,v_canonical_group;end if;',
    E'if coalesce(v_member.is_ai,false) then\n    v_group_limit:=case v_canonical_group when ''QB'' then 2 when ''RB'' then 5 when ''WR'' then 7 when ''TE'' then 2 when ''K'' then 2 when ''DST'' then 2 end;\n    if v_group_count>=v_group_limit then raise exception ''% reached the % CPU roster limit'',v_member.user_name,v_canonical_group;end if;\n  end if;');
  if v_next=v_sql and position('CPU roster limit' in v_sql)=0 then raise exception 'Human position-limit patch did not match authoritative draft function';end if;
  v_sql:=v_next;
  v_next:=replace(v_next,
    E'else\n    if v_member.auth_user_id<>v_auth then',
    E'else\n    if coalesce((select settings->>''draftFormat'' from public.ball_knower_leagues where id=p_league_id),''live_snake'')=''autopick'' then raise exception ''This league uses an autopick-only draft'';end if;\n    if v_member.auth_user_id<>v_auth then');
  if v_next=v_sql and position('This league uses an autopick-only draft' in v_sql)=0 then raise exception 'Autopick-only manual-pick patch did not match authoritative draft function';end if;
  execute v_next;

  select pg_get_functiondef('public.start_ball_knower_live_draft(text)'::regprocedure) into v_sql;
  v_next:=replace(v_sql,
    'if not found then raise exception ''League not found''; end if;',
    E'if not found then raise exception ''League not found''; end if;\n  if coalesce(v_league.settings->>''draftFormat'',''live_snake'') in (''offline'',''mock'',''auction'') then raise exception ''Use the selected draft format workspace instead of the live snake room'';end if;');
  if v_next=v_sql and position('Use the selected draft format workspace' in v_sql)=0 then raise exception 'Draft-format guard did not match authoritative start function';end if;
  v_sql:=v_next;
  v_next:=replace(v_next,
    E'insert into public.ball_knower_live_drafts(league_id,status,order_member_ids,rounds,pick_index,picks)\n  values(p_league_id,''active'',v_order,15,0,''[]''::jsonb)',
    E'insert into public.ball_knower_live_drafts(league_id,status,order_member_ids,rounds,pick_index,picks,pick_seconds)\n  values(p_league_id,''active'',v_order,coalesce(nullif(v_league.settings->>''rosterSize'','''')::integer,15),0,''[]''::jsonb,case when coalesce(v_league.settings->>''draftFormat'',''live_snake'')=''autopick'' then 15 else 60 end)');
  if v_next=v_sql and position('coalesce(nullif(v_league.settings->>''rosterSize''' in v_sql)=0 then raise exception 'Draft round/clock patch did not match authoritative start function';end if;
  execute v_next;
end;$patch$;

do $scheduled_format_patch$
declare v_sql text;v_next text;
begin
  select pg_get_functiondef('public.process_due_ball_knower_scheduled_drafts(timestamptz,text)'::regprocedure) into v_sql;
  v_next:=replace(v_sql,
    'if p_now<v_scheduled_at then continue; end if;',
    'if p_now<v_scheduled_at then continue; end if; if coalesce(v_league.settings->>''draftFormat'',''live_snake'') in(''offline'',''mock'',''auction'') then continue;end if;');
  if v_next=v_sql and position('Scheduled special-format guard' in v_sql)=0 and position('in (''offline'', ''mock'', ''auction'')' in v_sql)=0 and position('in(''offline'',''mock'',''auction'')' in v_sql)=0 then raise exception 'Scheduled special-format guard did not match';end if;v_sql:=v_next;
  v_next:=replace(v_next,
    'insert into public.ball_knower_live_drafts(league_id,status,order_member_ids,rounds,pick_index,picks,started_at,updated_at)',
    'insert into public.ball_knower_live_drafts(league_id,status,order_member_ids,rounds,pick_index,picks,started_at,updated_at,pick_seconds)');
  if v_next=v_sql and position('updated_at, pick_seconds' in v_sql)=0 and position('updated_at,pick_seconds' in v_sql)=0 then raise exception 'Scheduled draft column patch did not match';end if;v_sql:=v_next;
  v_next:=replace(v_next,
    'values(v_league.id,''active'',v_order,15,0,''[]''::jsonb,p_now,p_now)',
    'values(v_league.id,''active'',v_order,coalesce(nullif(v_league.settings->>''rosterSize'','''')::integer,15),0,''[]''::jsonb,p_now,p_now,case when coalesce(v_league.settings->>''draftFormat'',''live_snake'')=''autopick'' then 15 else 60 end)');
  if v_next=v_sql and position('coalesce(nullif(v_league.settings->>''rosterSize''' in v_sql)=0 then raise exception 'Scheduled draft value patch did not match';end if;
  execute v_next;
end;$scheduled_format_patch$;

-- Autopick-only rooms use the schema-valid 15-second clock, but the recovery
-- worker treats every human turn as immediately due and can advance up to its
-- existing bounded batch size per invocation.
do $autopick_recovery_patch$
declare v_sql text;v_next text;
begin
  select pg_get_functiondef('public.process_due_ball_knower_draft_picks(timestamptz)'::regprocedure) into v_sql;
  v_next:=replace(v_sql,
    E'exit when not coalesce(v_member.is_ai,false) and coalesce(v_draft.pick_deadline_at,''infinity''::timestamptz)>p_now;',
    E'exit when not coalesce(v_member.is_ai,false) and coalesce((select settings->>''draftFormat'' from public.ball_knower_leagues where id=v_league_id),''live_snake'')<>''autopick'' and coalesce(v_draft.pick_deadline_at,''infinity''::timestamptz)>p_now;');
  if v_next=v_sql and position('v_league_id), ''live_snake'') <> ''autopick''' in v_sql)=0 and position('v_league_id),''live_snake'')<>''autopick''' in v_sql)=0 then raise exception 'Autopick recovery patch did not match';end if;
  execute v_next;
end;$autopick_recovery_patch$;

-- League-vote review reuses the existing hardened trade executor. The executor
-- only accepts the internal flag after an idempotent majority vote RPC.
do $trade_vote_patch$
declare v_sql text;v_next text;
begin
  select pg_get_functiondef('public.resolve_ball_knower_trade_v2_impl(uuid,text,text[])'::regprocedure) into v_sql;
  v_next:=replace(v_sql,
    'if v_review=''commissioner'' and not public.is_ball_knower_commissioner(t.league_id) then',
    'if v_review in(''commissioner'',''league_vote'') and (v_review=''league_vote'' or not public.is_ball_knower_commissioner(t.league_id)) then');
  if v_next=v_sql and position('v_review = ''league_vote''' in v_sql)=0 and position('v_review=''league_vote''' in v_sql)=0 then raise exception 'League-vote pending-review patch did not match trade resolver';end if;
  v_sql:=v_next;
  v_next:=replace(v_next,
    'if not public.is_ball_knower_commissioner(t.league_id) then raise exception ''Commissioner authorization required''; end if;',
    'if not public.is_ball_knower_commissioner(t.league_id) and coalesce(current_setting(''ball_knower.authorized_trade_vote'',true),'''')<>''approved'' then raise exception ''Trade review authorization required''; end if;');
  if v_next=v_sql and position('authorized_trade_vote' in v_sql)=0 then raise exception 'League-vote approval patch did not match trade resolver';end if;
  execute v_next;
end;$trade_vote_patch$;

create table if not exists public.ball_knower_trade_votes(
  trade_id uuid not null references public.ball_knower_trades(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  vote text not null check(vote in('approve','veto')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  primary key(trade_id,auth_user_id)
);
create index if not exists bk_trade_votes_user_idx on public.ball_knower_trade_votes(auth_user_id,updated_at desc);
alter table public.ball_knower_trade_votes enable row level security;
revoke all on public.ball_knower_trade_votes from public,anon,authenticated;grant select on public.ball_knower_trade_votes to authenticated;
drop policy if exists bk_trade_votes_league_read on public.ball_knower_trade_votes;
create policy bk_trade_votes_league_read on public.ball_knower_trade_votes for select to authenticated using(exists(select 1 from public.ball_knower_trades t where t.id=trade_id and public.can_access_ball_knower_league(t.league_id)));

create or replace function public.vote_on_ball_knower_trade(p_trade_id uuid,p_vote text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare me uuid:=(select auth.uid());t public.ball_knower_trades%rowtype;my_member text;eligible integer;approvals integer;vetoes integer;needed integer;result jsonb;
begin
  if me is null or p_vote not in('approve','veto') then raise exception 'Invalid trade vote';end if;
  select * into t from public.ball_knower_trades where id=p_trade_id for update;if not found or t.status<>'accepted_pending_review' then raise exception 'Trade is not awaiting a league vote';end if;
  if coalesce((select settings->>'tradeReview' from public.ball_knower_leagues where id=t.league_id),'commissioner')<>'league_vote' then raise exception 'This league does not use trade voting';end if;
  select count(*) into eligible from public.ball_knower_league_members where league_id=t.league_id and not is_ai and auth_user_id is not null and id not in(t.proposer_member_id,t.recipient_member_id);needed:=floor(eligible/2.0)+1;
  if eligible=0 then
    if not public.is_ball_knower_commissioner(t.league_id) then raise exception 'No neutral voters are available; commissioner fallback required';end if;
    if p_vote='veto' then update public.ball_knower_trades set status='vetoed',resolved_at=now() where id=t.id;return jsonb_build_object('status','vetoed','approvals',0,'vetoes',1,'needed',1,'fallback','commissioner');end if;
    perform set_config('ball_knower.authorized_trade_vote','approved',true);result:=public.resolve_ball_knower_trade_v2_impl(t.id,'approved','{}'::text[]);perform set_config('ball_knower.authorized_trade_vote','',true);return result||jsonb_build_object('approvals',1,'vetoes',0,'needed',1,'fallback','commissioner');
  end if;
  select id into my_member from public.ball_knower_league_members where league_id=t.league_id and auth_user_id=me and not is_ai;
  if my_member is null or my_member in(t.proposer_member_id,t.recipient_member_id) then raise exception 'Trade participants cannot vote on their own deal';end if;
  insert into public.ball_knower_trade_votes(trade_id,auth_user_id,vote) values(t.id,me,p_vote) on conflict(trade_id,auth_user_id) do update set vote=excluded.vote,updated_at=now();
  select count(*) filter(where vote='approve'),count(*) filter(where vote='veto') into approvals,vetoes from public.ball_knower_trade_votes where trade_id=t.id;
  if vetoes>=needed then update public.ball_knower_trades set status='vetoed',resolved_at=now() where id=t.id;return jsonb_build_object('status','vetoed','approvals',approvals,'vetoes',vetoes,'needed',needed);end if;
  if approvals>=needed then perform set_config('ball_knower.authorized_trade_vote','approved',true);result:=public.resolve_ball_knower_trade_v2_impl(t.id,'approved','{}'::text[]);perform set_config('ball_knower.authorized_trade_vote','',true);return result||jsonb_build_object('approvals',approvals,'vetoes',vetoes,'needed',needed);end if;
  return jsonb_build_object('status','accepted_pending_review','approvals',approvals,'vetoes',vetoes,'needed',needed);
end;$function$;
revoke all on function public.vote_on_ball_knower_trade(uuid,text) from public,anon;grant execute on function public.vote_on_ball_knower_trade(uuid,text) to authenticated;

-- Private manager-to-manager DMs. RLS checks the permanent auth UUID on both
-- sides; another league member cannot enumerate or read the thread.
create table if not exists public.ball_knower_dm_threads(
  id uuid primary key default gen_random_uuid(),league_id text not null references public.ball_knower_leagues(id) on delete cascade,
  participant_a uuid not null references auth.users(id) on delete cascade,participant_b uuid not null references auth.users(id) on delete cascade,
  last_read_a_at timestamptz,last_read_b_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  check(participant_a<>participant_b),unique(league_id,participant_a,participant_b),check(participant_a::text<participant_b::text)
);
create table if not exists public.ball_knower_dm_messages(
  id uuid primary key default gen_random_uuid(),thread_id uuid not null references public.ball_knower_dm_threads(id) on delete cascade,
  sender_auth_id uuid not null references auth.users(id) on delete cascade,body text not null check(length(btrim(body)) between 1 and 1000),created_at timestamptz not null default now()
);
create index if not exists bk_dm_threads_participant_a_idx on public.ball_knower_dm_threads(participant_a,updated_at desc);
create index if not exists bk_dm_threads_participant_b_idx on public.ball_knower_dm_threads(participant_b,updated_at desc);
create index if not exists bk_dm_messages_thread_idx on public.ball_knower_dm_messages(thread_id,created_at);
alter table public.ball_knower_dm_threads enable row level security;alter table public.ball_knower_dm_messages enable row level security;
revoke all on public.ball_knower_dm_threads,public.ball_knower_dm_messages from anon,authenticated;
grant select on public.ball_knower_dm_threads,public.ball_knower_dm_messages to authenticated;
drop policy if exists bk_dm_threads_private_read on public.ball_knower_dm_threads;
create policy bk_dm_threads_private_read on public.ball_knower_dm_threads for select to authenticated using((select auth.uid()) in (participant_a,participant_b));
drop policy if exists bk_dm_messages_private_read on public.ball_knower_dm_messages;
create policy bk_dm_messages_private_read on public.ball_knower_dm_messages for select to authenticated using(exists(select 1 from public.ball_knower_dm_threads t where t.id=thread_id and (select auth.uid()) in(t.participant_a,t.participant_b)));

create table if not exists public.ball_knower_trade_messages(
  id uuid primary key default gen_random_uuid(),trade_id uuid not null references public.ball_knower_trades(id) on delete cascade,
  sender_auth_id uuid not null references auth.users(id) on delete cascade,body text not null check(length(btrim(body)) between 1 and 1000),created_at timestamptz not null default now()
);
create table if not exists public.ball_knower_trade_thread_reads(
  trade_id uuid not null references public.ball_knower_trades(id) on delete cascade,auth_user_id uuid not null references auth.users(id) on delete cascade,last_read_at timestamptz not null default now(),primary key(trade_id,auth_user_id)
);
create index if not exists bk_trade_messages_trade_idx on public.ball_knower_trade_messages(trade_id,created_at);
alter table public.ball_knower_trade_messages enable row level security;alter table public.ball_knower_trade_thread_reads enable row level security;revoke all on public.ball_knower_trade_messages,public.ball_knower_trade_thread_reads from anon,authenticated;grant select on public.ball_knower_trade_messages,public.ball_knower_trade_thread_reads to authenticated;
drop policy if exists bk_trade_messages_participant_read on public.ball_knower_trade_messages;
create policy bk_trade_messages_participant_read on public.ball_knower_trade_messages for select to authenticated using(exists(select 1 from public.ball_knower_trades t join public.ball_knower_league_members p on p.id=t.proposer_member_id join public.ball_knower_league_members r on r.id=t.recipient_member_id where t.id=trade_id and (select auth.uid()) in(p.auth_user_id,r.auth_user_id)));
drop policy if exists bk_trade_thread_reads_owner on public.ball_knower_trade_thread_reads;
create policy bk_trade_thread_reads_owner on public.ball_knower_trade_thread_reads for select to authenticated using(auth_user_id=(select auth.uid()));

create table if not exists public.ball_knower_trading_block(
  league_id text not null references public.ball_knower_leagues(id) on delete cascade,member_id text not null references public.ball_knower_league_members(id) on delete cascade,
  player_id text not null,status text not null check(status in('available','looking_for','untouchable')),looking_for text[] not null default '{}',note text,updated_at timestamptz not null default now(),primary key(league_id,member_id,player_id)
);
create table if not exists public.ball_knower_watched_players(
  league_id text not null references public.ball_knower_leagues(id) on delete cascade,auth_user_id uuid not null references auth.users(id) on delete cascade,player_id text not null,created_at timestamptz not null default now(),primary key(league_id,auth_user_id,player_id)
);
create index if not exists bk_trading_block_league_idx on public.ball_knower_trading_block(league_id,updated_at desc);
alter table public.ball_knower_trading_block enable row level security;alter table public.ball_knower_watched_players enable row level security;
grant select,insert,update,delete on public.ball_knower_trading_block,public.ball_knower_watched_players to authenticated;revoke all on public.ball_knower_trading_block,public.ball_knower_watched_players from anon;
drop policy if exists bk_trading_block_league_read on public.ball_knower_trading_block;
create policy bk_trading_block_league_read on public.ball_knower_trading_block for select to authenticated using(public.can_access_ball_knower_league(league_id));
drop policy if exists bk_trading_block_owner_write on public.ball_knower_trading_block;
create policy bk_trading_block_owner_write on public.ball_knower_trading_block for all to authenticated
using(exists(select 1 from public.ball_knower_league_members m where m.id=member_id and m.league_id=league_id and m.auth_user_id=(select auth.uid())))
with check(exists(select 1 from public.ball_knower_league_members m cross join lateral jsonb_array_elements(coalesce(m.roster,'[]'::jsonb)) player where m.id=member_id and m.league_id=league_id and m.auth_user_id=(select auth.uid()) and player->>'id'=player_id));
create or replace function ball_knower_private.remove_stale_trading_block_entries()
returns trigger language plpgsql security definer set search_path='' as $function$
begin
  delete from public.ball_knower_trading_block block
  where block.member_id=new.id
    and not exists(select 1 from jsonb_array_elements(coalesce(new.roster,'[]'::jsonb)) player where player->>'id'=block.player_id);
  return new;
end;$function$;
revoke all on function ball_knower_private.remove_stale_trading_block_entries() from public,anon,authenticated;
drop trigger if exists remove_stale_trading_block_entries on public.ball_knower_league_members;
create trigger remove_stale_trading_block_entries after update of roster on public.ball_knower_league_members for each row when(old.roster is distinct from new.roster) execute function ball_knower_private.remove_stale_trading_block_entries();
drop policy if exists bk_watched_players_owner on public.ball_knower_watched_players;
create policy bk_watched_players_owner on public.ball_knower_watched_players for all to authenticated using(auth_user_id=(select auth.uid())) with check(auth_user_id=(select auth.uid()) and public.can_access_ball_knower_league(league_id));

create or replace function ball_knower_private.notify_fantasy_user(p_league_id text,p_user uuid,p_title text,p_body text,p_kind text)
returns void language plpgsql security definer set search_path='' as $function$
begin
  if p_user is null then return;end if;perform set_config('ball_knower.authorized_notification_operation','system',true);
  insert into public.ball_knower_notifications(league_id,auth_user_id,title,body,kind) values(p_league_id,p_user,left(p_title,120),left(p_body,500),left(p_kind,60));
end;$function$;
revoke all on function ball_knower_private.notify_fantasy_user(text,uuid,text,text,text) from public,anon,authenticated;

create or replace function public.open_ball_knower_dm(p_league_id text,p_other_member_id text)
returns uuid language plpgsql security definer set search_path='' as $function$
declare me uuid:=(select auth.uid());other_user uuid;a uuid;b uuid;thread_id uuid;
begin
  if me is null then raise exception 'Authentication required';end if;
  if not exists(select 1 from public.ball_knower_league_members where league_id=p_league_id and auth_user_id=me and not is_ai) then raise exception 'League membership required';end if;
  select auth_user_id into other_user from public.ball_knower_league_members where league_id=p_league_id and id=p_other_member_id and not is_ai;
  if other_user is null or other_user=me then raise exception 'Choose another human manager';end if;
  a:=least(me,other_user);b:=greatest(me,other_user);
  insert into public.ball_knower_dm_threads(league_id,participant_a,participant_b) values(p_league_id,a,b) on conflict(league_id,participant_a,participant_b) do update set updated_at=excluded.updated_at returning id into thread_id;
  return thread_id;
end;$function$;
create or replace function public.send_ball_knower_dm(p_thread_id uuid,p_body text)
returns uuid language plpgsql security definer set search_path='' as $function$
declare me uuid:=(select auth.uid());t public.ball_knower_dm_threads%rowtype;message_id uuid;recipient uuid;sender_name text;
begin
  select * into t from public.ball_knower_dm_threads where id=p_thread_id for update;if not found or me not in(t.participant_a,t.participant_b) then raise exception 'Private thread access denied';end if;
  if length(btrim(coalesce(p_body,''))) not between 1 and 1000 then raise exception 'Message must be 1-1000 characters';end if;
  insert into public.ball_knower_dm_messages(thread_id,sender_auth_id,body) values(t.id,me,btrim(p_body)) returning id into message_id;
  recipient:=case when me=t.participant_a then t.participant_b else t.participant_a end;
  update public.ball_knower_dm_threads set updated_at=now(),last_read_a_at=case when me=participant_a then now() else last_read_a_at end,last_read_b_at=case when me=participant_b then now() else last_read_b_at end where id=t.id;
  select user_name into sender_name from public.ball_knower_league_members where league_id=t.league_id and auth_user_id=me;
  perform ball_knower_private.notify_fantasy_user(t.league_id,recipient,'New private message',coalesce(sender_name,'A manager')||' sent you a DM.','fantasy_dm');return message_id;
end;$function$;
create or replace function public.mark_ball_knower_dm_read(p_thread_id uuid)
returns void language plpgsql security definer set search_path='' as $function$
declare me uuid:=(select auth.uid());begin update public.ball_knower_dm_threads set last_read_a_at=case when participant_a=me then now() else last_read_a_at end,last_read_b_at=case when participant_b=me then now() else last_read_b_at end where id=p_thread_id and me in(participant_a,participant_b);if not found then raise exception 'Private thread access denied';end if;end;$function$;
create or replace function public.send_ball_knower_trade_message(p_trade_id uuid,p_body text)
returns uuid language plpgsql security definer set search_path='' as $function$
declare me uuid:=(select auth.uid());t public.ball_knower_trades%rowtype;p uuid;r uuid;message_id uuid;
begin if me is null then raise exception 'Authentication required';end if;select * into t from public.ball_knower_trades where id=p_trade_id;if not found then raise exception 'Trade thread access denied';end if;select auth_user_id into p from public.ball_knower_league_members where id=t.proposer_member_id;select auth_user_id into r from public.ball_knower_league_members where id=t.recipient_member_id;if p is null or r is null or(me is distinct from p and me is distinct from r) then raise exception 'Trade thread access denied';end if;if length(btrim(coalesce(p_body,''))) not between 1 and 1000 then raise exception 'Message must be 1-1000 characters';end if;insert into public.ball_knower_trade_messages(trade_id,sender_auth_id,body) values(t.id,me,btrim(p_body)) returning id into message_id;perform ball_knower_private.notify_fantasy_user(t.league_id,case when me=p then r else p end,'Trade message','A manager replied in your trade thread.','trade_message');return message_id;end;$function$;
create or replace function public.mark_ball_knower_trade_thread_read(p_trade_id uuid)
returns void language plpgsql security definer set search_path='' as $function$
declare me uuid:=(select auth.uid());begin if not exists(select 1 from public.ball_knower_trades t join public.ball_knower_league_members p on p.id=t.proposer_member_id join public.ball_knower_league_members r on r.id=t.recipient_member_id where t.id=p_trade_id and me in(p.auth_user_id,r.auth_user_id)) then raise exception 'Trade thread access denied';end if;insert into public.ball_knower_trade_thread_reads(trade_id,auth_user_id,last_read_at) values(p_trade_id,me,now()) on conflict(trade_id,auth_user_id) do update set last_read_at=excluded.last_read_at;end;$function$;
revoke all on function public.open_ball_knower_dm(text,text),public.send_ball_knower_dm(uuid,text),public.mark_ball_knower_dm_read(uuid),public.send_ball_knower_trade_message(uuid,text),public.mark_ball_knower_trade_thread_read(uuid) from public,anon;
grant execute on function public.open_ball_knower_dm(text,text),public.send_ball_knower_dm(uuid,text),public.mark_ball_knower_dm_read(uuid),public.send_ball_knower_trade_message(uuid,text),public.mark_ball_knower_trade_thread_read(uuid) to authenticated;

-- Event fanout for trades, waivers, injuries and draft clock changes. Native push
-- can consume these owner-scoped notification rows later; in-app delivery works now.
create or replace function ball_knower_private.fantasy_notification_fanout()
returns trigger language plpgsql security definer set search_path='' as $function$
declare u uuid;league text;next_member text;pick jsonb;watcher record;
begin
  if tg_table_name='ball_knower_trades' then
    league:=new.league_id;select auth_user_id into u from public.ball_knower_league_members where id=case when tg_op='INSERT' then new.recipient_member_id when new.status in('rejected','vetoed','accepted','accepted_pending_review') then new.proposer_member_id else new.recipient_member_id end;
    perform ball_knower_private.notify_fantasy_user(league,u,case when tg_op='INSERT' then 'Trade received' else 'Trade '||replace(new.status,'_',' ') end,'Open League Activity for the latest trade update.','trade_'||new.status);
  elsif tg_table_name='ball_knower_waiver_claims' and old.status is distinct from new.status and new.status in('won','lost') then
    select league_id,auth_user_id into league,u from public.ball_knower_league_members where id=new.member_id;perform ball_knower_private.notify_fantasy_user(league,u,'Waiver '||new.status,coalesce(new.player_snapshot->>'name',new.player_id)||' · '||coalesce(new.failure_reason,'Claim processed'),'waiver_'||new.status);
  elsif tg_table_name='ball_knower_injuries' then
    select m.league_id,m.auth_user_id into league,u from public.ball_knower_league_members m where m.id=new.member_id;perform ball_knower_private.notify_fantasy_user(league,u,'Player status update',new.player_name||' is now '||new.status||'.','player_status');
  elsif tg_table_name='ball_knower_live_drafts' and new.status='active' then
    if tg_op='INSERT' then null;
    elsif tg_op='UPDATE' then if old.pick_index is not distinct from new.pick_index then return new;end if;
    else return new;end if;
    next_member:=new.order_member_ids->>(case when mod(new.pick_index/jsonb_array_length(new.order_member_ids),2)=0 then mod(new.pick_index,jsonb_array_length(new.order_member_ids)) else jsonb_array_length(new.order_member_ids)-1-mod(new.pick_index,jsonb_array_length(new.order_member_ids)) end);
    select auth_user_id into u from public.ball_knower_league_members where league_id=new.league_id and id=next_member;perform ball_knower_private.notify_fantasy_user(new.league_id,u,'You are on the clock','Your Ball Knower fantasy pick is ready.','draft_on_clock');
    if tg_op='UPDATE' and jsonb_array_length(new.picks)>0 then pick:=new.picks->-1;if pick->>'source'='autopick' then select auth_user_id into u from public.ball_knower_league_members where league_id=new.league_id and id=pick->>'memberId';perform ball_knower_private.notify_fantasy_user(new.league_id,u,'Selection autopicked','Your queue or best available player made the pick.','draft_autopick');end if;end if;
  elsif tg_table_name='ball_knower_league_messages' then
    for watcher in select auth_user_id from public.ball_knower_league_members where league_id=new.league_id and auth_user_id is not null and auth_user_id<>new.auth_user_id and not is_ai loop perform ball_knower_private.notify_fantasy_user(new.league_id,watcher.auth_user_id,'League message',new.member_name||': '||left(new.body,180),'league_message');end loop;
  elsif tg_table_name='ball_knower_trading_block' then
    for watcher in select auth_user_id from public.ball_knower_watched_players where league_id=new.league_id and player_id=new.player_id loop perform ball_knower_private.notify_fantasy_user(new.league_id,watcher.auth_user_id,'Watched player on Trading Block',new.player_id||' is marked '||replace(new.status,'_',' ')||'.','trading_block');end loop;
  elsif tg_table_name='ball_knower_weekly_scores' and new.is_final then
    if tg_op='INSERT' then null;
    elsif tg_op='UPDATE' then if coalesce(old.is_final,false) then return new;end if;
    else return new;end if;
    select auth_user_id into u from public.ball_knower_league_members where id=new.member_id;perform ball_knower_private.notify_fantasy_user(new.league_id,u,'Final matchup result','Your Week '||new.week_number||' score is final: '||new.live_points||' points.','matchup_final');
  end if;return new;
end;$function$;
revoke all on function ball_knower_private.fantasy_notification_fanout() from public,anon,authenticated;
drop trigger if exists fantasy_trade_notification on public.ball_knower_trades;create trigger fantasy_trade_notification after insert or update of status on public.ball_knower_trades for each row execute function ball_knower_private.fantasy_notification_fanout();
drop trigger if exists fantasy_waiver_notification on public.ball_knower_waiver_claims;create trigger fantasy_waiver_notification after update of status on public.ball_knower_waiver_claims for each row execute function ball_knower_private.fantasy_notification_fanout();
drop trigger if exists fantasy_injury_notification on public.ball_knower_injuries;create trigger fantasy_injury_notification after insert or update of status on public.ball_knower_injuries for each row execute function ball_knower_private.fantasy_notification_fanout();
drop trigger if exists fantasy_draft_clock_notification on public.ball_knower_live_drafts;create trigger fantasy_draft_clock_notification after insert or update of pick_index,status on public.ball_knower_live_drafts for each row execute function ball_knower_private.fantasy_notification_fanout();
drop trigger if exists fantasy_league_message_notification on public.ball_knower_league_messages;create trigger fantasy_league_message_notification after insert on public.ball_knower_league_messages for each row execute function ball_knower_private.fantasy_notification_fanout();
drop trigger if exists fantasy_trading_block_notification on public.ball_knower_trading_block;create trigger fantasy_trading_block_notification after insert or update of status,looking_for on public.ball_knower_trading_block for each row execute function ball_knower_private.fantasy_notification_fanout();
drop trigger if exists fantasy_matchup_final_notification on public.ball_knower_weekly_scores;create trigger fantasy_matchup_final_notification after insert or update of is_final on public.ball_knower_weekly_scores for each row execute function ball_knower_private.fantasy_notification_fanout();

create table if not exists ball_knower_private.matchup_notification_receipts(
  league_id text not null references public.ball_knower_leagues(id) on delete cascade,week integer not null,created_at timestamptz not null default now(),primary key(league_id,week)
);
alter table ball_knower_private.matchup_notification_receipts enable row level security;revoke all on ball_knower_private.matchup_notification_receipts from public,anon,authenticated;
create or replace function public.process_due_ball_knower_matchup_notifications(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path='' as $function$
declare l record;kickoff timestamptz;inserted integer;sent integer:=0;
begin
  perform set_config('ball_knower.authorized_notification_operation','system',true);
  for l in select id,settings from public.ball_knower_leagues where coalesce((settings->>'fantasySeasonStarted')::boolean,false) and not coalesce((settings->>'fantasySeasonComplete')::boolean,false) loop
    select min(g.kickoff_at) into kickoff from public.ball_knower_nfl_games g where g.season=coalesce(nullif(l.settings->>'nflSeason','')::integer,extract(year from p_now)::integer) and g.week_number=coalesce(nullif(l.settings->>'currentWeek','')::integer,1);
    if kickoff is null or p_now<kickoff-interval '15 minutes' or p_now>=kickoff then continue;end if;
    insert into ball_knower_private.matchup_notification_receipts(league_id,week) values(l.id,coalesce(nullif(l.settings->>'currentWeek','')::integer,1)) on conflict do nothing;get diagnostics inserted=row_count;
    if inserted>0 then insert into public.ball_knower_notifications(league_id,auth_user_id,title,body,kind) select l.id,m.auth_user_id,'Matchup starts soon','Set your lineup now. The first NFL game of this fantasy week starts in under 15 minutes.','matchup_starting' from public.ball_knower_league_members m where m.league_id=l.id and not m.is_ai and m.auth_user_id is not null;sent:=sent+1;end if;
  end loop;return sent;
end;$function$;
revoke all on function public.process_due_ball_knower_matchup_notifications(timestamptz) from public,anon,authenticated;grant execute on function public.process_due_ball_knower_matchup_notifications(timestamptz) to service_role;

-- Secure commissioner utilities used by advanced settings.
create or replace function ball_knower_private.build_fantasy_regular_schedule(p_member_ids jsonb,p_weeks integer)
returns jsonb language plpgsql immutable set search_path='' as $function$
declare rotation text[];member_count integer;week_no integer;round_no integer;step integer;slot integer;first_id text;second_id text;home_id text;away_id text;games jsonb:='[]'::jsonb;
begin
  if jsonb_typeof(p_member_ids)<>'array' then return games;end if;
  select array_agg(value order by ordinality) into rotation from jsonb_array_elements_text(p_member_ids) with ordinality;
  member_count:=coalesce(array_length(rotation,1),0);if member_count<2 or mod(member_count,2)<>0 then return games;end if;
  for week_no in 1..greatest(1,p_weeks) loop
    select array_agg(value order by ordinality) into rotation from jsonb_array_elements_text(p_member_ids) with ordinality;
    round_no:=mod(week_no-1,member_count-1);
    for step in 1..round_no loop rotation:=array_cat(array[rotation[1],rotation[member_count]],rotation[2:member_count-1]);end loop;
    for slot in 1..member_count/2 loop
      first_id:=rotation[slot];second_id:=rotation[member_count+1-slot];
      if (mod(round_no,2)=0)<>(mod((week_no-1)/(member_count-1),2)=1) then home_id:=first_id;away_id:=second_id;else home_id:=second_id;away_id:=first_id;end if;
      games:=games||jsonb_build_array(jsonb_build_object('id','game-w'||week_no||'-'||home_id||'-vs-'||away_id,'week',week_no,'homeMemberId',home_id,'awayMemberId',away_id,'homeScore',0,'awayScore',0,'winnerId','','loserId','','isTie',false,'keyMatchupFactor','Scheduled fantasy matchup.'));
    end loop;
  end loop;return games;
end;$function$;
revoke all on function ball_knower_private.build_fantasy_regular_schedule(jsonb,integer) from public,anon,authenticated;

-- Older Random/Commissioner-order leagues stored an empty games array. Give
-- them the same canonical editable schedule as newly finalized leagues.
with ready as(
  select l.id,coalesce(nullif(l.settings->>'regularSeasonWeeks','')::integer,17) weeks,
    (select jsonb_agg(to_jsonb(pick->>'memberId') order by (pick->>'pickNumber')::integer) from jsonb_array_elements(coalesce(l.season_result->'draftOrder','[]'::jsonb)) pick) member_ids,
    (select count(*) from public.ball_knower_league_members m where m.league_id=l.id) member_count
  from public.ball_knower_leagues l where l.season_result is not null and jsonb_array_length(coalesce(l.season_result->'games','[]'::jsonb))=0
)
update public.ball_knower_leagues l set season_result=jsonb_set(l.season_result,'{games}',ball_knower_private.build_fantasy_regular_schedule(ready.member_ids,ready.weeks),true),updated_at=now()
from ready where l.id=ready.id and ready.member_count>=2 and mod(ready.member_count,2)=0 and jsonb_array_length(ready.member_ids)=ready.member_count;

create or replace function public.commissioner_set_ball_knower_waiver_priority(p_league_id text,p_member_id text,p_priority integer)
returns void language plpgsql security definer set search_path='' as $function$
declare old_priority integer;new_priority integer;begin if not public.is_ball_knower_commissioner(p_league_id) then raise exception 'Commissioner only';end if;new_priority:=greatest(1,least(coalesce(p_priority,1),(select count(*) from public.ball_knower_league_members where league_id=p_league_id)));select waiver_priority into old_priority from public.ball_knower_league_members where league_id=p_league_id and id=p_member_id for update;if not found then raise exception 'Member not found';end if;update public.ball_knower_league_members set waiver_priority=case when id=p_member_id then new_priority when new_priority<old_priority and waiver_priority>=new_priority and waiver_priority<old_priority then waiver_priority+1 when new_priority>old_priority and waiver_priority<=new_priority and waiver_priority>old_priority then waiver_priority-1 else waiver_priority end where league_id=p_league_id;end;$function$;
create or replace function public.commissioner_edit_ball_knower_matchup(p_league_id text,p_week integer,p_game_id text,p_home_member_id text,p_away_member_id text)
returns void language plpgsql security definer set search_path='' as $function$
declare member_ids jsonb;weeks integer;nfl_season integer;old_home text;old_away text;removed text[];added text[];game jsonb;rebuilt jsonb:='[]'::jsonb;home_id text;away_id text;position integer;
begin
  if not public.is_ball_knower_commissioner(p_league_id) then raise exception 'Commissioner only';end if;
  if p_week<1 or p_week>17 or p_home_member_id=p_away_member_id then raise exception 'Invalid matchup';end if;
  if(select count(*) from public.ball_knower_league_members where league_id=p_league_id and id in(p_home_member_id,p_away_member_id))<>2 then raise exception 'Both teams must belong to this league';end if;
  select (select jsonb_agg(to_jsonb(pick->>'memberId') order by (pick->>'pickNumber')::integer) from jsonb_array_elements(coalesce(l.season_result->'draftOrder','[]'::jsonb)) pick),coalesce(nullif(l.settings->>'regularSeasonWeeks','')::integer,17),coalesce(nullif(l.settings->>'nflSeason','')::integer,(select max(season) from public.ball_knower_nfl_games)) into member_ids,weeks,nfl_season from public.ball_knower_leagues l where l.id=p_league_id for update;
  if not exists(select 1 from public.ball_knower_leagues l cross join lateral jsonb_array_elements(coalesce(l.season_result->'games','[]'::jsonb)) item where l.id=p_league_id and not(item?'playoffRound')) then update public.ball_knower_leagues set season_result=jsonb_set(season_result,'{games}',ball_knower_private.build_fantasy_regular_schedule(member_ids,weeks),true) where id=p_league_id;end if;
  select item->>'homeMemberId',item->>'awayMemberId' into old_home,old_away from public.ball_knower_leagues l cross join lateral jsonb_array_elements(coalesce(l.season_result->'games','[]'::jsonb)) item where l.id=p_league_id and item->>'id'=p_game_id and (item->>'week')::integer=p_week and not(item?'playoffRound');
  if old_home is null then raise exception 'Only an existing regular-season matchup can be edited';end if;
  if exists(select 1 from public.ball_knower_weekly_scores where league_id=p_league_id and week_number=p_week and (is_final or live_points<>0))
    or exists(select 1 from public.ball_knower_weekly_lineups where league_id=p_league_id and week_number=p_week and locked)
    or exists(select 1 from public.ball_knower_nfl_games where season=nfl_season and week_number=p_week and kickoff_at<=now())
  then raise exception 'A started or finalized matchup cannot be edited';end if;
  removed:=array(select id from unnest(array[old_home,old_away]) id where id not in(p_home_member_id,p_away_member_id));
  added:=array(select id from unnest(array[p_home_member_id,p_away_member_id]) id where id not in(old_home,old_away));
  for game in select value from public.ball_knower_leagues l cross join lateral jsonb_array_elements(l.season_result->'games') where l.id=p_league_id loop
    if game->>'id'=p_game_id then game:=game||jsonb_build_object('homeMemberId',p_home_member_id,'awayMemberId',p_away_member_id);
    elsif coalesce((game->>'week')::integer,0)=p_week and not(game?'playoffRound') then
      home_id:=game->>'homeMemberId';away_id:=game->>'awayMemberId';position:=array_position(added,home_id);if position is not null then home_id:=removed[position];end if;position:=array_position(added,away_id);if position is not null then away_id:=removed[position];end if;game:=game||jsonb_build_object('homeMemberId',home_id,'awayMemberId',away_id);
    end if;rebuilt:=rebuilt||jsonb_build_array(game);
  end loop;
  update public.ball_knower_leagues set season_result=jsonb_set(season_result,'{games}',rebuilt,false),updated_at=now() where id=p_league_id;
end;$function$;
revoke all on function public.commissioner_set_ball_knower_waiver_priority(text,text,integer),public.commissioner_edit_ball_knower_matchup(text,integer,text,text,text) from public,anon;
grant execute on function public.commissioner_set_ball_knower_waiver_priority(text,text,integer),public.commissioner_edit_ball_knower_matchup(text,integer,text,text,text) to authenticated;

create or replace function public.commissioner_import_ball_knower_offline_draft(p_league_id text,p_picks jsonb)
returns boolean language plpgsql security definer set search_path='' as $function$
declare member_count integer;pick_count integer;roster_size integer;member_row record;item jsonb;ord bigint;grp text;draft_picks jsonb:='[]'::jsonb;draft_order jsonb;league_settings jsonb;
begin
  if not public.is_ball_knower_commissioner(p_league_id) then raise exception 'Commissioner only';end if;
  select settings into league_settings from public.ball_knower_leagues where id=p_league_id for update;
  if not found then raise exception 'League not found';end if;
  if coalesce(league_settings->>'draftFormat','live_snake')<>'offline' then raise exception 'League is not configured for offline results';end if;
  if coalesce((league_settings->>'fantasySeasonStarted')::boolean,false)
    or coalesce((league_settings->>'fantasySeasonComplete')::boolean,false)
    or exists(select 1 from public.ball_knower_weekly_lineups where league_id=p_league_id)
    or exists(select 1 from public.ball_knower_weekly_scores where league_id=p_league_id)
    or exists(select 1 from public.ball_knower_transactions where league_id=p_league_id)
    or exists(select 1 from public.ball_knower_trades where league_id=p_league_id)
  then raise exception 'Offline draft results are locked after season activity begins';end if;
  if jsonb_typeof(p_picks)<>'array' then raise exception 'Offline picks must be an array';end if;
  select count(*) into member_count from public.ball_knower_league_members where league_id=p_league_id;roster_size:=public.ball_knower_fantasy_roster_size(p_league_id);pick_count:=jsonb_array_length(p_picks);if member_count<2 or pick_count<>member_count*roster_size then raise exception 'Offline draft requires exactly % unique picks',member_count*roster_size;end if;
  if (select count(distinct x->>'playerId') from jsonb_array_elements(p_picks)x)<>pick_count then raise exception 'A player appears more than once';end if;
  for member_row in select id from public.ball_knower_league_members where league_id=p_league_id loop if (select count(*) from jsonb_array_elements(p_picks)x where x->>'memberId'=member_row.id)<>roster_size then raise exception 'Every member needs % picks',roster_size;end if;end loop;
  for item,ord in select value,ordinality from jsonb_array_elements(p_picks) with ordinality loop
    if not exists(select 1 from public.ball_knower_league_members where league_id=p_league_id and id=item->>'memberId') then raise exception 'Unknown member in offline results';end if;
    select draft_group into grp from public.ball_knower_fantasy_player_groups where player_id=item->>'playerId';if grp is null or grp not in('QB','RB','WR','TE','K','DST') then raise exception 'Invalid fantasy player %',item->>'playerId';end if;
    draft_picks:=draft_picks||jsonb_build_array(jsonb_build_object('overall',ord,'round',ceil(ord::numeric/member_count),'memberId',item->>'memberId','playerId',item->>'playerId','group',grp,'pickedAt',clock_timestamp(),'source','offline'));
  end loop;
  for member_row in select id from public.ball_knower_league_members where league_id=p_league_id and is_ai loop
    if (select count(*) from jsonb_array_elements(draft_picks)x where x->>'memberId'=member_row.id and x->>'group'='QB') not between 1 and 2
      or (select count(*) from jsonb_array_elements(draft_picks)x where x->>'memberId'=member_row.id and x->>'group'='RB') not between 2 and 5
      or (select count(*) from jsonb_array_elements(draft_picks)x where x->>'memberId'=member_row.id and x->>'group'='WR') not between 2 and 7
      or (select count(*) from jsonb_array_elements(draft_picks)x where x->>'memberId'=member_row.id and x->>'group'='TE') not between 1 and 2
      or (select count(*) from jsonb_array_elements(draft_picks)x where x->>'memberId'=member_row.id and x->>'group'='K') not between 1 and 2
      or (select count(*) from jsonb_array_elements(draft_picks)x where x->>'memberId'=member_row.id and x->>'group'='DST') not between 1 and 2 then raise exception 'CPU offline results must retain realistic roster construction';end if;
  end loop;
  select jsonb_agg(to_jsonb(pick->>'memberId') order by (pick->>'pickNumber')::integer) into draft_order from public.ball_knower_leagues l cross join lateral jsonb_array_elements(coalesce(l.season_result->'draftOrder','[]'::jsonb)) pick where l.id=p_league_id;
  if draft_order is null or jsonb_array_length(draft_order)<>member_count then raise exception 'Locked draft order is incomplete';end if;
  insert into public.ball_knower_live_drafts(league_id,status,order_member_ids,rounds,pick_index,picks,completed_at) values(p_league_id,'completed',draft_order,roster_size,pick_count,draft_picks,clock_timestamp()) on conflict(league_id) do update set status='completed',order_member_ids=excluded.order_member_ids,rounds=roster_size,pick_index=excluded.pick_index,picks=excluded.picks,completed_at=excluded.completed_at,updated_at=clock_timestamp();
  perform public.finalize_ball_knower_live_draft_rosters(p_league_id,null);return true;
end;$function$;
revoke all on function public.commissioner_import_ball_knower_offline_draft(text,jsonb) from public,anon;grant execute on function public.commissioner_import_ball_knower_offline_draft(text,jsonb) to authenticated;

comment on table public.ball_knower_dm_threads is 'Permanent-account private manager DM threads; native push delivery remains a mobile-shell integration.';
