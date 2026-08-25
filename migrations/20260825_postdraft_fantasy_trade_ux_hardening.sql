-- Follow-up hardening for the post-draft trade resolver.
-- - serializes mirrored trades by locking both member rows in stable id order
-- - applies commissioner review to CPU-accepted trades too
-- - prevents CPU trades from leaving the CPU without a legal weekly lineup

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
  v_cpu_lineup_valid boolean:=true;
begin
  if actor is null then raise exception 'Authentication required'; end if;

  select * into t
  from public.ball_knower_trades
  where id=p_trade_id
  for update;
  if not found then raise exception 'Trade not found'; end if;

  if not exists(
    select 1 from public.ball_knower_live_drafts
    where league_id=t.league_id and status='completed'
  ) then
    raise exception 'Standard fantasy trades unlock after the live draft is complete';
  end if;
  if p_action not in ('accepted','rejected','cancelled','vetoed','approved') then
    raise exception 'Invalid trade action';
  end if;

  -- Mirrored A↔B trades must acquire the same two member locks in the same
  -- order or Postgres can deadlock one of the owners.
  perform 1
  from public.ball_knower_league_members member
  where member.league_id=t.league_id
    and member.id in (t.proposer_member_id,t.recipient_member_id)
  order by member.id
  for update;

  select * into p
  from public.ball_knower_league_members
  where league_id=t.league_id and id=t.proposer_member_id;
  select * into r
  from public.ball_knower_league_members
  where league_id=t.league_id and id=t.recipient_member_id;
  if p.id is null or r.id is null then raise exception 'A trade team is no longer in this league'; end if;

  select coalesce(settings->>'tradeReview','none') into v_review
  from public.ball_knower_leagues
  where id=t.league_id;

  if p_action='accepted' then
    if t.status<>'pending' then raise exception 'Trade is no longer pending'; end if;

    if coalesce(r.is_ai,false) then
      if p.auth_user_id is distinct from actor then
        raise exception 'Only the proposing owner can request a CPU decision';
      end if;

      select coalesce(sum(public.ball_knower_standard_fantasy_value(player)),0)
      into v_incoming_value
      from jsonb_array_elements(coalesce(p.roster,'[]'::jsonb)) player
      where (player->>'id')=any(t.offered_player_ids);

      select coalesce(sum(public.ball_knower_standard_fantasy_value(player)),0)
      into v_outgoing_value
      from jsonb_array_elements(coalesce(r.roster,'[]'::jsonb)) player
      where (player->>'id')=any(t.requested_player_ids);

      -- Multi-player quantity has a small consolidation discount so three low
      -- values do not automatically buy one elite player at raw summed value.
      v_incoming_value:=v_incoming_value*(1-greatest(0,array_length(t.offered_player_ids,1)-1)*0.06);
      v_threshold:=case coalesce(r.ai_archetype,'balanced')
        when 'aggressive' then 0.95
        when 'stars_scrubs' then 0.96
        when 'conservative' then 1.06
        when 'trench' then 1.03
        else 1.00
      end;

      if v_incoming_value < v_outgoing_value*v_threshold then
        v_cpu_reason:='CPU declined: the requested fantasy value is higher than the package coming back.';
        update public.ball_knower_trades set status='rejected',resolved_at=now() where id=t.id;
        insert into public.ball_knower_transactions(league_id,member_id,transaction_type,summary,metadata)
        values(t.league_id,r.id,'trade',r.user_name||' declined a trade offer.',jsonb_build_object('tradeId',t.id,'cpu',true));
        return jsonb_build_object('status','rejected','reason',v_cpu_reason);
      end if;

      v_required_recipient_drops:=greatest(
        0,
        jsonb_array_length(coalesce(r.roster,'[]'::jsonb))
          - array_length(t.requested_player_ids,1)
          + array_length(t.offered_player_ids,1)
          - 20
      );

      if v_required_recipient_drops>0 then
        -- CPU cuts its lowest-value surplus player while protecting the minimum
        -- pieces needed to field QB/RB/RB/WR/WR/TE/FLEX/K/DST.
        select coalesce(array_agg(id),'{}'::text[]) into v_drop_ids
        from (
          select candidate.player->>'id' id
          from jsonb_array_elements(coalesce(r.roster,'[]'::jsonb)) candidate(player)
          where not ((candidate.player->>'id')=any(t.requested_player_ids))
            and case candidate.player->>'position'
              when 'QB' then
                (select count(*) from jsonb_array_elements(coalesce(r.roster,'[]'::jsonb)) x where x->>'position'='QB' and not ((x->>'id')=any(t.requested_player_ids)))
                + (select count(*) from jsonb_array_elements(coalesce(p.roster,'[]'::jsonb)) x where x->>'position'='QB' and ((x->>'id')=any(t.offered_player_ids))) > 1
              when 'RB' then
                (select count(*) from jsonb_array_elements(coalesce(r.roster,'[]'::jsonb)) x where x->>'position'='RB' and not ((x->>'id')=any(t.requested_player_ids)))
                + (select count(*) from jsonb_array_elements(coalesce(p.roster,'[]'::jsonb)) x where x->>'position'='RB' and ((x->>'id')=any(t.offered_player_ids))) > 2
              when 'WR' then
                (select count(*) from jsonb_array_elements(coalesce(r.roster,'[]'::jsonb)) x where x->>'position'='WR' and not ((x->>'id')=any(t.requested_player_ids)))
                + (select count(*) from jsonb_array_elements(coalesce(p.roster,'[]'::jsonb)) x where x->>'position'='WR' and ((x->>'id')=any(t.offered_player_ids))) > 2
              when 'TE' then
                (select count(*) from jsonb_array_elements(coalesce(r.roster,'[]'::jsonb)) x where x->>'position'='TE' and not ((x->>'id')=any(t.requested_player_ids)))
                + (select count(*) from jsonb_array_elements(coalesce(p.roster,'[]'::jsonb)) x where x->>'position'='TE' and ((x->>'id')=any(t.offered_player_ids))) > 1
              when 'K' then
                (select count(*) from jsonb_array_elements(coalesce(r.roster,'[]'::jsonb)) x where x->>'position'='K' and not ((x->>'id')=any(t.requested_player_ids)))
                + (select count(*) from jsonb_array_elements(coalesce(p.roster,'[]'::jsonb)) x where x->>'position'='K' and ((x->>'id')=any(t.offered_player_ids))) > 1
              when 'DST' then
                (select count(*) from jsonb_array_elements(coalesce(r.roster,'[]'::jsonb)) x where x->>'position'='DST' and not ((x->>'id')=any(t.requested_player_ids)))
                + (select count(*) from jsonb_array_elements(coalesce(p.roster,'[]'::jsonb)) x where x->>'position'='DST' and ((x->>'id')=any(t.offered_player_ids))) > 1
              else true
            end
          order by public.ball_knower_standard_fantasy_value(candidate.player) asc,
                   candidate.player->>'id'
          limit v_required_recipient_drops
        ) cuts;

        if coalesce(array_length(v_drop_ids,1),0)<>v_required_recipient_drops then
          update public.ball_knower_trades set status='rejected',resolved_at=now() where id=t.id;
          return jsonb_build_object('status','rejected','reason','CPU declined: the package would force an unsafe roster cut.');
        end if;
      end if;

      update public.ball_knower_trades set recipient_drop_player_ids=v_drop_ids where id=t.id;
      t.recipient_drop_player_ids:=v_drop_ids;

      -- Preview the CPU roster before accepting so it cannot trade itself out
      -- of a legal weekly lineup. CPU teams also stay at 20 because they do not
      -- have a human manager to fill an open roster spot before season launch.
      select coalesce(jsonb_agg(player),'[]'::jsonb) into r_new from (
        select player
        from jsonb_array_elements(coalesce(r.roster,'[]'::jsonb)) player
        where not ((player->>'id')=any(t.requested_player_ids||t.recipient_drop_player_ids))
        union all
        select player
        from jsonb_array_elements(coalesce(p.roster,'[]'::jsonb)) player
        where (player->>'id')=any(t.offered_player_ids)
      ) next_roster;

      select
        jsonb_array_length(r_new)=20
        and (select count(*) from jsonb_array_elements(r_new) x where x->>'position'='QB')>=1
        and (select count(*) from jsonb_array_elements(r_new) x where x->>'position'='RB')>=2
        and (select count(*) from jsonb_array_elements(r_new) x where x->>'position'='WR')>=2
        and (select count(*) from jsonb_array_elements(r_new) x where x->>'position'='TE')>=1
        and (select count(*) from jsonb_array_elements(r_new) x where x->>'position'='K')>=1
        and (select count(*) from jsonb_array_elements(r_new) x where x->>'position'='DST')>=1
        and (select count(*) from jsonb_array_elements(r_new) x where x->>'position' in ('RB','WR','TE'))>=6
      into v_cpu_lineup_valid;

      if not coalesce(v_cpu_lineup_valid,false) then
        update public.ball_knower_trades set status='rejected',resolved_at=now() where id=t.id;
        return jsonb_build_object('status','rejected','reason','CPU declined: the deal would leave an open roster spot or incomplete weekly lineup.');
      end if;

      if v_review='commissioner' and not public.is_ball_knower_commissioner(t.league_id) then
        update public.ball_knower_trades set status='accepted_pending_review',resolved_at=null where id=t.id;
        insert into public.ball_knower_transactions(league_id,member_id,transaction_type,summary,metadata)
        values(t.league_id,r.id,'trade_review',r.user_name||' accepted a CPU trade pending commissioner review.',jsonb_build_object('tradeId',t.id,'cpu',true));
        return jsonb_build_object('status','accepted_pending_review','reason','CPU accepted. Waiting for commissioner review.');
      end if;

      v_execute:=true;
    else
      if r.auth_user_id is distinct from actor then raise exception 'Only the receiving owner can accept this trade'; end if;
      v_required_recipient_drops:=greatest(
        0,
        jsonb_array_length(coalesce(r.roster,'[]'::jsonb))
          - array_length(t.requested_player_ids,1)
          + array_length(t.offered_player_ids,1)
          - 20
      );
      if coalesce(array_length(p_recipient_drop_player_ids,1),0)<>v_required_recipient_drops then
        raise exception 'Choose % roster cut(s) before accepting this trade',v_required_recipient_drops;
      end if;
      if p_recipient_drop_player_ids&&t.requested_player_ids then raise exception 'A traded player cannot also be a roster cut'; end if;
      foreach v_player in array p_recipient_drop_player_ids loop
        if not exists(
          select 1 from jsonb_array_elements(coalesce(r.roster,'[]'::jsonb)) player
          where player->>'id'=v_player
        ) then raise exception 'A selected roster cut is no longer on your roster'; end if;
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
      where not exists(
        select 1 from jsonb_array_elements(coalesce(p.roster,'[]'::jsonb)) player
        where player->>'id'=id
      )
    ) then raise exception 'The proposing roster changed; send a new offer'; end if;
    if exists(
      select 1 from unnest(t.requested_player_ids||t.recipient_drop_player_ids) id
      where not exists(
        select 1 from jsonb_array_elements(coalesce(r.roster,'[]'::jsonb)) player
        where player->>'id'=id
      )
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

    if jsonb_array_length(p_new)>20 or jsonb_array_length(r_new)>20
      or jsonb_array_length(p_new)<1 or jsonb_array_length(r_new)<1 then
      raise exception 'Trade would create an invalid roster size';
    end if;

    -- Commissioner approval can happen later, after either roster changed. If
    -- this is a CPU recipient, re-check lineup legality at execution time too.
    if coalesce(r.is_ai,false) then
      select
        jsonb_array_length(r_new)=20
        and (select count(*) from jsonb_array_elements(r_new) x where x->>'position'='QB')>=1
        and (select count(*) from jsonb_array_elements(r_new) x where x->>'position'='RB')>=2
        and (select count(*) from jsonb_array_elements(r_new) x where x->>'position'='WR')>=2
        and (select count(*) from jsonb_array_elements(r_new) x where x->>'position'='TE')>=1
        and (select count(*) from jsonb_array_elements(r_new) x where x->>'position'='K')>=1
        and (select count(*) from jsonb_array_elements(r_new) x where x->>'position'='DST')>=1
        and (select count(*) from jsonb_array_elements(r_new) x where x->>'position' in ('RB','WR','TE'))>=6
      into v_cpu_lineup_valid;
      if not coalesce(v_cpu_lineup_valid,false) then
        update public.ball_knower_trades set status='rejected',resolved_at=now() where id=t.id;
        return jsonb_build_object('status','rejected','reason','CPU declined: its roster changed and the deal no longer leaves a full legal weekly lineup.');
      end if;
    end if;

    perform set_config('ball_knower.authorized_roster_operation','trade',true);
    update public.ball_knower_league_members set roster=p_new,status=p.status,team_ratings=null where id=p.id;
    update public.ball_knower_league_members set roster=r_new,status=r.status,team_ratings=null where id=r.id;
    perform set_config('ball_knower.authorized_roster_operation','',true);

    update public.ball_knower_trades set status='accepted',resolved_at=now() where id=t.id;
    insert into public.ball_knower_transactions(league_id,member_id,transaction_type,summary,metadata)
    values(
      t.league_id,p.id,'trade','Trade completed between '||p.user_name||' and '||r.user_name,
      jsonb_build_object('tradeId',t.id,'cpu',coalesce(r.is_ai,false),'reviewed',p_action='approved')
    );
    return jsonb_build_object(
      'status','accepted',
      'reason',case when coalesce(r.is_ai,false) then 'CPU accepted the package.' else 'Trade completed.' end
    );
  end if;

  return jsonb_build_object('status',t.status);
end;
$$;

revoke all on function public.resolve_ball_knower_trade_v2(uuid,text,text[]) from public,anon;
grant execute on function public.resolve_ball_knower_trade_v2(uuid,text,text[]) to authenticated,service_role;
