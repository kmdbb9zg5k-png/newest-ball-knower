-- Build 7: make "instant" free agency mean instant only after the waiver
-- processing deadline has actually cleared. Append-only migration.

create or replace function public.normalize_ball_knower_player_waiver_deadline()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_settings jsonb;
begin
  select settings into v_settings from public.ball_knower_leagues where id=new.league_id;
  if not found then raise exception 'League not found'; end if;
  -- Drops begin with a duration-based timestamp. Snap it forward to the first
  -- configured processing run so claims remain protected until the real run.
  new.clears_at:=public.next_ball_knower_waiver_run(v_settings,new.clears_at-interval '1 second');
  return new;
end;$$;

revoke all on function public.normalize_ball_knower_player_waiver_deadline() from public,anon,authenticated;

drop trigger if exists bk_normalize_player_waiver_deadline on public.ball_knower_player_waivers;
create trigger bk_normalize_player_waiver_deadline
before insert or update of clears_at on public.ball_knower_player_waivers
for each row execute function public.normalize_ball_knower_player_waiver_deadline();

create or replace function public.submit_ball_knower_player_move(
  p_league_id text,p_player_snapshot jsonb,p_drop_player_id text default null,p_faab_bid numeric default 0,p_claim_order integer default 1,p_claim_group_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_auth uuid:=auth.uid();
  v_member public.ball_knower_league_members%rowtype;
  v_settings jsonb;
  v_player_id text;
  v_active_waiver boolean;
  v_continuous boolean;
  v_claim_id uuid;
  v_process_at timestamptz;
  v_clears_at timestamptz;
  v_bid numeric:=round(greatest(0,coalesce(p_faab_bid,0)),2);
  v_group uuid:=coalesce(p_claim_group_id,gen_random_uuid());
  v_result jsonb;
begin
  if v_auth is null then raise exception 'Authentication required'; end if;
  v_player_id:=p_player_snapshot->>'id';
  if v_player_id is null or v_player_id='' then raise exception 'Player data is missing'; end if;

  perform pg_advisory_xact_lock(hashtext('bk-acquire-'||p_league_id||'-'||v_player_id));
  select * into v_member from public.ball_knower_league_members where league_id=p_league_id and auth_user_id=v_auth limit 1 for update;
  if not found then raise exception 'League membership not found'; end if;
  select settings into v_settings from public.ball_knower_leagues where id=p_league_id;
  if not found then raise exception 'League not found'; end if;

  if exists(
    select 1 from public.ball_knower_league_members m,
    jsonb_array_elements(coalesce(m.roster,'[]'::jsonb))e
    where m.league_id=p_league_id and e->>'id'=v_player_id
  ) then raise exception 'Player is no longer available'; end if;

  select w.clears_at into v_clears_at
  from public.ball_knower_player_waivers w
  where w.league_id=p_league_id and w.player_id=v_player_id
  for update;
  v_active_waiver:=found;

  -- A pending claim is authoritative even if an older/raw clears_at timestamp
  -- has elapsed. Never let an instant add jump claims waiting for the worker.
  if not v_active_waiver and exists(
    select 1 from public.ball_knower_waiver_claims wc
    where wc.league_id=p_league_id and wc.player_id=v_player_id and wc.status='pending'
  ) then
    v_active_waiver:=true;
  end if;

  v_continuous:=coalesce(v_settings->>'freeAgentMode','instant')='continuous';
  if not v_active_waiver and not v_continuous then
    v_result:=public.apply_ball_knower_player_move(p_league_id,v_member.id,p_player_snapshot,p_drop_player_id,0,'free_agent',null);
    return v_result||jsonb_build_object('status','added','message','Free agent added instantly after waivers cleared.');
  end if;

  if coalesce(v_settings->>'waiverType','priority')='faab' and v_bid>v_member.faab_balance then raise exception 'FAAB bid exceeds remaining budget'; end if;
  if exists(
    select 1 from public.ball_knower_waiver_claims
    where league_id=p_league_id and member_id=v_member.id and player_id=v_player_id and status='pending'
  ) then raise exception 'You already have a pending claim for this player'; end if;

  v_process_at:=case
    when v_clears_at is not null then public.next_ball_knower_waiver_run(v_settings,v_clears_at-interval '1 second')
    else public.next_ball_knower_waiver_run(v_settings,now())
  end;

  insert into public.ball_knower_waiver_claims(
    league_id,member_id,player_id,player_snapshot,drop_player_id,priority,faab_bid,claim_group_id,claim_order,process_at
  ) values(
    p_league_id,v_member.id,v_player_id,p_player_snapshot,p_drop_player_id,greatest(1,p_claim_order),v_bid,v_group,greatest(1,p_claim_order),v_process_at
  ) returning id into v_claim_id;

  return jsonb_build_object('status','pending','claimId',v_claim_id,'claimGroupId',v_group,'processAt',v_process_at,'message','Waiver claim scheduled.');
end;$$;

revoke all on function public.submit_ball_knower_player_move(text,jsonb,text,numeric,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function public.submit_ball_knower_player_move(text,jsonb,text,numeric,integer,uuid) to authenticated;

create or replace function public.process_due_ball_knower_waivers(p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_league record;
  c record;
  v_type text;
  v_won integer:=0;
  v_lost integer:=0;
  v_old_priority integer;
  v_run uuid:=gen_random_uuid();
  v_cleared integer:=0;
begin
  -- Players with no claims become free agents only when their actual configured
  -- processing deadline has arrived.
  delete from public.ball_knower_player_waivers w
  where w.clears_at<=p_now
    and not exists(
      select 1 from public.ball_knower_waiver_claims wc
      where wc.league_id=w.league_id and wc.player_id=w.player_id and wc.status='pending'
    );
  get diagnostics v_cleared=row_count;

  for v_league in
    select distinct wc.league_id,l.settings
    from public.ball_knower_waiver_claims wc
    join public.ball_knower_leagues l on l.id=wc.league_id
    where wc.status='pending' and wc.process_at<=p_now
    order by wc.league_id
  loop
    perform pg_advisory_xact_lock(hashtext('bk-waivers-'||v_league.league_id));
    v_type:=coalesce(v_league.settings->>'waiverType','priority');
    loop
      select wc.*,m.waiver_priority into c
      from public.ball_knower_waiver_claims wc
      join public.ball_knower_league_members m on m.id=wc.member_id
      where wc.league_id=v_league.league_id and wc.status='pending' and wc.process_at<=p_now
        and not exists(
          select 1 from public.ball_knower_waiver_claims earlier
          where earlier.claim_group_id=wc.claim_group_id and earlier.status='pending' and earlier.claim_order<wc.claim_order
        )
      order by case when v_type='faab' then wc.faab_bid end desc,m.waiver_priority,wc.created_at,wc.id
      limit 1;
      exit when not found;

      if exists(select 1 from public.ball_knower_waiver_claims x where x.claim_group_id=c.claim_group_id and x.status='won') then
        update public.ball_knower_waiver_claims set status='cancelled',processed_at=p_now,failure_reason='Earlier conditional claim won' where id=c.id;
        continue;
      end if;

      begin
        perform public.apply_ball_knower_player_move(c.league_id,c.member_id,c.player_snapshot,c.drop_player_id,case when v_type='faab' then c.faab_bid else 0 end,'waiver',c.id);
      exception
        when serialization_failure or deadlock_detected or query_canceled or admin_shutdown then raise;
        when others then
          update public.ball_knower_waiver_claims set status='lost',processed_at=p_now,failure_reason=left(sqlerrm,240) where id=c.id;
          v_lost:=v_lost+1;
          continue;
      end;

      update public.ball_knower_waiver_claims set status='won',processed_at=p_now,failure_reason=null where id=c.id;
      update public.ball_knower_waiver_claims set status='lost',processed_at=p_now,failure_reason='Another manager won this player' where league_id=c.league_id and player_id=c.player_id and status='pending' and id<>c.id;
      update public.ball_knower_waiver_claims set status='cancelled',processed_at=p_now,failure_reason='Earlier conditional claim won' where claim_group_id=c.claim_group_id and status='pending' and id<>c.id;
      if v_type<>'faab' then
        v_old_priority:=c.waiver_priority;
        update public.ball_knower_league_members set waiver_priority=waiver_priority-1 where league_id=c.league_id and waiver_priority>v_old_priority;
        update public.ball_knower_league_members set waiver_priority=(select count(*) from public.ball_knower_league_members where league_id=c.league_id) where id=c.member_id;
      end if;
      v_won:=v_won+1;
    end loop;
  end loop;

  -- If every due claim lost (roster changed, cap, etc.), release the player now;
  -- do not strand a stale waiver row forever.
  delete from public.ball_knower_player_waivers w
  where w.clears_at<=p_now
    and not exists(
      select 1 from public.ball_knower_waiver_claims wc
      where wc.league_id=w.league_id and wc.player_id=w.player_id and wc.status='pending'
    );
  get diagnostics v_cleared=v_cleared+row_count;

  select count(*) into v_lost from public.ball_knower_waiver_claims where processed_at=p_now and status='lost';
  if v_won>0 or v_lost>0 or v_cleared>0 then
    insert into public.ball_knower_waiver_runs(id,processed_at,won_count,lost_count,metadata)
    values(v_run,p_now,v_won,v_lost,jsonb_build_object('source','automatic','clearedUnclaimed',v_cleared));
  else
    v_run:=null;
  end if;
  return jsonb_build_object('runId',v_run,'processedAt',p_now,'won',v_won,'lost',v_lost,'clearedUnclaimed',v_cleared);
end;$$;

revoke all on function public.process_due_ball_knower_waivers(timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.process_due_ball_knower_waivers(timestamptz) to service_role;
