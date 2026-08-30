-- Phase 1 correctness: standard-fantasy roster capacity, IR, acquisition
-- limits, started-player protection, trade deadlines, and conditional waivers.
-- Append-only: do not alter any migration that has already run.

create or replace function public.ball_knower_started_starter(p_league_id text,p_member_id text,p_player_id text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1
    from public.ball_knower_leagues l
    join public.ball_knower_league_members m on m.league_id=l.id and m.id=p_member_id
    join public.ball_knower_weekly_lineups w on w.league_id=l.id and w.member_id=m.id
      and w.week_number=coalesce(nullif(l.settings->>'currentWeek','')::integer,1)
    join lateral jsonb_array_elements(coalesce(m.roster,'[]'::jsonb)) player on player->>'id'=p_player_id
    join public.ball_knower_nfl_games g on g.season=coalesce(nullif(l.settings->>'nflSeason','')::integer,extract(year from now())::integer)
      and g.week_number=w.week_number and (g.home_team=player->>'team' or g.away_team=player->>'team')
    where l.id=p_league_id and p_player_id in(select value from jsonb_each_text(w.starters)) and g.kickoff_at<=now()
  );
$$;
revoke all on function public.ball_knower_started_starter(text,text,text) from public,anon,authenticated;
grant execute on function public.ball_knower_started_starter(text,text,text) to service_role;

create or replace function public.set_my_ball_knower_ir(p_league_id text,p_player_id text,p_on_ir boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_auth uuid:=auth.uid();v_member public.ball_knower_league_members%rowtype;v_ids jsonb;v_limit integer;v_roster_limit integer;v_active integer;v_player_name text;
begin
  if v_auth is null then raise exception 'Authentication required';end if;
  select * into v_member from public.ball_knower_league_members where league_id=p_league_id and auth_user_id=v_auth limit 1 for update;
  if not found then raise exception 'League membership not found';end if;
  if not exists(select 1 from jsonb_array_elements(coalesce(v_member.roster,'[]'::jsonb))e where e->>'id'=p_player_id) then raise exception 'Player is not on your roster';end if;
  select e->>'name' into v_player_name from jsonb_array_elements(coalesce(v_member.roster,'[]'::jsonb))e where e->>'id'=p_player_id limit 1;
  select coalesce(nullif(settings->>'irSlots','')::integer,2) into v_limit from public.ball_knower_leagues where id=p_league_id;
  v_roster_limit:=public.ball_knower_fantasy_roster_size(p_league_id);
  select coalesce(jsonb_agg(id.value),'[]'::jsonb) into v_ids from jsonb_array_elements_text(coalesce(v_member.ir_player_ids,'[]'::jsonb))id(value)
    where exists(select 1 from jsonb_array_elements(coalesce(v_member.roster,'[]'::jsonb))player where player->>'id'=id.value);
  if p_on_ir then
    if not exists(select 1 from public.ball_knower_injuries i where i.league_id=p_league_id and i.member_id=v_member.id and i.player_id=p_player_id and i.status in('out','ir','doubtful')) then raise exception 'Only injured players can be placed on IR';end if;
    if not exists(select 1 from jsonb_array_elements_text(v_ids)x where x=p_player_id) then
      if jsonb_array_length(v_ids)>=v_limit then raise exception 'All IR slots are full';end if;
      v_ids:=v_ids||to_jsonb(p_player_id);
    end if;
  else
    select jsonb_array_length(coalesce(v_member.roster,'[]'::jsonb))-jsonb_array_length(v_ids) into v_active;
    if exists(select 1 from jsonb_array_elements_text(v_ids)x where x=p_player_id) and v_active>=v_roster_limit then raise exception 'Active roster is full; make room before activating this player';end if;
    select coalesce(jsonb_agg(x),'[]'::jsonb) into v_ids from jsonb_array_elements_text(v_ids)x where x<>p_player_id;
  end if;
  update public.ball_knower_league_members set ir_player_ids=v_ids where id=v_member.id;
  insert into public.ball_knower_transactions(league_id,member_id,transaction_type,summary,metadata) values(p_league_id,v_member.id,'ir',v_member.user_name||(case when p_on_ir then ' placed ' else ' activated ' end)||coalesce(v_player_name,p_player_id)||(case when p_on_ir then ' on IR.' else ' from IR.' end),jsonb_build_object('playerId',p_player_id,'onIr',p_on_ir));
  return jsonb_build_object('onIr',p_on_ir,'playerId',p_player_id,'ir',v_ids);
end;$$;
revoke all on function public.set_my_ball_knower_ir(text,text,boolean) from public,anon;
grant execute on function public.set_my_ball_knower_ir(text,text,boolean) to authenticated;

create or replace function public.apply_ball_knower_player_move(p_league_id text,p_member_id text,p_player_snapshot jsonb,p_drop_player_id text,p_faab_bid numeric,p_kind text,p_claim_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_member public.ball_knower_league_members%rowtype;v_settings jsonb;v_roster jsonb;v_new_roster jsonb;v_drop jsonb;v_player_id text;v_player_name text;v_limit integer;v_days integer;v_ir jsonb;v_active integer;v_week integer;v_season integer;v_week_limit integer;v_season_limit integer;v_week_count integer;v_season_count integer;
begin
  perform set_config('ball_knower.authorized_roster_operation','waiver',true);
  v_player_id:=p_player_snapshot->>'id';v_player_name:=coalesce(p_player_snapshot->>'name',v_player_id);
  if v_player_id is null or v_player_id='' then raise exception 'Player data is missing';end if;
  select l.settings into v_settings from public.ball_knower_leagues l where l.id=p_league_id for update;
  if not found then raise exception 'League not found';end if;
  perform 1 from public.ball_knower_league_members where league_id=p_league_id order by id for update;
  if exists(select 1 from public.ball_knower_league_members m,jsonb_array_elements(coalesce(m.roster,'[]'::jsonb))e where m.league_id=p_league_id and e->>'id'=v_player_id) then raise exception 'Player is no longer available';end if;
  select * into v_member from public.ball_knower_league_members where league_id=p_league_id and id=p_member_id;
  if not found then raise exception 'League member not found';end if;
  if p_faab_bid<0 or p_faab_bid>v_member.faab_balance then raise exception 'FAAB bid exceeds remaining budget';end if;
  v_roster:=coalesce(v_member.roster,'[]'::jsonb);v_limit:=public.ball_knower_fantasy_roster_size(p_league_id);
  select coalesce(jsonb_agg(id.value),'[]'::jsonb) into v_ir from jsonb_array_elements_text(coalesce(v_member.ir_player_ids,'[]'::jsonb))id(value) where exists(select 1 from jsonb_array_elements(v_roster)p where p->>'id'=id.value);
  if p_drop_player_id is not null then
    select e into v_drop from jsonb_array_elements(v_roster)e where e->>'id'=p_drop_player_id limit 1;
    if v_drop is null then raise exception 'Drop player is no longer on this roster';end if;
    if public.ball_knower_started_starter(p_league_id,v_member.id,p_drop_player_id) then raise exception 'A started player locked in this week''s lineup cannot be dropped';end if;
  else
    v_active:=jsonb_array_length(v_roster)-jsonb_array_length(v_ir);
    if v_active>=v_limit then raise exception 'Choose a player to drop from the full active roster';end if;
  end if;
  v_week:=coalesce(nullif(v_settings->>'currentWeek','')::integer,1);v_season:=coalesce(nullif(v_settings->>'nflSeason','')::integer,extract(year from now())::integer);
  v_week_limit:=coalesce(nullif(v_settings->>'maxAcquisitionsPerWeek','')::integer,0);v_season_limit:=coalesce(nullif(v_settings->>'maxAcquisitionsPerSeason','')::integer,0);
  select count(*) filter(where coalesce((metadata->>'acquisitionWeek')::integer,-1)=v_week),count(*) into v_week_count,v_season_count from public.ball_knower_transactions where league_id=p_league_id and member_id=v_member.id and transaction_type in('free_agent','waiver') and coalesce((metadata->>'acquisitionSeason')::integer,-1)=v_season;
  if v_week_limit>0 and v_week_count>=v_week_limit then raise exception 'Weekly acquisition limit reached';end if;
  if v_season_limit>0 and v_season_count>=v_season_limit then raise exception 'Season acquisition limit reached';end if;
  select coalesce(jsonb_agg(e),'[]'::jsonb) into v_new_roster from jsonb_array_elements(v_roster)e where p_drop_player_id is null or e->>'id'<>p_drop_player_id;
  v_new_roster:=v_new_roster||jsonb_build_array(p_player_snapshot);
  select coalesce(jsonb_agg(id.value),'[]'::jsonb) into v_ir from jsonb_array_elements_text(v_ir)id(value) where id.value<>coalesce(p_drop_player_id,'');
  v_active:=jsonb_array_length(v_new_roster)-jsonb_array_length(v_ir);
  if v_active>v_limit then raise exception 'Move would exceed the active roster limit';end if;
  update public.ball_knower_league_members set roster=v_new_roster,ir_player_ids=v_ir,status='building',team_ratings=null,submitted_at=null,faab_balance=greatest(0,faab_balance-p_faab_bid) where id=v_member.id;
  delete from public.ball_knower_player_waivers where league_id=p_league_id and player_id=v_player_id;
  if v_drop is not null then
    v_days:=greatest(0,least(7,coalesce(nullif(v_settings->>'waiverDays','')::integer,2)));
    insert into public.ball_knower_player_waivers(league_id,player_id,player_snapshot,dropped_by_member_id,clears_at) values(p_league_id,p_drop_player_id,v_drop,v_member.id,now()+make_interval(days=>v_days)) on conflict(league_id,player_id) do update set player_snapshot=excluded.player_snapshot,dropped_by_member_id=excluded.dropped_by_member_id,clears_at=excluded.clears_at,created_at=now();
  end if;
  insert into public.ball_knower_transactions(league_id,member_id,transaction_type,summary,metadata) values(p_league_id,v_member.id,p_kind,v_member.user_name||' added '||v_player_name||case when v_drop is null then '.' else ' and dropped '||coalesce(v_drop->>'name',p_drop_player_id)||'.' end,jsonb_build_object('claimId',p_claim_id,'playerId',v_player_id,'dropPlayerId',p_drop_player_id,'faabBid',p_faab_bid,'kind',p_kind,'acquisitionWeek',v_week,'acquisitionSeason',v_season));
  return jsonb_build_object('playerId',v_player_id,'dropPlayerId',p_drop_player_id,'memberId',v_member.id);
end;$$;
revoke all on function public.apply_ball_knower_player_move(text,text,jsonb,text,numeric,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.apply_ball_knower_player_move(text,text,jsonb,text,numeric,text,uuid) to service_role;

create or replace function public.process_due_ball_knower_waivers(p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_league record;c record;v_type text;v_won integer:=0;v_lost integer:=0;v_old_priority integer;v_run uuid:=gen_random_uuid();
begin
  for v_league in select distinct wc.league_id,l.settings from public.ball_knower_waiver_claims wc join public.ball_knower_leagues l on l.id=wc.league_id where wc.status='pending' and wc.process_at<=p_now order by wc.league_id loop
    perform pg_advisory_xact_lock(hashtext('bk-waivers-'||v_league.league_id));v_type:=coalesce(v_league.settings->>'waiverType','priority');
    loop
      select wc.*,m.waiver_priority into c from public.ball_knower_waiver_claims wc join public.ball_knower_league_members m on m.id=wc.member_id
      where wc.league_id=v_league.league_id and wc.status='pending' and wc.process_at<=p_now
        and not exists(select 1 from public.ball_knower_waiver_claims earlier where earlier.claim_group_id=wc.claim_group_id and earlier.status='pending' and earlier.claim_order<wc.claim_order)
      order by case when v_type='faab' then wc.faab_bid end desc,m.waiver_priority,wc.created_at,wc.id limit 1;
      exit when not found;
      if exists(select 1 from public.ball_knower_waiver_claims x where x.claim_group_id=c.claim_group_id and x.status='won') then update public.ball_knower_waiver_claims set status='cancelled',processed_at=p_now,failure_reason='Earlier conditional claim won' where id=c.id;continue;end if;
      begin perform public.apply_ball_knower_player_move(c.league_id,c.member_id,c.player_snapshot,c.drop_player_id,case when v_type='faab' then c.faab_bid else 0 end,'waiver',c.id);
      exception when others then update public.ball_knower_waiver_claims set status='lost',processed_at=p_now,failure_reason=left(sqlerrm,240) where id=c.id;v_lost:=v_lost+1;continue;end;
      update public.ball_knower_waiver_claims set status='won',processed_at=p_now,failure_reason=null where id=c.id;
      update public.ball_knower_waiver_claims set status='lost',processed_at=p_now,failure_reason='Another manager won this player' where league_id=c.league_id and player_id=c.player_id and status='pending' and id<>c.id;
      update public.ball_knower_waiver_claims set status='cancelled',processed_at=p_now,failure_reason='Earlier conditional claim won' where claim_group_id=c.claim_group_id and status='pending' and id<>c.id;
      if v_type<>'faab' then v_old_priority:=c.waiver_priority;update public.ball_knower_league_members set waiver_priority=waiver_priority-1 where league_id=c.league_id and waiver_priority>v_old_priority;update public.ball_knower_league_members set waiver_priority=(select count(*) from public.ball_knower_league_members where league_id=c.league_id) where id=c.member_id;end if;
      v_won:=v_won+1;
    end loop;
  end loop;
  select count(*) into v_lost from public.ball_knower_waiver_claims where processed_at=p_now and status='lost';
  if v_won>0 or v_lost>0 then insert into public.ball_knower_waiver_runs(id,processed_at,won_count,lost_count,metadata) values(v_run,p_now,v_won,v_lost,jsonb_build_object('source','automatic'));else v_run:=null;end if;
  return jsonb_build_object('runId',v_run,'processedAt',p_now,'won',v_won,'lost',v_lost);
end;$$;
revoke all on function public.process_due_ball_knower_waivers(timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.process_due_ball_knower_waivers(timestamptz) to service_role;

alter function public.propose_ball_knower_trade_v2(text,text,text[],text[],text[],text) rename to propose_ball_knower_trade_v2_phase1_base;
revoke all on function public.propose_ball_knower_trade_v2_phase1_base(text,text,text[],text[],text[],text) from public,anon,authenticated;
grant execute on function public.propose_ball_knower_trade_v2_phase1_base(text,text,text[],text[],text[],text) to service_role;
do $$
declare v_sql text;v_next text;
begin
  select pg_get_functiondef('public.propose_ball_knower_trade_v2_phase1_base(text,text,text[],text[],text[],text)'::regprocedure) into v_sql;
  v_next:=replace(v_sql,
    'v_current_count:=jsonb_array_length(coalesce(v_proposer.roster,''[]''::jsonb));',
    'select count(*) into v_current_count from jsonb_array_elements(coalesce(v_proposer.roster,''[]''::jsonb)) player where not exists(select 1 from jsonb_array_elements_text(coalesce(v_proposer.ir_player_ids,''[]''::jsonb)) ir(value) where ir.value=player->>''id'');');
  v_next:=replace(v_next,
    'v_current_count-array_length(p_offered_player_ids,1)+array_length(p_requested_player_ids,1)',
    'v_current_count-(select count(*) from unnest(p_offered_player_ids) offered_id where not exists(select 1 from jsonb_array_elements_text(coalesce(v_proposer.ir_player_ids,''[]''::jsonb)) ir(value) where ir.value=offered_id))+array_length(p_requested_player_ids,1)');
  if v_next=v_sql or position('offered_id' in v_next)=0 then raise exception 'Phase 1 proposer active-roster patch did not match';end if;
  execute v_next;

  select pg_get_functiondef('public.counter_ball_knower_trade_v2(uuid,text[],text[],text[],text)'::regprocedure) into v_sql;
  v_next:=replace(v_sql,
    'v_current_count:=jsonb_array_length(coalesce(v_proposer.roster,''[]''::jsonb));',
    'select count(*) into v_current_count from jsonb_array_elements(coalesce(v_proposer.roster,''[]''::jsonb)) player where not exists(select 1 from jsonb_array_elements_text(coalesce(v_proposer.ir_player_ids,''[]''::jsonb)) ir(value) where ir.value=player->>''id'');');
  v_next:=replace(v_next,
    'v_current_count-array_length(p_offered_player_ids,1)+array_length(p_requested_player_ids,1)',
    'v_current_count-(select count(*) from unnest(p_offered_player_ids) offered_id where not exists(select 1 from jsonb_array_elements_text(coalesce(v_proposer.ir_player_ids,''[]''::jsonb)) ir(value) where ir.value=offered_id))+array_length(p_requested_player_ids,1)');
  if v_next=v_sql or position('offered_id' in v_next)=0 then raise exception 'Phase 1 counteroffer active-roster patch did not match';end if;
  execute v_next;
end $$;
create function public.propose_ball_knower_trade_v2(p_league_id text,p_recipient_member_id text,p_offered_player_ids text[],p_requested_player_ids text[],p_proposer_drop_player_ids text[] default '{}'::text[],p_note text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare s jsonb;w integer;d integer;
begin
  select settings into s from public.ball_knower_leagues where id=p_league_id;w:=coalesce(nullif(s->>'currentWeek','')::integer,1);d:=coalesce(nullif(s->>'tradeDeadlineWeek','')::integer,99);
  if w>d then raise exception 'The fantasy trade deadline has passed';end if;
  return public.propose_ball_knower_trade_v2_phase1_base(p_league_id,p_recipient_member_id,p_offered_player_ids,p_requested_player_ids,p_proposer_drop_player_ids,p_note);
end;$$;
revoke all on function public.propose_ball_knower_trade_v2(text,text,text[],text[],text[],text) from public,anon;
grant execute on function public.propose_ball_knower_trade_v2(text,text,text[],text[],text[],text) to authenticated,service_role;

alter function public.resolve_ball_knower_trade_v2_impl(uuid,text,text[]) rename to resolve_ball_knower_trade_v2_phase1_base;
revoke all on function public.resolve_ball_knower_trade_v2_phase1_base(uuid,text,text[]) from public,anon,authenticated;
grant execute on function public.resolve_ball_knower_trade_v2_phase1_base(uuid,text,text[]) to service_role;
do $$
declare v_sql text;v_next text;raw_count text;active_count text;
begin
  select pg_get_functiondef('public.resolve_ball_knower_trade_v2_phase1_base(uuid,text,text[])'::regprocedure) into v_sql;
  raw_count:='jsonb_array_length(coalesce(r.roster,''[]''::jsonb))';
  active_count:='(select count(*) from jsonb_array_elements(coalesce(r.roster,''[]''::jsonb)) active_player where not exists(select 1 from jsonb_array_elements_text(coalesce(r.ir_player_ids,''[]''::jsonb)) ir(value) where ir.value=active_player->>''id''))';
  v_next:=replace(v_sql,raw_count,active_count);
  v_next:=replace(v_next,
    active_count||'-array_length(t.requested_player_ids,1)+array_length(t.offered_player_ids,1)',
    active_count||'-(select count(*) from unnest(t.requested_player_ids) requested_id where not exists(select 1 from jsonb_array_elements_text(coalesce(r.ir_player_ids,''[]''::jsonb)) ir(value) where ir.value=requested_id))+array_length(t.offered_player_ids,1)');
  v_next:=replace(v_next,
    'where not ((candidate.player->>''id'')=any(t.requested_player_ids))',
    'where not ((candidate.player->>''id'')=any(t.requested_player_ids)) and not exists(select 1 from jsonb_array_elements_text(coalesce(r.ir_player_ids,''[]''::jsonb)) ir(value) where ir.value=candidate.player->>''id'') and not public.ball_knower_started_starter(t.league_id,r.id,candidate.player->>''id'')');
  v_next:=replace(v_next,'if v_execute then',
    'if v_execute then if coalesce(array_length(t.proposer_drop_player_ids,1),0)<>greatest(0,(select count(*) from jsonb_array_elements(coalesce(p.roster,''[]''::jsonb)) active_player where not exists(select 1 from jsonb_array_elements_text(coalesce(p.ir_player_ids,''[]''::jsonb)) ir(value) where ir.value=active_player->>''id''))-(select count(*) from unnest(t.offered_player_ids) offered_id where not exists(select 1 from jsonb_array_elements_text(coalesce(p.ir_player_ids,''[]''::jsonb)) ir(value) where ir.value=offered_id))+array_length(t.requested_player_ids,1)-public.ball_knower_fantasy_roster_size(t.league_id)) then raise exception ''The proposing roster changed; send a new offer'';end if;if coalesce(array_length(t.recipient_drop_player_ids,1),0)<>greatest(0,(select count(*) from jsonb_array_elements(coalesce(r.roster,''[]''::jsonb)) active_player where not exists(select 1 from jsonb_array_elements_text(coalesce(r.ir_player_ids,''[]''::jsonb)) ir(value) where ir.value=active_player->>''id''))-(select count(*) from unnest(t.requested_player_ids) requested_id where not exists(select 1 from jsonb_array_elements_text(coalesce(r.ir_player_ids,''[]''::jsonb)) ir(value) where ir.value=requested_id))+array_length(t.offered_player_ids,1)-public.ball_knower_fantasy_roster_size(t.league_id)) then raise exception ''The receiving roster changed; accept the offer again'';end if;if exists(select 1 from unnest(t.proposer_drop_player_ids) cut_id where cut_id in(select value from jsonb_array_elements_text(coalesce(p.ir_player_ids,''[]''::jsonb)))) or exists(select 1 from unnest(t.recipient_drop_player_ids) cut_id where cut_id in(select value from jsonb_array_elements_text(coalesce(r.ir_player_ids,''[]''::jsonb)))) then raise exception ''An IR player cannot be used as an active roster cut'';end if;foreach v_player in array coalesce(t.proposer_drop_player_ids,''{}''::text[]) loop if public.ball_knower_started_starter(t.league_id,t.proposer_member_id,v_player) then raise exception ''A started player locked in this week''''s lineup cannot be dropped as a trade cut'';end if;end loop;foreach v_player in array coalesce(t.recipient_drop_player_ids,''{}''::text[]) loop if public.ball_knower_started_starter(t.league_id,t.recipient_member_id,v_player) then raise exception ''A started player locked in this week''''s lineup cannot be dropped as a trade cut'';end if;end loop;');
  v_next:=replace(v_next,
    'jsonb_array_length(p_new)>public.ball_knower_fantasy_roster_size(t.league_id)',
    '(select count(*) from jsonb_array_elements(p_new) active_player where not exists(select 1 from jsonb_array_elements_text(coalesce(p.ir_player_ids,''[]''::jsonb)) ir(value) where ir.value=active_player->>''id''))>public.ball_knower_fantasy_roster_size(t.league_id)');
  v_next:=replace(v_next,
    'jsonb_array_length(r_new)>public.ball_knower_fantasy_roster_size(t.league_id)',
    '(select count(*) from jsonb_array_elements(r_new) active_player where not exists(select 1 from jsonb_array_elements_text(coalesce(r.ir_player_ids,''[]''::jsonb)) ir(value) where ir.value=active_player->>''id''))>public.ball_knower_fantasy_roster_size(t.league_id)');
  if v_next=v_sql or position('requested_id' in v_next)=0 or position('candidate.player' in v_next)=0 or position('foreach v_player in array coalesce(t.recipient_drop_player_ids' in v_next)=0 then raise exception 'Phase 1 trade executor active-roster patch did not match';end if;
  execute v_next;
end $$;
create function public.resolve_ball_knower_trade_v2_impl(p_trade_id uuid,p_action text,p_recipient_drop_player_ids text[] default '{}'::text[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.ball_knower_trades%rowtype;s jsonb;w integer;d integer;player_id text;result jsonb;
begin
  select * into t from public.ball_knower_trades where id=p_trade_id for update;if not found then raise exception 'Trade not found';end if;
  select settings into s from public.ball_knower_leagues where id=t.league_id;w:=coalesce(nullif(s->>'currentWeek','')::integer,1);d:=coalesce(nullif(s->>'tradeDeadlineWeek','')::integer,99);
  if p_action in('accepted','approved') and w>d then raise exception 'The fantasy trade deadline has passed; pending trades cannot complete';end if;
  if p_action in('accepted','approved') then
    foreach player_id in array coalesce(t.offered_player_ids,'{}'::text[]) loop if public.ball_knower_started_starter(t.league_id,t.proposer_member_id,player_id) then raise exception 'A started player locked in this week''s lineup cannot be traded';end if;end loop;
    foreach player_id in array coalesce(t.requested_player_ids,'{}'::text[]) loop if public.ball_knower_started_starter(t.league_id,t.recipient_member_id,player_id) then raise exception 'A started player locked in this week''s lineup cannot be traded';end if;end loop;
    foreach player_id in array coalesce(t.proposer_drop_player_ids,'{}'::text[]) loop if public.ball_knower_started_starter(t.league_id,t.proposer_member_id,player_id) then raise exception 'A started player locked in this week''s lineup cannot be dropped as a trade cut';end if;end loop;
    foreach player_id in array coalesce(p_recipient_drop_player_ids,'{}'::text[]) loop if public.ball_knower_started_starter(t.league_id,t.recipient_member_id,player_id) then raise exception 'A started player locked in this week''s lineup cannot be dropped as a trade cut';end if;end loop;
  end if;
  result:=public.resolve_ball_knower_trade_v2_phase1_base(p_trade_id,p_action,p_recipient_drop_player_ids);
  update public.ball_knower_league_members m set ir_player_ids=(select coalesce(jsonb_agg(ir_id.value),'[]'::jsonb) from jsonb_array_elements_text(coalesce(m.ir_player_ids,'[]'::jsonb))ir_id(value) where exists(select 1 from jsonb_array_elements(coalesce(m.roster,'[]'::jsonb))p where p->>'id'=ir_id.value)) where m.id in(t.proposer_member_id,t.recipient_member_id);
  return result;
end;$$;
revoke all on function public.resolve_ball_knower_trade_v2_impl(uuid,text,text[]) from public,anon,authenticated;
grant execute on function public.resolve_ball_knower_trade_v2_impl(uuid,text,text[]) to service_role;
