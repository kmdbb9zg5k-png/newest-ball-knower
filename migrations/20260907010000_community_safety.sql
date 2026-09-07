-- Additive community controls. No roster, score, draft or saved-career mutation.
-- Existing membership/participant RLS remains authoritative; new read policies
-- are RESTRICTIVE so they cannot accidentally widen access.
create schema if not exists ball_knower_private;

create table public.ball_knower_user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index bk_user_blocks_target_idx on public.ball_knower_user_blocks(blocked_id,blocker_id);
alter table public.ball_knower_user_blocks enable row level security;
revoke all on public.ball_knower_user_blocks from public, anon, authenticated;
grant select on public.ball_knower_user_blocks to authenticated;
grant all on public.ball_knower_user_blocks to service_role;
create policy bk_blocks_owner_read on public.ball_knower_user_blocks for select to authenticated
  using (blocker_id = (select auth.uid()));

create table public.ball_knower_content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null check(content_type in ('league_message','dm_message','trade_message','profile')),
  content_id uuid not null,
  league_id text not null references public.ball_knower_leagues(id) on delete cascade,
  reason text not null check(reason in ('harassment','hate','sexual','threats','spam','impersonation','rights','other')),
  details text not null default '' check(length(details)<=1000),
  evidence text not null check(length(evidence)<=2000),
  status text not null default 'open' check(status in ('open','dismissed','removed','suspended')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  moderator_note text check(length(moderator_note)<=2000),
  unique(reporter_id,content_type,content_id)
);
create index bk_reports_queue_idx on public.ball_knower_content_reports(status,created_at);
create index bk_reports_subject_idx on public.ball_knower_content_reports(subject_id);
alter table public.ball_knower_content_reports enable row level security;
revoke all on public.ball_knower_content_reports from public,anon,authenticated;
grant select on public.ball_knower_content_reports to authenticated;
grant all on public.ball_knower_content_reports to service_role;
create policy bk_reports_owner_read on public.ball_knower_content_reports for select to authenticated
  using (reporter_id = (select auth.uid()));

-- Only service-role moderation may impose or lift a community suspension.
create table ball_knower_private.community_suspensions (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
revoke all on ball_knower_private.community_suspensions from public,anon,authenticated;
grant usage on schema ball_knower_private to service_role;
grant all on ball_knower_private.community_suspensions to service_role;

create function ball_knower_private.community_pair_lock(a uuid,b uuid)
returns void language sql volatile security definer set search_path='' as $$
  select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(least(a,b)::text||':'||greatest(a,b)::text,0))
$$;
revoke all on function ball_knower_private.community_pair_lock(uuid,uuid) from public,anon,authenticated;

create function public.set_ball_knower_user_block(p_user_id uuid,p_blocked boolean,p_expected_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid());
begin
  if me is distinct from p_expected_user_id then raise exception 'Your account changed. Reopen this screen.'; end if;
  if me is null or p_user_id is null or p_user_id=me or p_blocked is null then
    raise exception 'Choose another manager while signed in';
  end if;
  perform ball_knower_private.community_pair_lock(me,p_user_id);
  if not p_blocked then
    delete from public.ball_knower_user_blocks where blocker_id=me and blocked_id=p_user_id;
    return;
  end if;
  if not exists(select 1 from public.ball_knower_league_members a
    join public.ball_knower_league_members b on b.league_id=a.league_id
    where a.auth_user_id=me and b.auth_user_id=p_user_id and not a.is_ai and not b.is_ai) then
    raise exception 'Shared league membership required';
  end if;
  insert into public.ball_knower_user_blocks(blocker_id,blocked_id) values(me,p_user_id)
    on conflict do nothing;
end $$;
revoke all on function public.set_ball_knower_user_block(uuid,boolean,uuid) from public,anon;
grant execute on function public.set_ball_knower_user_block(uuid,boolean,uuid) to authenticated;

create function public.ball_knower_can_see_sender(p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and (p_user_id is null or p_user_id=(select auth.uid()) or (
    not exists(select 1 from public.ball_knower_user_blocks where blocker_id=(select auth.uid()) and blocked_id=p_user_id)
    and not exists(select 1 from ball_knower_private.community_suspensions where auth_user_id=p_user_id and expires_at>now())
  ))
$$;
revoke all on function public.ball_knower_can_see_sender(uuid) from public,anon;
grant execute on function public.ball_knower_can_see_sender(uuid) to authenticated;

create policy bk_league_messages_safety_read on public.ball_knower_league_messages as restrictive
  for select to authenticated using(public.ball_knower_can_see_sender(auth_user_id));
create policy bk_dm_messages_safety_read on public.ball_knower_dm_messages as restrictive
  for select to authenticated using(public.ball_knower_can_see_sender(sender_auth_id));
create policy bk_trade_messages_safety_read on public.ball_knower_trade_messages as restrictive
  for select to authenticated using(public.ball_knower_can_see_sender(sender_auth_id));

-- A baseline server-side text filter, supplemented by reports/human review.
-- Never market a small phrase filter as exhaustive content moderation.
create function ball_knower_private.community_text_allowed(p_body text)
returns boolean language sql immutable set search_path='' as $$
  select coalesce(length(btrim(p_body)) between 1 and 1000,false)
    and regexp_replace(lower(coalesce(p_body,'')), '[[:space:][:punct:]]+', ' ', 'g')
      !~ '(kill yourself|i will kill you|child porn|rape you|heil hitler|white power|nigger|faggot)'
$$;
revoke all on function ball_knower_private.community_text_allowed(text) from public,anon,authenticated;

create function ball_knower_private.enforce_community_message_safety()
returns trigger language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid()); sender_id uuid; other_id uuid; a uuid; b uuid; league text;
begin
  if tg_table_name='ball_knower_league_messages' then
    sender_id:=new.auth_user_id;
    league:=new.league_id;
  elsif tg_table_name='ball_knower_dm_messages' then
    sender_id:=new.sender_auth_id;
    select t.participant_a,t.participant_b,t.league_id into a,b,league
      from public.ball_knower_dm_threads t where t.id=new.thread_id;
    if sender_id is distinct from a and sender_id is distinct from b then raise exception 'Private thread access denied'; end if;
    other_id:=case when sender_id=a then b else a end;
  elsif tg_table_name='ball_knower_trade_messages' then
    sender_id:=new.sender_auth_id;
    select p.auth_user_id,r.auth_user_id,t.league_id into a,b,league
      from public.ball_knower_trades t
      join public.ball_knower_league_members p on p.id=t.proposer_member_id
      join public.ball_knower_league_members r on r.id=t.recipient_member_id
      where t.id=new.trade_id;
    if sender_id is distinct from a and sender_id is distinct from b then raise exception 'Trade thread access denied'; end if;
    other_id:=case when sender_id=a then b else a end;
  else raise exception 'Unexpected community message table'; end if;
  -- Background system receipts have no human author; preserve them.
  if sender_id is null and me is null and tg_table_name='ball_knower_league_messages' then return new; end if;
  if me is not null and sender_id is distinct from me then raise exception 'Message author does not match signed-in user'; end if;
  if sender_id is null or not exists(select 1 from public.ball_knower_league_members m
    where m.league_id=league and m.auth_user_id=sender_id and not m.is_ai) then
    raise exception 'Current league membership required';
  end if;
  if exists(select 1 from ball_knower_private.community_suspensions where auth_user_id=sender_id and expires_at>now()) then
    raise exception 'Community messaging is suspended; contact support';
  end if;
  if (tg_op='INSERT' or new.body is distinct from old.body) and not ball_knower_private.community_text_allowed(new.body) then
    raise exception 'Message cannot be posted. Follow the community guidelines.';
  end if;
  if other_id is not null then
    perform ball_knower_private.community_pair_lock(sender_id,other_id);
    if exists(select 1 from public.ball_knower_user_blocks
      where (blocker_id=sender_id and blocked_id=other_id) or (blocker_id=other_id and blocked_id=sender_id)) then
      raise exception 'Messaging is not available between these managers';
    end if;
  end if;
  return new;
end $$;
revoke all on function ball_knower_private.enforce_community_message_safety() from public,anon,authenticated;
create trigger bk_league_message_safety before insert or update on public.ball_knower_league_messages
  for each row execute function ball_knower_private.enforce_community_message_safety();
create trigger bk_dm_message_safety before insert or update on public.ball_knower_dm_messages
  for each row execute function ball_knower_private.enforce_community_message_safety();
create trigger bk_trade_message_safety before insert or update on public.ball_knower_trade_messages
  for each row execute function ball_knower_private.enforce_community_message_safety();

create function public.report_ball_knower_content(p_content_type text,p_content_id uuid,p_reason text,p_details text default '',p_expected_user_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid()); author_id uuid; league text; content text; report_id uuid;
begin
  if me is null then raise exception 'Sign in to report content'; end if;
  if me is distinct from p_expected_user_id then raise exception 'Your account changed. Reopen this screen.'; end if;
  if p_reason is null or p_reason not in ('harassment','hate','sexual','threats','spam','impersonation','rights','other')
    or length(coalesce(p_details,''))>1000 then raise exception 'Invalid report reason or details'; end if;
  -- Resolve evidence and author on the server, never from caller-provided text.
  if p_content_type='league_message' then
    select m.auth_user_id,m.league_id,m.body into author_id,league,content from public.ball_knower_league_messages m
      where m.id=p_content_id and exists(select 1 from public.ball_knower_league_members a where a.league_id=m.league_id and a.auth_user_id=me and not a.is_ai);
  elsif p_content_type='dm_message' then
    select m.sender_auth_id,t.league_id,m.body into author_id,league,content
      from public.ball_knower_dm_messages m join public.ball_knower_dm_threads t on t.id=m.thread_id
      where m.id=p_content_id and me in(t.participant_a,t.participant_b)
      and exists(select 1 from public.ball_knower_league_members a where a.league_id=t.league_id and a.auth_user_id=me and not a.is_ai);
  elsif p_content_type='trade_message' then
    select m.sender_auth_id,t.league_id,m.body into author_id,league,content
      from public.ball_knower_trade_messages m join public.ball_knower_trades t on t.id=m.trade_id
      join public.ball_knower_league_members a on a.id=t.proposer_member_id
      join public.ball_knower_league_members b on b.id=t.recipient_member_id
      where m.id=p_content_id and me in(a.auth_user_id,b.auth_user_id)
      and exists(select 1 from public.ball_knower_league_members own where own.league_id=t.league_id and own.auth_user_id=me and not own.is_ai);
  elsif p_content_type='profile' then
    select b.auth_user_id,b.league_id,b.user_name||' · '||coalesce(b.user_avatar,'No avatar') into author_id,league,content
      from public.ball_knower_league_members a join public.ball_knower_league_members b on b.league_id=a.league_id
      where a.auth_user_id=me and b.auth_user_id=p_content_id and not a.is_ai and not b.is_ai
      order by b.league_id limit 1;
  end if;
  if author_id is null or author_id=me or league is null then raise exception 'Content is unavailable to report'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('community-report:'||me::text,0));
  select id into report_id from public.ball_knower_content_reports where reporter_id=me and content_type=p_content_type and content_id=p_content_id;
  if report_id is not null then return report_id; end if;
  if (select count(*) from public.ball_knower_content_reports where reporter_id=me and created_at>now()-interval '1 day')>=20 then
    raise exception 'Report limit reached. Contact support for additional concerns.';
  end if;
  insert into public.ball_knower_content_reports(reporter_id,subject_id,content_type,content_id,league_id,reason,details,evidence)
    values(me,author_id,p_content_type,p_content_id,league,p_reason,coalesce(p_details,''),left(coalesce(content,''),2000)) returning id into report_id;
  return report_id;
end $$;
revoke all on function public.report_ball_knower_content(text,uuid,text,text,uuid) from public,anon;
grant execute on function public.report_ball_knower_content(text,uuid,text,text,uuid) to authenticated;

create function public.moderate_ball_knower_report(p_report_id uuid,p_action text,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare report public.ball_knower_content_reports%rowtype;
begin
  if p_action is null or p_action not in ('dismiss','remove','suspend') or length(coalesce(p_note,'')) not between 1 and 2000 then
    raise exception 'A moderation action and review note are required';
  end if;
  select * into report from public.ball_knower_content_reports where id=p_report_id for update;
  if not found then raise exception 'Report not found'; end if;
  if p_action='remove' then
    if report.content_type='league_message' then delete from public.ball_knower_league_messages where id=report.content_id;
    elsif report.content_type='dm_message' then delete from public.ball_knower_dm_messages where id=report.content_id;
    elsif report.content_type='trade_message' then delete from public.ball_knower_trade_messages where id=report.content_id;
    else raise exception 'Profile reports require storage/profile review by support; do not mark removed prematurely';
    end if;
  elsif p_action='suspend' then
    insert into ball_knower_private.community_suspensions(auth_user_id,reason,expires_at)
      values(report.subject_id,p_note,now()+interval '30 days') on conflict(auth_user_id)
      do update set reason=excluded.reason,expires_at=excluded.expires_at;
  end if;
  update public.ball_knower_content_reports set status=case p_action when 'dismiss' then 'dismissed' when 'remove' then 'removed' else 'suspended' end,
    moderator_note=p_note,reviewed_at=now() where id=report.id;
end $$;
revoke all on function public.moderate_ball_knower_report(uuid,text,text) from public,anon,authenticated;
grant execute on function public.moderate_ball_knower_report(uuid,text,text) to service_role;
