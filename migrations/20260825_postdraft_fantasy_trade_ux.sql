-- Post-draft standard-fantasy trades: flexible packages, owner-controlled cuts,
-- and immediate CPU decisions. This intentionally applies only after the
-- dedicated live fantasy draft is complete; the Draft Order Game keeps its
-- separate roster/cap rules.

alter table public.ball_knower_trades
  add column if not exists proposer_drop_player_ids text[] not null default '{}'::text[],
  add column if not exists recipient_drop_player_ids text[] not null default '{}'::text[];

-- Commissioner review needs one intermediate state. Replace only the status
-- check on this table so installations that predate trade review remain valid.
do $$
declare constraint_name text;
begin
  select c.conname into constraint_name
  from pg_constraint c
  where c.conrelid='public.ball_knower_trades'::regclass
    and c.contype='c'
    and pg_get_constraintdef(c.oid) ilike '%status%'
  limit 1;
  if constraint_name is not null then
    execute format('alter table public.ball_knower_trades drop constraint %I',constraint_name);
  end if;
end $$;

alter table public.ball_knower_trades
  add constraint ball_knower_trades_status_check
  check (status in ('pending','accepted','accepted_pending_review','rejected','countered','cancelled','vetoed'));

create or replace function public.ball_knower_standard_fantasy_value(p_player jsonb)
returns numeric
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_projection numeric;
  v_ovr numeric:=coalesce(nullif(p_player->>'ovr','')::numeric,65);
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
  return v_ovr * case v_position
    when 'QB' then 2.30 when 'RB' then 2.65 when 'WR' then 2.55
    when 'TE' then 1.95 when 'K' then 1.15 when 'DST' then 1.20 else 1.00 end;
end;
$$;

revoke all on function public.ball_knower_standard_fantasy_value(jsonb) from public,anon,authenticated;
grant execute on function public.ball_knower_standard_fantasy_value(jsonb) to service_role;

create or replace function public.propose_ball_knower_trade_v2(
  p_league_id text,
  p_recipient_member_id text,
  p_offered_player_ids text[],
  p_requested_player_ids text[],
  p_proposer_drop_player_ids text[] default '{}'::text[],
  p_note text default null
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_auth uuid:=auth.uid();
  v_proposer public.ball_knower_league_members%rowtype;
  v_recipient public.ball_knower_league_members%rowtype;
  v_id uuid;
  v_player text;
  v_required_drops integer;
  v_current_count integer;
begin
  if v_auth is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.ball_knower_live_drafts where league_id=p_league_id and status='completed') then
    raise exception 'Standard fantasy trades unlock after the live draft is complete';
  end if;

  select * into v_proposer
  from public.ball_knower_league_members
  where league_id=p_league_id and auth_user_id=v_auth
  limit 1;
  if not found then raise exception 'League membership not found'; end if;

  select * into v_recipient
  from public.ball_knower_league_members
  where league_id=p_league_id and id=p_recipient_member_id;
  if not found or v_recipient.id=v_proposer.id then raise exception 'Choose another team in this league'; end if;

  if coalesce(array_length(p_offered_player_ids,1),0) not between 1 and 3
    or coalesce(array_length(p_requested_player_ids,1),0) not between 1 and 3 then
    raise exception 'Choose one to three players from each team';
  end if;
  if (select count(distinct id) from unnest(p_offered_player_ids) id)<>array_length(p_offered_player_ids,1)
    or (select count(distinct id) from unnest(p_requested_player_ids) id)<>array_length(p_requested_player_ids,1)
    or (select count(distinct id) from unnest(p_proposer_drop_player_ids) id)<>coalesce(array_length(p_proposer_drop_player_ids,1),0) then
    raise exception 'A player can only appear once in a trade';
  end if;
  if p_offered_player_ids&&p_proposer_drop_player_ids then
    raise exception 'A traded player cannot also be a roster cut';
  end if;

  v_current_count:=jsonb_array_length(coalesce(v_proposer.roster,'[]'::jsonb));
  v_required_drops:=greatest(0,v_current_count-array_length(p_offered_player_ids,1)+array_length(p_requested_player_ids,1)-20);
  if coalesce(array_length(p_proposer_drop_player_ids,1),0)<>v_required_drops then
    raise exception 'Choose % roster cut(s) to keep your team at 20 players',v_required_drops;
  end if;

  foreach v_player in array p_offered_player_ids loop
    if not exists(select 1 from jsonb_array_elements(coalesce(v_proposer.roster,'[]'::jsonb)) p where p->>'id'=v_player) then
      raise exception 'An offered player is no longer on your roster';
    end if;
  end loop;
  foreach v_player in array p_requested_player_ids loop
    if not exists(select 1 from jsonb_array_elements(coalesce(v_recipient.roster,'[]'::jsonb)) p where p->>'id'=v_player) then
      raise exception 'A requested player is no longer on that roster';
    end if;
  end loop;
  foreach v_player in array p_proposer_drop_player_ids loop
    if not exists(select 1 from jsonb_array_elements(coalesce(v_proposer.roster,'[]'::jsonb)) p where p->>'id'=v_player) then
      raise exception 'A selected roster cut is no longer on your roster';
    end if;
  end loop;

  insert into public.ball_knower_trades(
    league_id,proposer_member_id,recipient_member_id,offered_player_ids,requested_player_ids,
    proposer_drop_player_ids,recipient_drop_player_ids,note
  ) values(
    p_league_id,v_proposer.id,v_recipient.id,p_offered_player_ids,p_requested_player_ids,
    p_proposer_drop_player_ids,'{}'::text[],nullif(left(trim(coalesce(p_note,'')),500),'')
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.propose_ball_knower_trade_v2(text,text,text[],text[],text[],text) from public,anon;
grant execute on function public.propose_ball_knower_trade_v2(text,text,text[],text[],text[],text) to authenticated,service_role;

create or replace function public.counter_ball_knower_trade_v2(
  p_trade_id uuid,
  p_offered_player_ids text[],
  p_requested_player_ids text[],
  p_proposer_drop_player_ids text[] default '{}'::text[],
  p_note text default null
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_auth uuid:=auth.uid();
  v_trade public.ball_knower_trades%rowtype;
  v_proposer public.ball_knower_league_members%rowtype;
  v_recipient public.ball_knower_league_members%rowtype;
  v_new_id uuid;
  v_player text;
  v_required_drops integer;
  v_current_count integer;
begin
  if v_auth is null then raise exception 'Authentication required'; end if;
  select * into v_trade from public.ball_knower_trades where id=p_trade_id for update;
  if not found or v_trade.status<>'pending' then raise exception 'Trade is no longer pending'; end if;
  if not exists(select 1 from public.ball_knower_live_drafts where league_id=v_trade.league_id and status='completed') then
    raise exception 'Standard fantasy trades unlock after the live draft is complete';
  end if;

  select * into v_proposer from public.ball_knower_league_members
  where league_id=v_trade.league_id and id=v_trade.recipient_member_id;
  if not found or v_proposer.auth_user_id is distinct from v_auth then
    raise exception 'Only the receiving owner can counter this trade';
  end if;
  select * into v_recipient from public.ball_knower_league_members
  where league_id=v_trade.league_id and id=v_trade.proposer_member_id;
  if not found then raise exception 'The original proposing team is no longer in this league'; end if;

  if coalesce(array_length(p_offered_player_ids,1),0) not between 1 and 3
    or coalesce(array_length(p_requested_player_ids,1),0) not between 1 and 3 then
    raise exception 'Choose one to three players from each team';
  end if;
  if (select count(distinct id) from unnest(p_offered_player_ids) id)<>array_length(p_offered_player_ids,1)
    or (select count(distinct id) from unnest(p_requested_player_ids) id)<>array_length(p_requested_player_ids,1)
    or (select count(distinct id) from unnest(p_proposer_drop_player_ids) id)<>coalesce(array_length(p_proposer_drop_player_ids,1),0) then
    raise exception 'A player can only appear once in a trade';
  end if;
  if p_offered_player_ids&&p_proposer_drop_player_ids then raise exception 'A traded player cannot also be a roster cut'; end if;

  v_current_count:=jsonb_array_length(coalesce(v_proposer.roster,'[]'::jsonb));
  v_required_drops:=greatest(0,v_current_count-array_length(p_offered_player_ids,1)+array_length(p_requested_player_ids,1)-20);
  if coalesce(array_length(p_proposer_drop_player_ids,1),0)<>v_required_drops then
    raise exception 'Choose % roster cut(s) to keep your team at 20 players',v_required_drops;
  end if;

  foreach v_player in array p_offered_player_ids loop
    if not exists(select 1 from jsonb_array_elements(coalesce(v_proposer.roster,'[]'::jsonb)) p where p->>'id'=v_player) then raise exception 'An offered player is no longer on your roster'; end if;
  end loop;
  foreach v_player in array p_requested_player_ids loop
    if not exists(select 1 from jsonb_array_elements(coalesce(v_recipient.roster,'[]'::jsonb)) p where p->>'id'=v_player) then raise exception 'A requested player is no longer on that roster'; end if;
  end loop;
  foreach v_player in array p_proposer_drop_player_ids loop
    if not exists(select 1 from jsonb_array_elements(coalesce(v_proposer.roster,'[]'::jsonb)) p where p->>'id'=v_player) then raise exception 'A selected roster cut is no longer on your roster'; end if;
  end loop;

  update public.ball_knower_trades set status='countered',resolved_at=now() where id=v_trade.id;
  insert into public.ball_knower_trades(
    league_id,proposer_member_id,recipient_member_id,offered_player_ids,requested_player_ids,
    proposer_drop_player_ids,recipient_drop_player_ids,note,parent_trade_id
  ) values(
    v_trade.league_id,v_proposer.id,v_recipient.id,p_offered_player_ids,p_requested_player_ids,
    p_proposer_drop_player_ids,'{}'::text[],nullif(left(trim(coalesce(p_note,'')),500),''),v_trade.id
  ) returning id into v_new_id;
  return v_new_id;
end;
$$;

revoke all on function public.counter_ball_knower_trade_v2(uuid,text[],text[],text[],text) from public,anon;
grant execute on function public.counter_ball_knower_trade_v2(uuid,text[],text[],text[],text) to authenticated,service_role;

create or replace function public.resolve_ball_knower_trade_v2(
  p_trade_id uuid,
  p_action text,
  p_recipient_drop_player_ids text[] default '{}'::text[]
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  t public.ball_knower_trades%rowtype;
  p public.ball_knower_league_members%rowtype;
  r public.ball_knower_league_members%rowtype;
  p_new jsonb;
  r_new jsonb;
  actor uuid:=auth.uid();
  v_review text;
  v_execute boolean:=false;
  v_required_recipient_drops integer;
  v_drop_ids text[]:='{}'::text[];
  v_player text;
  v_incoming_value numeric:=0;
  v_outgoing_value numeric:=0;
  v_threshold numeric:=1.00;
  v_cpu_reason text;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into t from public.ball_knower_trades where id=p_trade_id for update;
  if not found then raise exception 'Trade not found'; end if;
  if not exists(select 1 from public.ball_knower_live_drafts where league_id=t.league_id and status='completed') then
    raise exception 'Standard fantasy trades unlock after the live draft is complete';
  end if;
  if p_action not in ('accepted','rejected','cancelled','vetoed','approved') then raise exception 'Invalid trade action'; end if;

  select * into p from public.ball_knower_league_members where league_id=t.league_id and id=t.proposer_member_id for update;
  select * into r from public.ball_knower_league_members where league_id=t.league_id and id=t.recipient_member_id for update;
  if p.id is null or r.id is null then raise exception 'A trade team is no longer in this league'; end if;
  select coalesce(settings->>'tradeReview','none') into v_review from public.ball_knower_leagues where id=t.league_id;

  if p_action='accepted' then
    if t.status<>'pending' then raise exception 'Trade is no longer pending'; end if;

    if coalesce(r.is_ai,false) then
      if p.auth_user_id is distinct from actor then raise exception 'Only the proposing owner can request a CPU decision'; end if;
      select coalesce(sum(public.ball_knower_standard_fantasy_value(player)),0) into v_incoming_value
      from jsonb_array_elements(coalesce(p.roster,'[]'::jsonb)) player
      where (player->>'id')=any(t.offered_player_ids);
      select coalesce(sum(public.ball_knower_standard_fantasy_value(player)),0) into v_outgoing_value
      from jsonb_array_elements(coalesce(r.roster,'[]'::jsonb)) player
      where (player->>'id')=any(t.requested_player_ids);
      v_incoming_value:=v_incoming_value*(1-greatest(0,array_length(t.offered_player_ids,1)-1)*0.06);
      v_threshold:=case coalesce(r.ai_archetype,'balanced')
        when 'aggressive' then 0.95 when 'stars_scrubs' then 0.96
        when 'conservative' then 1.06 when 'trench' then 1.03 else 1.00 end;
      if v_incoming_value < v_outgoing_value*v_threshold then
        v_cpu_reason:='CPU declined: the requested fantasy value is higher than the package coming back.';
        update public.ball_knower_trades set status='rejected',resolved_at=now() where id=t.id;
        insert into public.ball_knower_transactions(league_id,member_id,transaction_type,summary,metadata)
        values(t.league_id,r.id,'trade',r.user_name||' declined a trade offer.',jsonb_build_object('tradeId',t.id,'cpu',true));
        return jsonb_build_object('status','rejected','reason',v_cpu_reason);
      end if;

      v_required_recipient_drops:=greatest(0,jsonb_array_length(coalesce(r.roster,'[]'::jsonb))-array_length(t.requested_player_ids,1)+array_length(t.offered_player_ids,1)-20);
      if v_required_recipient_drops>0 then
        select coalesce(array_agg(id),'{}'::text[]) into v_drop_ids
        from (
          select player->>'id' id
          from jsonb_array_elements(coalesce(r.roster,'[]'::jsonb)) player
          where not ((player->>'id')=any(t.requested_player_ids))
          order by public.ball_knower_standard_fantasy_value(player) asc
          limit v_required_recipient_drops
        ) cuts;
      end if;
      update public.ball_knower_trades set recipient_drop_player_ids=v_drop_ids where id=t.id;
      t.recipient_drop_player_ids:=v_drop_ids;
      v_execute:=true;
    else
      if r.auth_user_id is distinct from actor then raise exception 'Only the receiving owner can accept this trade'; end if;
      v_required_recipient_drops:=greatest(0,jsonb_array_length(coalesce(r.roster,'[]'::jsonb))-array_length(t.requested_player_ids,1)+array_length(t.offered_player_ids,1)-20);
      if coalesce(array_length(p_recipient_drop_player_ids,1),0)<>v_required_recipient_drops then
        raise exception 'Choose % roster cut(s) before accepting this trade',v_required_recipient_drops;
      end if;
      if p_recipient_drop_player_ids&&t.requested_player_ids then raise exception 'A traded player cannot also be a roster cut'; end if;
      foreach v_player in array p_recipient_drop_player_ids loop
        if not exists(select 1 from jsonb_array_elements(coalesce(r.roster,'[]'::jsonb)) player where player->>'id'=v_player) then
          raise exception 'A selected roster cut is no longer on your roster';
        end if;
      end loop;
      update public.ball_knower_trades set recipient_drop_player_ids=p_recipient_drop_player_ids where id=t.id;
      t.recipient_drop_player_ids:=p_recipient_drop_player_ids;
      if v_review='commissioner' and not public.is_ball_knower_commissioner(t.league_id) then
        update public.ball_knower_trades set status='accepted_pending_review',resolved_at=null where id=t.id;
        insert into public.ball_knower_transactions(league_id,member_id,transaction_type,summary,metadata)
        values(t.league_id,r.id,'trade_review','Trade accepted by '||r.user_name||' and sent to commissioner review.',jsonb_build_object('tradeId',t.id));
        return jsonb_build_object('status','accepted_pending_review','reason','Waiting for commissioner review.');
      end if;
      v_execute:=true;
    end if;
  elsif p_action='approved' then
    if t.status<>'accepted_pending_review' then raise exception 'Trade is not awaiting review'; end if;
    if not public.is_ball_knower_commissioner(t.league_id) then raise exception 'Commissioner authorization required'; end if;
    v_execute:=true;
  elsif p_action='rejected' then
    if t.status<>'pending' then raise exception 'Trade is no longer pending'; end if;
    if r.auth_user_id is distinct from actor then raise exception 'Only the receiving owner can reject this trade'; end if;
    update public.ball_knower_trades set status='rejected',resolved_at=now() where id=t.id;
    return jsonb_build_object('status','rejected');
  elsif p_action='cancelled' then
    if t.status<>'pending' then raise exception 'Trade is no longer pending'; end if;
    if p.auth_user_id is distinct from actor then raise exception 'Only the proposing owner can cancel this trade'; end if;
    update public.ball_knower_trades set status='cancelled',resolved_at=now() where id=t.id;
    return jsonb_build_object('status','cancelled');
  elsif p_action='vetoed' then
    if t.status not in ('pending','accepted_pending_review') then raise exception 'Trade cannot be vetoed now'; end if;
    if not public.is_ball_knower_commissioner(t.league_id) then raise exception 'Commissioner authorization required'; end if;
    update public.ball_knower_trades set status='vetoed',resolved_at=now() where id=t.id;
    return jsonb_build_object('status','vetoed');
  end if;

  if v_execute then
    if exists(
      select 1 from unnest(t.offered_player_ids||t.proposer_drop_player_ids) id
      where not exists(select 1 from jsonb_array_elements(coalesce(p.roster,'[]'::jsonb)) player where player->>'id'=id)
    ) then raise exception 'The proposing roster changed; send a new offer'; end if;
    if exists(
      select 1 from unnest(t.requested_player_ids||t.recipient_drop_player_ids) id
      where not exists(select 1 from jsonb_array_elements(coalesce(r.roster,'[]'::jsonb)) player where player->>'id'=id)
    ) then raise exception 'The receiving roster changed; send a new offer'; end if;

    select coalesce(jsonb_agg(player),'[]'::jsonb) into p_new from (
      select player from jsonb_array_elements(coalesce(p.roster,'[]'::jsonb)) player
      where not ((player->>'id')=any(t.offered_player_ids||t.proposer_drop_player_ids))
      union all
      select player from jsonb_array_elements(coalesce(r.roster,'[]'::jsonb)) player
      where (player->>'id')=any(t.requested_player_ids)
    ) next_roster;
    select coalesce(jsonb_agg(player),'[]'::jsonb) into r_new from (
      select player from jsonb_array_elements(coalesce(r.roster,'[]'::jsonb)) player
      where not ((player->>'id')=any(t.requested_player_ids||t.recipient_drop_player_ids))
      union all
      select player from jsonb_array_elements(coalesce(p.roster,'[]'::jsonb)) player
      where (player->>'id')=any(t.offered_player_ids)
    ) next_roster;

    if jsonb_array_length(p_new)>20 or jsonb_array_length(r_new)>20 or jsonb_array_length(p_new)<1 or jsonb_array_length(r_new)<1 then
      raise exception 'Trade would create an invalid roster size';
    end if;

    perform set_config('ball_knower.authorized_roster_operation','trade',true);
    update public.ball_knower_league_members set roster=p_new,status=p.status,team_ratings=null where id=p.id;
    update public.ball_knower_league_members set roster=r_new,status=r.status,team_ratings=null where id=r.id;
    perform set_config('ball_knower.authorized_roster_operation','',true);
    update public.ball_knower_trades set status='accepted',resolved_at=now() where id=t.id;
    insert into public.ball_knower_transactions(league_id,member_id,transaction_type,summary,metadata)
    values(t.league_id,p.id,'trade','Trade completed between '||p.user_name||' and '||r.user_name,jsonb_build_object('tradeId',t.id,'cpu',coalesce(r.is_ai,false),'reviewed',p_action='approved'));
    return jsonb_build_object('status','accepted','reason',case when coalesce(r.is_ai,false) then 'CPU accepted the package.' else 'Trade completed.' end);
  end if;

  return jsonb_build_object('status',t.status);
end;
$$;

revoke all on function public.resolve_ball_knower_trade_v2(uuid,text,text[]) from public,anon;
grant execute on function public.resolve_ball_knower_trade_v2(uuid,text,text[]) to authenticated,service_role;