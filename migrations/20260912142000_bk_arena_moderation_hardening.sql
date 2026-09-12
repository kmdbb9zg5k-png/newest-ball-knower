-- Human-review tools and a final block/friend check at challenge acceptance.
create or replace function public.respond_ball_knower_h2h(p_match_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=ball_knower_private.require_permanent_community_user(); challenger uuid;
begin
  select challenger_id into challenger from public.ball_knower_h2h_matches where id=p_match_id and opponent_id=me and status='pending' for update;
  if challenger is null then raise exception 'Challenge is unavailable'; end if;
  if p_accept then
    if not exists(select 1 from public.ball_knower_friendships where status='accepted' and least(requester_id,recipient_id)=least(me,challenger) and greatest(requester_id,recipient_id)=greatest(me,challenger))
      or exists(select 1 from public.ball_knower_user_blocks where (blocker_id=me and blocked_id=challenger) or (blocker_id=challenger and blocked_id=me)) then
      raise exception 'Challenge is no longer available';
    end if;
    update public.ball_knower_h2h_matches set status='active',started_at=now() where id=p_match_id;
    perform ball_knower_private.seed_h2h(p_match_id);
  else
    update public.ball_knower_h2h_matches set status='declined',finished_at=now() where id=p_match_id;
  end if;
end $$;
revoke all on function public.respond_ball_knower_h2h(uuid,boolean) from public,anon;
grant execute on function public.respond_ball_knower_h2h(uuid,boolean) to authenticated;

create function public.moderate_ball_knower_community_report(p_report_id uuid,p_action text,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare report public.ball_knower_community_reports%rowtype;
begin
  if p_action not in('dismiss','remove','suspend') or length(btrim(coalesce(p_note,''))) not between 1 and 2000 then raise exception 'A moderation action and review note are required'; end if;
  select * into report from public.ball_knower_community_reports where id=p_report_id for update;
  if not found then raise exception 'Report not found'; end if;
  if p_action in('remove','suspend') and report.content_type in('global_message','community_dm') then
    update public.ball_knower_community_messages set removed_at=coalesce(removed_at,now()) where id=report.content_id;
  end if;
  if p_action='suspend' then
    insert into ball_knower_private.community_suspensions(auth_user_id,reason,expires_at)
      values(report.subject_id,'Community report '||report.id::text,now()+interval '7 days')
      on conflict(auth_user_id) do update set reason=excluded.reason,expires_at=greatest(ball_knower_private.community_suspensions.expires_at,excluded.expires_at);
  end if;
  update public.ball_knower_community_reports set status=case p_action when 'dismiss' then 'dismissed' when 'remove' then 'removed' else 'suspended' end,
    reviewed_at=now(),moderator_note=btrim(p_note) where id=p_report_id;
end $$;
revoke all on function public.moderate_ball_knower_community_report(uuid,text,text) from public,anon,authenticated;
grant execute on function public.moderate_ball_knower_community_report(uuid,text,text) to service_role;
