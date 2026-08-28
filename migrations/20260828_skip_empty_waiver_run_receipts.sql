-- Cron delivery can be repeated. Roster processing is already idempotent; avoid
-- storing an empty audit receipt for every harmless poll.
create or replace function public.process_due_ball_knower_waivers(p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_league record;c record;v_type text;v_won integer:=0;v_lost integer:=0;v_old_priority integer;v_run uuid:=gen_random_uuid();
begin
  for v_league in select distinct wc.league_id,l.settings from public.ball_knower_waiver_claims wc join public.ball_knower_leagues l on l.id=wc.league_id where wc.status='pending' and wc.process_at<=p_now order by wc.league_id loop
    perform pg_advisory_xact_lock(hashtext('bk-waivers-'||v_league.league_id));
    v_type:=coalesce(v_league.settings->>'waiverType','priority');
    for c in
      select wc.*,m.waiver_priority from public.ball_knower_waiver_claims wc join public.ball_knower_league_members m on m.id=wc.member_id
      where wc.league_id=v_league.league_id and wc.status='pending' and wc.process_at<=p_now
      order by wc.claim_order,case when v_type='faab' then wc.faab_bid end desc,m.waiver_priority,wc.created_at,wc.id
    loop
      if exists(select 1 from public.ball_knower_waiver_claims x where x.claim_group_id=c.claim_group_id and x.status='won') then update public.ball_knower_waiver_claims set status='cancelled',processed_at=p_now,failure_reason='Earlier conditional claim won' where id=c.id and status='pending';continue;end if;
      begin
        perform public.apply_ball_knower_player_move(c.league_id,c.member_id,c.player_snapshot,c.drop_player_id,case when v_type='faab' then c.faab_bid else 0 end,'waiver',c.id);
      exception when others then
        update public.ball_knower_waiver_claims set status='lost',processed_at=p_now,failure_reason=left(sqlerrm,240) where id=c.id and status='pending';v_lost:=v_lost+1;continue;
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
  select count(*) into v_lost from public.ball_knower_waiver_claims where processed_at=p_now and status='lost';
  if v_won>0 or v_lost>0 then insert into public.ball_knower_waiver_runs(id,processed_at,won_count,lost_count,metadata) values(v_run,p_now,v_won,v_lost,jsonb_build_object('source','automatic')); else v_run:=null; end if;
  return jsonb_build_object('runId',v_run,'processedAt',p_now,'won',v_won,'lost',v_lost);
end;$$;

revoke all on function public.process_due_ball_knower_waivers(timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.process_due_ball_knower_waivers(timestamptz) to service_role;
