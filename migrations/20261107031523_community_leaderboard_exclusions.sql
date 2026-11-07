-- Keep leaderboard visibility separate from account access and Community moderation.
create table ball_knower_private.community_leaderboard_exclusions (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table ball_knower_private.community_leaderboard_exclusions enable row level security;
revoke all on table ball_knower_private.community_leaderboard_exclusions from public, anon, authenticated;

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
        and not exists (
          select 1 from ball_knower_private.community_leaderboard_exclusions e where e.user_id = p.user_id
        )
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

create or replace function public.get_ball_knower_community_preview()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'leaderboard',coalesce((select jsonb_agg(to_jsonb(r) order by r.rank) from (
      select p.user_id,p.display_name,p.bk_rating,p.level,p.h2h_rating,p.h2h_wins,p.h2h_losses,p.h2h_ties,
        row_number() over(order by p.bk_rating desc,p.xp desc,p.updated_at asc,p.user_id) as rank
      from public.ball_knower_progress_profiles p join auth.users u on u.id=p.user_id
      where not coalesce(u.is_anonymous,false)
        and not exists (
          select 1 from ball_knower_private.community_leaderboard_exclusions e where e.user_id = p.user_id
        )
        and not exists(select 1 from ball_knower_private.community_suspensions s where s.auth_user_id=p.user_id and s.expires_at>now())
      order by p.bk_rating desc,p.xp desc,p.updated_at asc,p.user_id limit 50
    ) r),'[]'::jsonb),
    'messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at desc,m.id desc) from (
      select c.id,c.author_id,p.display_name,c.body,c.created_at
      from public.ball_knower_community_messages c
      join public.ball_knower_progress_profiles p on p.user_id=c.author_id
      join auth.users u on u.id=c.author_id
      where c.kind='global' and c.removed_at is null and not coalesce(u.is_anonymous,false)
        and not exists(select 1 from ball_knower_private.community_suspensions s where s.auth_user_id=c.author_id and s.expires_at>now())
      order by c.created_at desc,c.id desc limit 75
    ) m),'[]'::jsonb),
    'friends','[]'::jsonb,'matches','[]'::jsonb
  );
$$;
