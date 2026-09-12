-- BK Arena: account-only worldwide rankings, moderated chat, friends, DMs and
-- server-authoritative 60-second head-to-head trivia.
create schema if not exists ball_knower_private;

alter table public.ball_knower_progress_profiles
  add column if not exists h2h_rating integer not null default 1000 check (h2h_rating between 0 and 3000),
  add column if not exists h2h_wins integer not null default 0 check (h2h_wins >= 0),
  add column if not exists h2h_losses integer not null default 0 check (h2h_losses >= 0),
  add column if not exists h2h_ties integer not null default 0 check (h2h_ties >= 0),
  add column if not exists h2h_streak integer not null default 0,
  add column if not exists h2h_best_streak integer not null default 0 check (h2h_best_streak >= 0);

create function ball_knower_private.require_permanent_community_user()
returns uuid language plpgsql stable security definer set search_path='' as $$
declare me uuid := (select auth.uid());
begin
  if me is null or not exists(select 1 from auth.users u where u.id=me and not coalesce(u.is_anonymous,false)) then
    raise exception 'Save or sign in to your Ball Knower account to use Community';
  end if;
  if exists(select 1 from ball_knower_private.community_suspensions s where s.auth_user_id=me and s.expires_at>now()) then
    raise exception 'Community access is suspended; contact Ball Knower support';
  end if;
  return me;
end $$;
revoke all on function ball_knower_private.require_permanent_community_user() from public,anon,authenticated;

create function ball_knower_private.community_censor_text(p_body text,p_limit integer)
returns text language plpgsql immutable set search_path='' as $$
declare cleaned text := btrim(coalesce(p_body,''));
begin
  if length(cleaned) not between 1 and p_limit then raise exception 'Message must be between 1 and % characters',p_limit; end if;
  if lower(regexp_replace(cleaned,'[[:space:][:punct:]]+',' ','g')) ~
    '(kill yourself|i will kill you|child porn|rape you|heil hitler|white power)' then
    raise exception 'Message cannot be posted. Follow the community guidelines.';
  end if;
  cleaned := regexp_replace(cleaned,'(?i)\m(fuck|fucking|fucker|shit|bullshit|bitch|asshole|cunt|dick|pussy|nigger|nigga|faggot|fag|tranny)\M','••••','g');
  return cleaned;
end $$;
revoke all on function ball_knower_private.community_censor_text(text,integer) from public,anon,authenticated;

create table public.ball_knower_friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(requester_id<>recipient_id)
);
create unique index bk_friendships_pair_uidx on public.ball_knower_friendships(least(requester_id,recipient_id),greatest(requester_id,recipient_id));
create index bk_friendships_recipient_idx on public.ball_knower_friendships(recipient_id,status,updated_at desc);
alter table public.ball_knower_friendships enable row level security;
revoke all on public.ball_knower_friendships from public,anon,authenticated;
grant select on public.ball_knower_friendships to authenticated;
grant all on public.ball_knower_friendships to service_role;
create policy bk_friendships_participant_read on public.ball_knower_friendships for select to authenticated
  using((select auth.uid()) in(requester_id,recipient_id));

create table public.ball_knower_community_messages (
  id uuid primary key default gen_random_uuid(),
  kind text not null check(kind in ('global','direct')),
  author_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  body text not null check(length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  check((kind='global' and recipient_id is null and length(body)<=300) or (kind='direct' and recipient_id is not null and recipient_id<>author_id))
);
create index bk_community_messages_global_idx on public.ball_knower_community_messages(created_at desc) where kind='global' and removed_at is null;
create index bk_community_messages_dm_idx on public.ball_knower_community_messages(least(author_id,recipient_id),greatest(author_id,recipient_id),created_at desc) where kind='direct';
alter table public.ball_knower_community_messages enable row level security;
revoke all on public.ball_knower_community_messages from public,anon,authenticated;
grant select on public.ball_knower_community_messages to authenticated;
grant all on public.ball_knower_community_messages to service_role;
create policy bk_community_messages_read on public.ball_knower_community_messages for select to authenticated using(
  removed_at is null and public.ball_knower_can_see_sender(author_id) and
  (kind='global' or (select auth.uid()) in(author_id,recipient_id))
);

create table public.ball_knower_community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null check(content_type in ('global_message','community_dm','profile')),
  content_id uuid not null,
  reason text not null check(reason in ('harassment','hate','sexual','threats','spam','impersonation','rights','other')),
  details text not null default '' check(length(details)<=1000),
  evidence text not null check(length(evidence)<=2000),
  status text not null default 'open' check(status in ('open','dismissed','removed','suspended')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  moderator_note text check(length(moderator_note)<=2000),
  unique(reporter_id,content_type,content_id)
);
create index bk_community_reports_queue_idx on public.ball_knower_community_reports(status,created_at);
alter table public.ball_knower_community_reports enable row level security;
revoke all on public.ball_knower_community_reports from public,anon,authenticated;
grant select on public.ball_knower_community_reports to authenticated;
grant all on public.ball_knower_community_reports to service_role;
create policy bk_community_reports_owner_read on public.ball_knower_community_reports for select to authenticated using(reporter_id=(select auth.uid()));

create table public.ball_knower_h2h_matches (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references auth.users(id) on delete cascade,
  opponent_id uuid references auth.users(id) on delete cascade,
  match_type text not null check(match_type in ('quick','friend')),
  status text not null check(status in ('waiting','pending','active','completed','declined','cancelled')),
  duration_seconds integer not null default 60 check(duration_seconds=60),
  challenger_score integer not null default 0 check(challenger_score>=0),
  opponent_score integer not null default 0 check(opponent_score>=0),
  winner_id uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  check(challenger_id is distinct from opponent_id)
);
create index bk_h2h_live_idx on public.ball_knower_h2h_matches(status,created_at);
create index bk_h2h_challenger_idx on public.ball_knower_h2h_matches(challenger_id,created_at desc);
create index bk_h2h_opponent_idx on public.ball_knower_h2h_matches(opponent_id,created_at desc);
alter table public.ball_knower_h2h_matches enable row level security;
revoke all on public.ball_knower_h2h_matches from public,anon,authenticated;
grant select on public.ball_knower_h2h_matches to authenticated;
grant all on public.ball_knower_h2h_matches to service_role;
create policy bk_h2h_participant_read on public.ball_knower_h2h_matches for select to authenticated
  using((select auth.uid()) in(challenger_id,opponent_id));

create table ball_knower_private.h2h_questions (
  match_id uuid not null references public.ball_knower_h2h_matches(id) on delete cascade,
  ordinal smallint not null check(ordinal between 0 and 24),
  question_id bigint not null references ball_knower_private.trivia_questions(id),
  primary key(match_id,ordinal)
);
create table ball_knower_private.h2h_answers (
  match_id uuid not null references public.ball_knower_h2h_matches(id) on delete cascade,
  ordinal smallint not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  selected_index smallint not null check(selected_index between 0 and 3),
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  primary key(match_id,ordinal,user_id),
  foreign key(match_id,ordinal) references ball_knower_private.h2h_questions(match_id,ordinal) on delete cascade
);
revoke all on ball_knower_private.h2h_questions,ball_knower_private.h2h_answers from public,anon,authenticated;
grant all on ball_knower_private.h2h_questions,ball_knower_private.h2h_answers to service_role;

create function ball_knower_private.seed_h2h(p_match_id uuid)
returns void language plpgsql volatile security definer set search_path='' as $$
begin
  insert into ball_knower_private.h2h_questions(match_id,ordinal,question_id)
  select p_match_id,(row_number() over()-1)::smallint,q.id
  from (select id from ball_knower_private.trivia_questions where active order by random() limit 25) q;
  if (select count(*) from ball_knower_private.h2h_questions where match_id=p_match_id)<10 then
    raise exception 'Not enough verified trivia questions are available';
  end if;
end $$;
revoke all on function ball_knower_private.seed_h2h(uuid) from public,anon,authenticated;

create function public.get_ball_knower_community_home()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me uuid := ball_knower_private.require_permanent_community_user();
begin
  return jsonb_build_object(
    'leaderboard',coalesce((select jsonb_agg(x order by x.rank) from (
      select p.user_id,p.display_name,p.bk_rating,p.level,p.h2h_rating,p.h2h_wins,p.h2h_losses,p.h2h_ties,
        row_number() over(order by p.bk_rating desc,p.xp desc,p.updated_at asc) as rank
      from public.ball_knower_progress_profiles p join auth.users u on u.id=p.user_id
      where not coalesce(u.is_anonymous,false)
        and not exists(select 1 from public.ball_knower_user_blocks b where b.blocker_id=me and b.blocked_id=p.user_id)
        and not exists(select 1 from ball_knower_private.community_suspensions s where s.auth_user_id=p.user_id and s.expires_at>now())
      order by p.bk_rating desc,p.xp desc,p.updated_at asc limit 50
    ) x),'[]'::jsonb),
    'friends',coalesce((select jsonb_agg(jsonb_build_object('friendship_id',f.id,'status',f.status,'direction',case when f.requester_id=me then 'outgoing' else 'incoming' end,'user_id',p.user_id,'display_name',p.display_name,'bk_rating',p.bk_rating,'h2h_rating',p.h2h_rating,'h2h_wins',p.h2h_wins,'h2h_losses',p.h2h_losses,'h2h_ties',p.h2h_ties) order by f.updated_at desc)
      from public.ball_knower_friendships f join public.ball_knower_progress_profiles p on p.user_id=case when f.requester_id=me then f.recipient_id else f.requester_id end
      where me in(f.requester_id,f.recipient_id)),'[]'::jsonb),
    'matches',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'challenger_id',m.challenger_id,'opponent_id',m.opponent_id,'match_type',m.match_type,'status',m.status,'challenger_score',m.challenger_score,'opponent_score',m.opponent_score,'winner_id',m.winner_id,'started_at',m.started_at,'finished_at',m.finished_at,'created_at',m.created_at,'challenger_name',a.display_name,'opponent_name',o.display_name) order by m.created_at desc)
      from public.ball_knower_h2h_matches m join public.ball_knower_progress_profiles a on a.user_id=m.challenger_id left join public.ball_knower_progress_profiles o on o.user_id=m.opponent_id
      where me in(m.challenger_id,m.opponent_id) and m.created_at>now()-interval '7 days' limit 25),'[]'::jsonb)
  );
end $$;
revoke all on function public.get_ball_knower_community_home() from public,anon;
grant execute on function public.get_ball_knower_community_home() to authenticated;

create function public.search_ball_knower_community_users(p_query text)
returns table(user_id uuid,display_name text,bk_rating integer,h2h_rating integer,is_friend boolean,request_pending boolean)
language plpgsql stable security definer set search_path='' as $$
declare me uuid := ball_knower_private.require_permanent_community_user(); q text:=btrim(coalesce(p_query,''));
begin
  if length(q)<2 then return; end if;
  return query select p.user_id,p.display_name,p.bk_rating,p.h2h_rating,
    coalesce(f.status='accepted',false),coalesce(f.status='pending',false)
  from public.ball_knower_progress_profiles p join auth.users u on u.id=p.user_id
  left join public.ball_knower_friendships f on least(f.requester_id,f.recipient_id)=least(me,p.user_id) and greatest(f.requester_id,f.recipient_id)=greatest(me,p.user_id)
  where p.user_id<>me and not coalesce(u.is_anonymous,false) and p.display_name ilike '%'||q||'%'
    and public.ball_knower_can_see_sender(p.user_id)
  order by p.bk_rating desc,p.display_name limit 20;
end $$;
revoke all on function public.search_ball_knower_community_users(text) from public,anon;
grant execute on function public.search_ball_knower_community_users(text) to authenticated;

create function public.send_ball_knower_friend_request(p_user_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=ball_knower_private.require_permanent_community_user(); result uuid;
begin
  if p_user_id is null or p_user_id=me or not exists(select 1 from auth.users where id=p_user_id and not coalesce(is_anonymous,false)) then raise exception 'Choose a saved Ball Knower account'; end if;
  perform ball_knower_private.community_pair_lock(me,p_user_id);
  if exists(select 1 from public.ball_knower_user_blocks where (blocker_id=me and blocked_id=p_user_id) or (blocker_id=p_user_id and blocked_id=me)) then raise exception 'Friend request is unavailable'; end if;
  insert into public.ball_knower_friendships(requester_id,recipient_id) values(me,p_user_id)
  on conflict(least(requester_id,recipient_id),greatest(requester_id,recipient_id)) do update set updated_at=now()
  returning id into result;
  return result;
end $$;
revoke all on function public.send_ball_knower_friend_request(uuid) from public,anon;
grant execute on function public.send_ball_knower_friend_request(uuid) to authenticated;

create function public.respond_ball_knower_friend_request(p_friendship_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=ball_knower_private.require_permanent_community_user();
begin
  if p_accept then update public.ball_knower_friendships set status='accepted',updated_at=now() where id=p_friendship_id and recipient_id=me and status='pending';
  else delete from public.ball_knower_friendships where id=p_friendship_id and me in(requester_id,recipient_id); end if;
  if not found then raise exception 'Friend request is unavailable'; end if;
end $$;
revoke all on function public.respond_ball_knower_friend_request(uuid,boolean) from public,anon;
grant execute on function public.respond_ball_knower_friend_request(uuid,boolean) to authenticated;

create function public.remove_ball_knower_friend(p_friendship_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=ball_knower_private.require_permanent_community_user();
begin delete from public.ball_knower_friendships where id=p_friendship_id and me in(requester_id,recipient_id); if not found then raise exception 'Friendship is unavailable'; end if; end $$;
revoke all on function public.remove_ball_knower_friend(uuid) from public,anon;
grant execute on function public.remove_ball_knower_friend(uuid) to authenticated;

create function public.set_ball_knower_community_block(p_user_id uuid,p_blocked boolean,p_expected_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());
begin
  if me is null then raise exception 'Sign in to manage blocked managers'; end if;
  if me is distinct from p_expected_user_id then raise exception 'Your account changed. Reopen this screen.'; end if;
  if p_user_id is null or p_user_id=me then raise exception 'Choose another manager'; end if;
  perform ball_knower_private.community_pair_lock(me,p_user_id);
  if p_blocked then
    if not exists(select 1 from public.ball_knower_progress_profiles where user_id=p_user_id)
      and not exists(select 1 from public.ball_knower_league_members a join public.ball_knower_league_members b on b.league_id=a.league_id where a.auth_user_id=me and b.auth_user_id=p_user_id and not a.is_ai and not b.is_ai)
      then raise exception 'Manager is unavailable'; end if;
    insert into public.ball_knower_user_blocks(blocker_id,blocked_id) values(me,p_user_id) on conflict do nothing;
    delete from public.ball_knower_friendships where least(requester_id,recipient_id)=least(me,p_user_id) and greatest(requester_id,recipient_id)=greatest(me,p_user_id);
  else delete from public.ball_knower_user_blocks where blocker_id=me and blocked_id=p_user_id;
  end if;
end $$;
revoke all on function public.set_ball_knower_community_block(uuid,boolean,uuid) from public,anon;
grant execute on function public.set_ball_knower_community_block(uuid,boolean,uuid) to authenticated;

create function public.get_ball_knower_global_messages(p_before timestamptz default null)
returns table(id uuid,author_id uuid,display_name text,body text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare me uuid:=ball_knower_private.require_permanent_community_user();
begin
  return query select m.id,m.author_id,p.display_name,m.body,m.created_at from public.ball_knower_community_messages m
    join public.ball_knower_progress_profiles p on p.user_id=m.author_id
    where m.kind='global' and m.removed_at is null and (p_before is null or m.created_at<p_before)
      and public.ball_knower_can_see_sender(m.author_id)
    order by m.created_at desc limit 75;
end $$;
revoke all on function public.get_ball_knower_global_messages(timestamptz) from public,anon;
grant execute on function public.get_ball_knower_global_messages(timestamptz) to authenticated;

create function public.post_ball_knower_global_message(p_body text)
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=ball_knower_private.require_permanent_community_user(); result uuid; cleaned text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bk-global:'||me::text,0));
  if exists(select 1 from public.ball_knower_community_messages where author_id=me and kind='global' and created_at>now()-interval '3 seconds') then raise exception 'Slow down before sending another message'; end if;
  if (select count(*) from public.ball_knower_community_messages where author_id=me and kind='global' and created_at>now()-interval '1 day')>=200 then raise exception 'Daily chat limit reached'; end if;
  cleaned:=ball_knower_private.community_censor_text(p_body,300);
  insert into public.ball_knower_community_messages(kind,author_id,body) values('global',me,cleaned) returning id into result;
  return result;
end $$;
revoke all on function public.post_ball_knower_global_message(text) from public,anon;
grant execute on function public.post_ball_knower_global_message(text) to authenticated;

create function public.get_ball_knower_direct_messages(p_friend_id uuid)
returns table(id uuid,author_id uuid,recipient_id uuid,body text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare me uuid:=ball_knower_private.require_permanent_community_user();
begin
  if not exists(select 1 from public.ball_knower_friendships where status='accepted' and least(requester_id,recipient_id)=least(me,p_friend_id) and greatest(requester_id,recipient_id)=greatest(me,p_friend_id)) then raise exception 'Only accepted friends can message'; end if;
  return query select m.id,m.author_id,m.recipient_id,m.body,m.created_at from public.ball_knower_community_messages m
    where m.kind='direct' and m.removed_at is null and least(m.author_id,m.recipient_id)=least(me,p_friend_id) and greatest(m.author_id,m.recipient_id)=greatest(me,p_friend_id)
      and public.ball_knower_can_see_sender(m.author_id) order by m.created_at desc limit 100;
end $$;
revoke all on function public.get_ball_knower_direct_messages(uuid) from public,anon;
grant execute on function public.get_ball_knower_direct_messages(uuid) to authenticated;

create function public.send_ball_knower_direct_message(p_friend_id uuid,p_body text)
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=ball_knower_private.require_permanent_community_user(); result uuid; cleaned text;
begin
  perform ball_knower_private.community_pair_lock(me,p_friend_id);
  if not exists(select 1 from public.ball_knower_friendships where status='accepted' and least(requester_id,recipient_id)=least(me,p_friend_id) and greatest(requester_id,recipient_id)=greatest(me,p_friend_id)) then raise exception 'Only accepted friends can message'; end if;
  if exists(select 1 from public.ball_knower_user_blocks where (blocker_id=me and blocked_id=p_friend_id) or (blocker_id=p_friend_id and blocked_id=me)) then raise exception 'Messaging is unavailable'; end if;
  if exists(select 1 from public.ball_knower_community_messages where author_id=me and kind='direct' and recipient_id=p_friend_id and created_at>now()-interval '1 second') then raise exception 'Slow down before sending another message'; end if;
  cleaned:=ball_knower_private.community_censor_text(p_body,1000);
  insert into public.ball_knower_community_messages(kind,author_id,recipient_id,body) values('direct',me,p_friend_id,cleaned) returning id into result;
  return result;
end $$;
revoke all on function public.send_ball_knower_direct_message(uuid,text) from public,anon;
grant execute on function public.send_ball_knower_direct_message(uuid,text) to authenticated;

create function public.report_ball_knower_community_content(p_content_type text,p_content_id uuid,p_reason text,p_details text default '',p_expected_user_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=ball_knower_private.require_permanent_community_user(); author uuid; evidence_text text; result uuid;
begin
  if me is distinct from p_expected_user_id then raise exception 'Your account changed. Reopen this screen.'; end if;
  if p_reason not in ('harassment','hate','sexual','threats','spam','impersonation','rights','other') or length(coalesce(p_details,''))>1000 then raise exception 'Invalid report'; end if;
  if p_content_type in('global_message','community_dm') then
    select m.author_id,m.body into author,evidence_text from public.ball_knower_community_messages m where m.id=p_content_id and m.removed_at is null
      and ((p_content_type='global_message' and m.kind='global') or (p_content_type='community_dm' and m.kind='direct' and me in(m.author_id,m.recipient_id)));
  elsif p_content_type='profile' then
    select p.user_id,p.display_name into author,evidence_text from public.ball_knower_progress_profiles p where p.user_id=p_content_id;
  end if;
  if author is null or author=me then raise exception 'Content is unavailable to report'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bk-community-report:'||me::text,0));
  select id into result from public.ball_knower_community_reports where reporter_id=me and content_type=p_content_type and content_id=p_content_id;
  if result is not null then return result; end if;
  if (select count(*) from public.ball_knower_community_reports where reporter_id=me and created_at>now()-interval '1 day')>=20 then raise exception 'Report limit reached. Contact support.'; end if;
  insert into public.ball_knower_community_reports(reporter_id,subject_id,content_type,content_id,reason,details,evidence)
    values(me,author,p_content_type,p_content_id,p_reason,coalesce(p_details,''),left(coalesce(evidence_text,''),2000)) returning id into result;
  return result;
end $$;
revoke all on function public.report_ball_knower_community_content(text,uuid,text,text,uuid) from public,anon;
grant execute on function public.report_ball_knower_community_content(text,uuid,text,text,uuid) to authenticated;

create function public.start_ball_knower_h2h(p_opponent_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=ball_knower_private.require_permanent_community_user(); result uuid; waiting uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bk-h2h-matchmaker',0));
  update public.ball_knower_h2h_matches set status='cancelled',finished_at=now() where status in('waiting','pending') and created_at<now()-interval '10 minutes';
  if exists(select 1 from public.ball_knower_h2h_matches where status in('waiting','pending','active') and me in(challenger_id,opponent_id)) then raise exception 'Finish or cancel your current H2H first'; end if;
  if p_opponent_id is not null then
    if not exists(select 1 from public.ball_knower_friendships where status='accepted' and least(requester_id,recipient_id)=least(me,p_opponent_id) and greatest(requester_id,recipient_id)=greatest(me,p_opponent_id)) then raise exception 'Only accepted friends can be challenged'; end if;
    insert into public.ball_knower_h2h_matches(challenger_id,opponent_id,match_type,status) values(me,p_opponent_id,'friend','pending') returning id into result;
    return result;
  end if;
  select id into waiting from public.ball_knower_h2h_matches m where m.status='waiting' and m.challenger_id<>me
    and not exists(select 1 from public.ball_knower_user_blocks b where (b.blocker_id=me and b.blocked_id=m.challenger_id) or (b.blocker_id=m.challenger_id and b.blocked_id=me))
    order by m.created_at for update skip locked limit 1;
  if waiting is null then insert into public.ball_knower_h2h_matches(challenger_id,match_type,status) values(me,'quick','waiting') returning id into result; return result; end if;
  update public.ball_knower_h2h_matches set opponent_id=me,status='active',started_at=now() where id=waiting returning id into result;
  perform ball_knower_private.seed_h2h(result);
  return result;
end $$;
revoke all on function public.start_ball_knower_h2h(uuid) from public,anon;
grant execute on function public.start_ball_knower_h2h(uuid) to authenticated;

create function public.respond_ball_knower_h2h(p_match_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=ball_knower_private.require_permanent_community_user();
begin
  if p_accept then
    update public.ball_knower_h2h_matches set status='active',started_at=now() where id=p_match_id and opponent_id=me and status='pending';
    if not found then raise exception 'Challenge is unavailable'; end if;
    perform ball_knower_private.seed_h2h(p_match_id);
  else update public.ball_knower_h2h_matches set status='declined',finished_at=now() where id=p_match_id and opponent_id=me and status='pending'; if not found then raise exception 'Challenge is unavailable'; end if;
  end if;
end $$;
revoke all on function public.respond_ball_knower_h2h(uuid,boolean) from public,anon;
grant execute on function public.respond_ball_knower_h2h(uuid,boolean) to authenticated;

create function public.cancel_ball_knower_h2h(p_match_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=ball_knower_private.require_permanent_community_user();
begin update public.ball_knower_h2h_matches set status='cancelled',finished_at=now() where id=p_match_id and status in('waiting','pending') and challenger_id=me; if not found then raise exception 'Match cannot be cancelled'; end if; end $$;
revoke all on function public.cancel_ball_knower_h2h(uuid) from public,anon;
grant execute on function public.cancel_ball_knower_h2h(uuid) to authenticated;

create function public.get_ball_knower_h2h_match(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me uuid:=ball_knower_private.require_permanent_community_user(); m public.ball_knower_h2h_matches%rowtype;
begin
  select * into m from public.ball_knower_h2h_matches where id=p_match_id and me in(challenger_id,opponent_id);
  if not found then raise exception 'Match is unavailable'; end if;
  return jsonb_build_object('id',m.id,'challenger_id',m.challenger_id,'opponent_id',m.opponent_id,'match_type',m.match_type,'status',m.status,'duration_seconds',m.duration_seconds,'challenger_score',m.challenger_score,'opponent_score',m.opponent_score,'winner_id',m.winner_id,'started_at',m.started_at,'finished_at',m.finished_at,
    'challenger_name',(select display_name from public.ball_knower_progress_profiles where user_id=m.challenger_id),'opponent_name',(select display_name from public.ball_knower_progress_profiles where user_id=m.opponent_id),
    'questions',coalesce((select jsonb_agg(jsonb_build_object('ordinal',hq.ordinal,'tier',q.tier,'question',q.question,'answers',q.answers,'answered',a.ordinal is not null) order by hq.ordinal)
      from ball_knower_private.h2h_questions hq join ball_knower_private.trivia_questions q on q.id=hq.question_id
      left join ball_knower_private.h2h_answers a on a.match_id=hq.match_id and a.ordinal=hq.ordinal and a.user_id=me where hq.match_id=m.id),'[]'::jsonb));
end $$;
revoke all on function public.get_ball_knower_h2h_match(uuid) from public,anon;
grant execute on function public.get_ball_knower_h2h_match(uuid) to authenticated;

create function public.submit_ball_knower_h2h_answer(p_match_id uuid,p_ordinal smallint,p_selected_index smallint)
returns table(is_correct boolean,my_score integer) language plpgsql security definer set search_path='' as $$
declare me uuid:=ball_knower_private.require_permanent_community_user(); m public.ball_knower_h2h_matches%rowtype; answer_correct boolean;
begin
  select * into m from public.ball_knower_h2h_matches where id=p_match_id for update;
  if not found or me not in(m.challenger_id,m.opponent_id) or m.status<>'active' then raise exception 'Match is not active'; end if;
  if now()>=m.started_at+make_interval(secs=>m.duration_seconds) then raise exception 'Time expired'; end if;
  if p_selected_index not between 0 and 3 then raise exception 'Choose a valid answer'; end if;
  select q.correct_index=p_selected_index into answer_correct from ball_knower_private.h2h_questions hq join ball_knower_private.trivia_questions q on q.id=hq.question_id where hq.match_id=p_match_id and hq.ordinal=p_ordinal;
  if answer_correct is null then raise exception 'Question is unavailable'; end if;
  insert into ball_knower_private.h2h_answers(match_id,ordinal,user_id,selected_index,is_correct) values(p_match_id,p_ordinal,me,p_selected_index,answer_correct);
  if me=m.challenger_id then update public.ball_knower_h2h_matches set challenger_score=challenger_score+(answer_correct::integer) where id=p_match_id returning challenger_score into my_score;
  else update public.ball_knower_h2h_matches set opponent_score=opponent_score+(answer_correct::integer) where id=p_match_id returning opponent_score into my_score; end if;
  is_correct:=answer_correct; return next;
exception when unique_violation then raise exception 'Question already answered';
end $$;
revoke all on function public.submit_ball_knower_h2h_answer(uuid,smallint,smallint) from public,anon;
grant execute on function public.submit_ball_knower_h2h_answer(uuid,smallint,smallint) to authenticated;

create function public.finish_ball_knower_h2h(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=ball_knower_private.require_permanent_community_user(); m public.ball_knower_h2h_matches%rowtype; victor uuid; total integer;
begin
  select * into m from public.ball_knower_h2h_matches where id=p_match_id for update;
  if not found or me not in(m.challenger_id,m.opponent_id) then raise exception 'Match is unavailable'; end if;
  if m.status='completed' then return public.get_ball_knower_h2h_match(p_match_id); end if;
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
  return public.get_ball_knower_h2h_match(p_match_id);
end $$;
revoke all on function public.finish_ball_knower_h2h(uuid) from public,anon;
grant execute on function public.finish_ball_knower_h2h(uuid) to authenticated;

create function public.get_ball_knower_community_profile(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me uuid:=ball_knower_private.require_permanent_community_user();
begin
  if not public.ball_knower_can_see_sender(p_user_id) then raise exception 'Profile is unavailable'; end if;
  return jsonb_build_object('profile',(select to_jsonb(p) from public.ball_knower_progress_profiles p join auth.users u on u.id=p.user_id where p.user_id=p_user_id and not coalesce(u.is_anonymous,false)),
    'events','[]'::jsonb,'achievements',coalesce((select jsonb_agg(jsonb_build_object('achievement_key',c.achievement_key,'title',c.title,'description',c.description,'category',c.category,'tier',c.tier,'xp_reward',c.xp_reward,'unlocked_at',a.unlocked_at)) from public.ball_knower_achievement_catalog c left join public.ball_knower_user_achievements a on a.achievement_key=c.achievement_key and a.user_id=p_user_id),'[]'::jsonb),'prediction_picks','[]'::jsonb);
end $$;
revoke all on function public.get_ball_knower_community_profile(uuid) from public,anon;
grant execute on function public.get_ball_knower_community_profile(uuid) to authenticated;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ball_knower_community_messages') then
    alter publication supabase_realtime add table public.ball_knower_community_messages;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ball_knower_h2h_matches') then
    alter publication supabase_realtime add table public.ball_knower_h2h_matches;
  end if;
end $$;
