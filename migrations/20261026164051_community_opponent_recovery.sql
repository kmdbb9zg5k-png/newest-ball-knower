-- Shared locked, idempotent settlement supports abandoned opponent games without exposing finalization privileges.
create function ball_knower_private.complete_h2h_match(p_match_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare m public.ball_knower_h2h_matches%rowtype; victor uuid; total integer;
begin
  select * into m from public.ball_knower_h2h_matches where id=p_match_id for update;
  if not found then raise exception 'Match is unavailable'; end if;
  if m.status='completed' then return; end if;
  select count(*) into total from ball_knower_private.h2h_questions where match_id=p_match_id;
  if m.status<>'active' or (now()<m.started_at+make_interval(secs=>m.duration_seconds) and ((select count(*) from ball_knower_private.h2h_answers where match_id=p_match_id and user_id=m.challenger_id)<total or (select count(*) from ball_knower_private.h2h_answers where match_id=p_match_id and user_id=m.opponent_id)<total)) then raise exception 'Match is still active'; end if;
  victor:=case when m.challenger_score>m.opponent_score then m.challenger_id when m.opponent_score>m.challenger_score then m.opponent_id else null end;
  update public.ball_knower_h2h_matches set status='completed',winner_id=victor,finished_at=now() where id=p_match_id;
  if victor is null then
    update public.ball_knower_progress_profiles set h2h_ties=h2h_ties+1,h2h_streak=0,updated_at=now() where user_id in(m.challenger_id,m.opponent_id);
  else
    update public.ball_knower_progress_profiles set h2h_wins=h2h_wins+1,h2h_rating=least(3000,h2h_rating+16),h2h_streak=greatest(1,h2h_streak+1),h2h_best_streak=greatest(h2h_best_streak,greatest(1,h2h_streak+1)),updated_at=now() where user_id=victor;
    update public.ball_knower_progress_profiles set h2h_losses=h2h_losses+1,h2h_rating=greatest(0,h2h_rating-16),h2h_streak=least(-1,h2h_streak-1),updated_at=now() where user_id in(m.challenger_id,m.opponent_id) and user_id<>victor;
  end if;
  return;
end $$;
revoke all on function ball_knower_private.complete_h2h_match(uuid) from public,anon,authenticated;

-- Public finalization still requires a signed-in match participant.
create or replace function public.finish_ball_knower_h2h(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=ball_knower_private.require_permanent_community_user();
begin
  if not exists(select 1 from public.ball_knower_h2h_matches where id=p_match_id and me in(challenger_id,opponent_id)) then raise exception 'Match is unavailable'; end if;
  perform ball_knower_private.complete_h2h_match(p_match_id);
  return public.get_ball_knower_h2h_match(p_match_id);
end $$;
revoke all on function public.finish_ball_knower_h2h(uuid) from public,anon;
grant execute on function public.finish_ball_knower_h2h(uuid) to authenticated;

create or replace function public.start_ball_knower_h2h(p_opponent_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=ball_knower_private.require_permanent_community_user(); result uuid; waiting uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bk-h2h-matchmaker',0));
  update public.ball_knower_h2h_matches set status='cancelled',finished_at=now() where status in('waiting','pending') and created_at<now()-interval '10 minutes';
  if p_opponent_id is not null then
    if p_opponent_id=me then raise exception 'Choose another Ball Knower'; end if;
    if not exists(select 1 from public.ball_knower_friendships where status='accepted' and least(requester_id,recipient_id)=least(me,p_opponent_id) and greatest(requester_id,recipient_id)=greatest(me,p_opponent_id)) then raise exception 'Only accepted friends can be challenged'; end if;
    if exists(select 1 from public.ball_knower_user_blocks where (blocker_id=me and blocked_id=p_opponent_id) or (blocker_id=p_opponent_id and blocked_id=me)) then raise exception 'Challenge is unavailable'; end if;
  end if;
  -- Recover either participant's expired game before the busy check.

  for waiting in select id from public.ball_knower_h2h_matches
    where status='active' and (me in(challenger_id,opponent_id) or p_opponent_id in(challenger_id,opponent_id))
      and started_at+make_interval(secs=>duration_seconds)<=now() order by id
  loop perform ball_knower_private.complete_h2h_match(waiting); end loop;
  if exists(select 1 from public.ball_knower_h2h_matches where status in('waiting','pending','active') and me in(challenger_id,opponent_id)) then raise exception 'Finish or cancel your current H2H first'; end if;
  if p_opponent_id is not null then
    if exists(select 1 from ball_knower_private.community_suspensions where auth_user_id=p_opponent_id and expires_at>now()) then raise exception 'Challenge is unavailable'; end if;
    if exists(select 1 from public.ball_knower_h2h_matches where status in('waiting','pending','active') and p_opponent_id in(challenger_id,opponent_id)) then raise exception 'Your friend already has an H2H. Try again after their match.'; end if;
    insert into public.ball_knower_h2h_matches(challenger_id,opponent_id,match_type,status) values(me,p_opponent_id,'friend','pending') returning id into result;
    return result;
  end if;
  select id into waiting from public.ball_knower_h2h_matches m where m.status='waiting' and m.challenger_id<>me
    and not exists(select 1 from ball_knower_private.community_suspensions s where s.auth_user_id=m.challenger_id and s.expires_at>now())
    and not exists(select 1 from public.ball_knower_user_blocks b where (b.blocker_id=me and b.blocked_id=m.challenger_id) or (b.blocker_id=m.challenger_id and b.blocked_id=me))
    order by m.created_at for update skip locked limit 1;
  if waiting is null then insert into public.ball_knower_h2h_matches(challenger_id,match_type,status) values(me,'quick','waiting') returning id into result; return result; end if;
  update public.ball_knower_h2h_matches set opponent_id=me,status='active',started_at=now() where id=waiting returning id into result;
  perform ball_knower_private.seed_h2h(result);
  return result;
end $$;
revoke all on function public.start_ball_knower_h2h(uuid) from public,anon;
grant execute on function public.start_ball_knower_h2h(uuid) to authenticated;
