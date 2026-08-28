-- Scheduled drafts are server-owned: reminders and the opening pick happen even
-- when no browser or mobile app is open. The existing minute cron invokes this
-- processor before waiver and disconnect-recovery work.

create table if not exists ball_knower_private.scheduled_draft_receipts (
  league_id text not null references public.ball_knower_leagues(id) on delete cascade,
  event text not null check (event in ('ten_minute','one_minute','started','blocked')),
  created_at timestamptz not null default now(),
  primary key (league_id,event)
);

alter table ball_knower_private.scheduled_draft_receipts enable row level security;
revoke all on table ball_knower_private.scheduled_draft_receipts from public,anon,authenticated;

create or replace function public.ball_knower_enforce_notification_target()
returns trigger
language plpgsql
set search_path='public'
as $$
declare
  v_requester uuid:=public.fantasy_requester_id();
  v_authorized_operation text:=current_setting('ball_knower.authorized_notification_operation',true);
begin
  if coalesce(v_authorized_operation,'')='system' then
    if new.league_id is null or not exists(
      select 1 from public.ball_knower_league_members m
      where m.league_id=new.league_id and m.auth_user_id=new.auth_user_id and not coalesce(m.is_ai,false)
    ) then raise exception 'System notification recipient is not a human league member'; end if;
    return new;
  end if;
  if v_requester is null then raise exception 'Authentication required'; end if;
  if new.league_id is null then
    if new.auth_user_id<>v_requester then raise exception 'Cannot create a notification for another user'; end if;
    return new;
  end if;
  if new.auth_user_id=v_requester then
    if not public.can_access_ball_knower_league(new.league_id) then raise exception 'League access required'; end if;
    return new;
  end if;
  if not public.is_ball_knower_commissioner(new.league_id) then raise exception 'Commissioner access required for league notification fanout'; end if;
  if not exists(
    select 1 from public.ball_knower_league_members m
    where m.league_id=new.league_id and m.auth_user_id=new.auth_user_id and not coalesce(m.is_ai,false)
  ) then raise exception 'Notification recipient is not a human member of this league'; end if;
  return new;
end;
$$;

create or replace function public.start_ball_knower_live_draft(p_league_id text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_auth uuid := (select auth.uid());
  v_league public.ball_knower_leagues%rowtype;
  v_order jsonb;
  v_member_count integer;
  v_human_count integer;
  v_ready_count integer;
  v_scheduled_at timestamptz;
  v_draft public.ball_knower_live_drafts%rowtype;
begin
  if v_auth is null then raise exception 'Authentication required'; end if;

  select * into v_league from public.ball_knower_leagues where id=p_league_id for update;
  if not found then raise exception 'League not found'; end if;
  if not exists(select 1 from public.ball_knower_league_members where league_id=p_league_id and auth_user_id=v_auth and is_ai=false) then raise exception 'Only league members can start the fantasy draft'; end if;
  if v_league.status<>'completed' or v_league.season_result is null then raise exception 'Lock the official draft order before starting the fantasy draft'; end if;

  v_scheduled_at:=nullif(v_league.settings->>'draftScheduledAt','')::timestamptz;
  if v_scheduled_at is not null and now()<v_scheduled_at then raise exception 'The fantasy draft is scheduled for %',v_scheduled_at; end if;

  select count(*) filter(where is_ai=false),count(*) filter(where is_ai=false and live_draft_ready=true),count(*)
  into v_human_count,v_ready_count,v_member_count
  from public.ball_knower_league_members where league_id=p_league_id;

  if v_human_count=1 and v_league.commissioner_auth_id=v_auth then
    update public.ball_knower_league_members set live_draft_ready=true
    where league_id=p_league_id and auth_user_id=v_auth and is_ai=false;
    v_ready_count:=1;
    update public.ball_knower_leagues
    set draft_countdown_started_at=coalesce(draft_countdown_started_at,now()-interval '30 seconds'),updated_at=now()
    where id=p_league_id returning * into v_league;
  end if;

  -- Unscheduled drafts retain the Ready + 30-second countdown flow. A scheduled
  -- draft starts at its saved instant whether or not every manager checked in.
  if v_scheduled_at is null then
    if v_human_count<1 or v_ready_count<>v_human_count then raise exception 'Every human manager must be ready before the fantasy draft starts'; end if;
    if v_league.draft_countdown_started_at is null then raise exception 'The 30-second draft countdown has not started'; end if;
    if now()<v_league.draft_countdown_started_at+interval '30 seconds' then raise exception 'The 30-second draft countdown is still running'; end if;
  elsif v_human_count<1 then
    raise exception 'At least one human manager is required';
  end if;

  select jsonb_agg(to_jsonb(pick->>'memberId') order by (pick->>'pickNumber')::integer)
  into v_order from jsonb_array_elements(coalesce(v_league.season_result->'draftOrder','[]'::jsonb)) pick;
  if v_order is null or jsonb_array_length(v_order)<>v_member_count or v_member_count<2 then raise exception 'The locked draft order does not match the league members'; end if;

  insert into public.ball_knower_live_drafts(league_id,status,order_member_ids,rounds,pick_index,picks)
  values(p_league_id,'active',v_order,15,0,'[]'::jsonb)
  on conflict(league_id) do nothing returning * into v_draft;
  if not found then select * into v_draft from public.ball_knower_live_drafts where league_id=p_league_id; end if;
  return to_jsonb(v_draft);
end;
$function$;

revoke all on function public.start_ball_knower_live_draft(text) from public,anon;
grant execute on function public.start_ball_knower_live_draft(text) to authenticated,service_role;

create or replace function public.process_due_ball_knower_scheduled_drafts(
  p_now timestamptz default now(),
  p_league_id text default null
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_league public.ball_knower_leagues%rowtype;
  v_scheduled_at timestamptz;
  v_order jsonb;
  v_member_count integer;
  v_inserted integer;
  v_reminders integer:=0;
  v_started integer:=0;
  v_blocked integer:=0;
begin
  perform set_config('ball_knower.authorized_notification_operation','system',true);
  for v_league in
    select l.* from public.ball_knower_leagues l
    where nullif(l.settings->>'draftScheduledAt','') is not null
      and (p_league_id is null or l.id=p_league_id)
      and not exists(select 1 from public.ball_knower_live_drafts d where d.league_id=l.id)
    order by l.id for update skip locked
  loop
    begin
      v_scheduled_at:=(v_league.settings->>'draftScheduledAt')::timestamptz;
    exception when others then
      continue;
    end;

    if p_now>=v_scheduled_at-interval '10 minutes' and p_now<v_scheduled_at then
      insert into ball_knower_private.scheduled_draft_receipts(league_id,event)
      values(v_league.id,'ten_minute') on conflict do nothing;
      get diagnostics v_inserted=row_count;
      if v_inserted>0 then
        insert into public.ball_knower_notifications(league_id,auth_user_id,title,body,kind)
        select v_league.id,m.auth_user_id,'Draft starts in 10 minutes','Open Ball Knower, confirm your queue, and get ready. The draft starts automatically.','draft_reminder'
        from public.ball_knower_league_members m where m.league_id=v_league.id and not m.is_ai and m.auth_user_id is not null;
        v_reminders:=v_reminders+1;
      end if;
    end if;

    if p_now>=v_scheduled_at-interval '1 minute' and p_now<v_scheduled_at then
      insert into ball_knower_private.scheduled_draft_receipts(league_id,event)
      values(v_league.id,'one_minute') on conflict do nothing;
      get diagnostics v_inserted=row_count;
      if v_inserted>0 then
        insert into public.ball_knower_notifications(league_id,auth_user_id,title,body,kind)
        select v_league.id,m.auth_user_id,'Draft starts in 1 minute','Your draft room is about to open. Missed picks will use your queue and autopick.','draft_reminder'
        from public.ball_knower_league_members m where m.league_id=v_league.id and not m.is_ai and m.auth_user_id is not null;
        v_reminders:=v_reminders+1;
      end if;
    end if;

    if p_now<v_scheduled_at then continue; end if;

    select count(*) into v_member_count from public.ball_knower_league_members where league_id=v_league.id;
    select jsonb_agg(to_jsonb(pick->>'memberId') order by (pick->>'pickNumber')::integer)
    into v_order from jsonb_array_elements(coalesce(v_league.season_result->'draftOrder','[]'::jsonb)) pick;

    if v_league.status<>'completed' or v_league.season_result is null or v_order is null
       or jsonb_array_length(v_order)<>v_member_count or v_member_count<2 then
      insert into ball_knower_private.scheduled_draft_receipts(league_id,event)
      values(v_league.id,'blocked') on conflict do nothing;
      get diagnostics v_inserted=row_count;
      if v_inserted>0 and v_league.commissioner_auth_id is not null then
        insert into public.ball_knower_notifications(league_id,auth_user_id,title,body,kind)
        values(v_league.id,v_league.commissioner_auth_id,'Scheduled draft needs attention','The draft could not open because its order or league membership is not finalized.','draft_blocked');
        v_blocked:=v_blocked+1;
      end if;
      continue;
    end if;

    update public.ball_knower_leagues
    set draft_countdown_started_at=coalesce(draft_countdown_started_at,v_scheduled_at-interval '30 seconds'),updated_at=p_now
    where id=v_league.id;

    insert into public.ball_knower_live_drafts(league_id,status,order_member_ids,rounds,pick_index,picks,started_at,updated_at)
    values(v_league.id,'active',v_order,15,0,'[]'::jsonb,p_now,p_now)
    on conflict(league_id) do nothing;
    get diagnostics v_inserted=row_count;
    if v_inserted>0 then
      insert into ball_knower_private.scheduled_draft_receipts(league_id,event)
      values(v_league.id,'started') on conflict do nothing;
      insert into public.ball_knower_notifications(league_id,auth_user_id,title,body,kind)
      select v_league.id,m.auth_user_id,'Your fantasy draft is live','Open the draft room now. Each pick has 60 seconds before queue/autopick takes over.','draft_started'
      from public.ball_knower_league_members m where m.league_id=v_league.id and not m.is_ai and m.auth_user_id is not null;
      v_started:=v_started+1;
    end if;
  end loop;
  return jsonb_build_object('reminders',v_reminders,'started',v_started,'blocked',v_blocked,'processedAt',p_now);
end;
$$;

revoke all on function public.process_due_ball_knower_scheduled_drafts(timestamptz,text) from public,anon,authenticated;
grant execute on function public.process_due_ball_knower_scheduled_drafts(timestamptz,text) to service_role;
