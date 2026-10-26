-- Public Community browsing exposes only leaderboard fields and moderated global messages.
-- Existing private reads, write RPCs, table grants and RLS remain unchanged.
create function public.get_ball_knower_community_preview()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'leaderboard',coalesce((select jsonb_agg(to_jsonb(r) order by r.rank) from (
      select p.user_id,p.display_name,p.bk_rating,p.level,p.h2h_rating,p.h2h_wins,p.h2h_losses,p.h2h_ties,
        row_number() over(order by p.bk_rating desc,p.xp desc,p.updated_at asc,p.user_id) as rank
      from public.ball_knower_progress_profiles p join auth.users u on u.id=p.user_id
      where not coalesce(u.is_anonymous,false)
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
revoke all on function public.get_ball_knower_community_preview() from public;
grant execute on function public.get_ball_knower_community_preview() to anon,authenticated;
