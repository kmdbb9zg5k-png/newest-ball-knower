-- Serialize quick matches and friend challenges; preserve access and scoring contracts.
create or replace function public.start_ball_knower_h2h(p_opponent_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=ball_knower_private.require_permanent_community_user(); result uuid; waiting uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bk-h2h-matchmaker',0));
  update public.ball_knower_h2h_matches set status='cancelled',finished_at=now() where status in('waiting','pending') and created_at<now()-interval '10 minutes';
  -- Recover a participant's expired game before allowing the next one.
  for waiting in select id from public.ball_knower_h2h_matches
    where status='active' and me in(challenger_id,opponent_id)
      and started_at+make_interval(secs=>duration_seconds)<=now() order by id
  loop perform public.finish_ball_knower_h2h(waiting); end loop;
  if exists(select 1 from public.ball_knower_h2h_matches where status in('waiting','pending','active') and me in(challenger_id,opponent_id)) then raise exception 'Finish or cancel your current H2H first'; end if;
  if p_opponent_id is not null then
    if p_opponent_id=me then raise exception 'Choose another Ball Knower'; end if;
    if exists(select 1 from public.ball_knower_user_blocks where (blocker_id=me and blocked_id=p_opponent_id) or (blocker_id=p_opponent_id and blocked_id=me)) then raise exception 'Challenge is unavailable'; end if;
    if exists(select 1 from ball_knower_private.community_suspensions where auth_user_id=p_opponent_id and expires_at>now()) then raise exception 'Challenge is unavailable'; end if;
    if exists(select 1 from public.ball_knower_h2h_matches where status in('waiting','pending','active') and p_opponent_id in(challenger_id,opponent_id)) then raise exception 'Your friend already has an H2H. Try again after their match.'; end if;
    if not exists(select 1 from public.ball_knower_friendships where status='accepted' and least(requester_id,recipient_id)=least(me,p_opponent_id) and greatest(requester_id,recipient_id)=greatest(me,p_opponent_id)) then raise exception 'Only accepted friends can be challenged'; end if;
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


-- Human-review tools and a final block/friend check at challenge acceptance.
create or replace function public.respond_ball_knower_h2h(p_match_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=ball_knower_private.require_permanent_community_user(); challenger uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bk-h2h-matchmaker',0));
  select challenger_id into challenger from public.ball_knower_h2h_matches where id=p_match_id and opponent_id=me and status='pending' for update;
  if challenger is null then raise exception 'Challenge is unavailable'; end if;
  if p_accept then
    if exists(select 1 from public.ball_knower_h2h_matches where id=p_match_id and created_at<now()-interval '10 minutes') then raise exception 'Challenge expired. Ask your friend for a new challenge.'; end if;
    if exists(select 1 from public.ball_knower_h2h_matches where id<>p_match_id and status in('waiting','pending','active') and (me in(challenger_id,opponent_id) or challenger in(challenger_id,opponent_id))) then raise exception 'Finish or cancel your current H2H first'; end if;
    if exists(select 1 from ball_knower_private.community_suspensions where auth_user_id=challenger and expires_at>now()) then raise exception 'Challenge is unavailable'; end if;
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


-- Keep the Community landing payload bounded as friend and H2H history grow.
create or replace function public.get_ball_knower_community_home()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me uuid := ball_knower_private.require_permanent_community_user();
begin
  return jsonb_build_object(
    'leaderboard',coalesce((select jsonb_agg(to_jsonb(x) order by x.rank) from (
      select p.user_id,p.display_name,p.bk_rating,p.level,p.h2h_rating,p.h2h_wins,p.h2h_losses,p.h2h_ties,
        row_number() over(order by p.bk_rating desc,p.xp desc,p.updated_at asc) as rank
      from public.ball_knower_progress_profiles p join auth.users u on u.id=p.user_id
      where not coalesce(u.is_anonymous,false)
        and not exists(select 1 from public.ball_knower_user_blocks b where b.blocker_id=me and b.blocked_id=p.user_id)
        and not exists(select 1 from ball_knower_private.community_suspensions s where s.auth_user_id=p.user_id and s.expires_at>now())
      order by p.bk_rating desc,p.xp desc,p.updated_at asc limit 50
    ) x),'[]'::jsonb),
    'friends',coalesce((select jsonb_agg(jsonb_build_object(
        'friendship_id',x.id,'status',x.status,'direction',case when x.requester_id=me then 'outgoing' else 'incoming' end,
        'user_id',x.user_id,'display_name',x.display_name,'bk_rating',x.bk_rating,'h2h_rating',x.h2h_rating,
        'h2h_wins',x.h2h_wins,'h2h_losses',x.h2h_losses,'h2h_ties',x.h2h_ties
      ) order by x.updated_at desc) from (
        select f.id,f.status,f.requester_id,f.recipient_id,f.updated_at,p.user_id,p.display_name,p.bk_rating,p.h2h_rating,p.h2h_wins,p.h2h_losses,p.h2h_ties
        from public.ball_knower_friendships f join public.ball_knower_progress_profiles p on p.user_id=case when f.requester_id=me then f.recipient_id else f.requester_id end
        where me in(f.requester_id,f.recipient_id) order by f.updated_at desc limit 250
      ) x),'[]'::jsonb),
    'matches',coalesce((select jsonb_agg(jsonb_build_object(
        'id',x.id,'challenger_id',x.challenger_id,'opponent_id',x.opponent_id,'match_type',x.match_type,'status',x.status,
        'challenger_score',x.challenger_score,'opponent_score',x.opponent_score,'winner_id',x.winner_id,'started_at',x.started_at,
        'finished_at',x.finished_at,'created_at',x.created_at,'challenger_name',x.challenger_name,'opponent_name',x.opponent_name
      ) order by x.created_at desc) from (
        select m.*,a.display_name challenger_name,o.display_name opponent_name
        from public.ball_knower_h2h_matches m join public.ball_knower_progress_profiles a on a.user_id=m.challenger_id
        left join public.ball_knower_progress_profiles o on o.user_id=m.opponent_id
        where me in(m.challenger_id,m.opponent_id) and (m.status in('active','waiting','pending') or m.created_at>now()-interval '7 days')
        order by (m.status in('active','waiting','pending')) desc,m.created_at desc limit 25
      ) x),'[]'::jsonb)
  );
end $$;
revoke all on function public.get_ball_knower_community_home() from public,anon;
grant execute on function public.get_ball_knower_community_home() to authenticated;
