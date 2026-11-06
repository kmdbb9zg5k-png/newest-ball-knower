-- Permanent-account push registry. Raw endpoints/tokens never enter the public Data API.
create schema if not exists ball_knower_private;
create table if not exists ball_knower_private.push_settings (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  quiet_enabled boolean not null default false,
  time_zone text not null default 'UTC',
  start_minute integer not null default 1320 check (start_minute between 0 and 1439),
  end_minute integer not null default 420 check (end_minute between 0 and 1439),
  updated_at timestamptz not null default clock_timestamp(),
  check (start_minute <> end_minute)
);
-- Intents retain disabled tombstones even when no first subscription was created.
create table if not exists ball_knower_private.push_installation_intents (
  installation_id uuid primary key,
  installation_secret_hash text not null check (installation_secret_hash ~ '^[a-f0-9]{64}$'),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references auth.sessions(id) on delete cascade,
  revision bigint not null check (revision between 1 and 9007199254740991),
  intent_id uuid not null,
  enabled boolean not null,
  epoch uuid not null default gen_random_uuid(),
  epoch_required boolean not null default false
);
create index if not exists push_intents_session_idx on ball_knower_private.push_installation_intents(session_id);
create index if not exists push_intents_owner_idx on ball_knower_private.push_installation_intents(auth_user_id);
create table if not exists ball_knower_private.push_devices (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references auth.sessions(id) on delete cascade,
  installation_id uuid not null unique references ball_knower_private.push_installation_intents(installation_id) on delete cascade,
  installation_secret_hash text not null check (installation_secret_hash ~ '^[a-f0-9]{64}$'),
  transport text not null check (transport in ('web','apns')),
  endpoint_hash text not null unique check (endpoint_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb not null,
  label text not null default 'My device' check (length(label) between 1 and 60),
  created_at timestamptz not null default clock_timestamp(),
  last_seen_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz
);
create index if not exists push_devices_session_idx on ball_knower_private.push_devices(session_id);
create index if not exists push_devices_owner_idx on ball_knower_private.push_devices(auth_user_id, revoked_at);
create table if not exists ball_knower_private.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.ball_knower_notifications(id) on delete cascade,
  device_id uuid not null references ball_knower_private.push_devices(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  context jsonb not null default '{}',
  state text not null default 'pending' check (state in ('pending','leased','accepted','suppressed','failed')),
  attempts integer not null default 0 check (attempts between 0 and 5),
  available_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  lease_until timestamptz,
  claim_token uuid,
  outcome_code text,
  provider_id text,
  accepted_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (notification_id, device_id)
);
create index if not exists push_deliveries_due_idx on ball_knower_private.push_deliveries(available_at, created_at) where state in ('pending','leased');
create index if not exists push_deliveries_device_idx on ball_knower_private.push_deliveries(device_id);
create index if not exists push_deliveries_owner_idx on ball_knower_private.push_deliveries(auth_user_id);
alter table ball_knower_private.push_settings enable row level security;
alter table ball_knower_private.push_devices enable row level security;
alter table ball_knower_private.push_installation_intents enable row level security;
alter table ball_knower_private.push_deliveries enable row level security;
revoke all on ball_knower_private.push_settings, ball_knower_private.push_installation_intents, ball_knower_private.push_devices, ball_knower_private.push_deliveries from public, anon, authenticated;
grant usage on schema ball_knower_private to service_role;
grant all on ball_knower_private.push_settings, ball_knower_private.push_installation_intents, ball_knower_private.push_devices, ball_knower_private.push_deliveries to service_role;
-- Invoker RPCs below are callable only by the trusted server after auth.getUser.
grant select on public.ball_knower_notifications, public.ball_knower_notification_preferences, public.ball_knower_league_members, public.ball_knower_live_drafts, public.ball_knower_leagues to service_role;
grant select (id,is_anonymous) on auth.users to service_role;
grant select (id,user_id) on auth.sessions to service_role;

create or replace function public.manage_ball_knower_push(p_owner uuid,p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $function$
declare v_device ball_knower_private.push_devices%rowtype; v_id uuid; v_settings ball_knower_private.push_settings%rowtype; v_result jsonb; v_hash text; v_intent ball_knower_private.push_installation_intents%rowtype; v_revision bigint; v_intent_id uuid;
begin
  if current_user <> 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  if not exists(select 1 from auth.users where id=p_owner and not coalesce(is_anonymous,false)) then raise exception 'Permanent account required' using errcode='42501'; end if;
  if not exists(select 1 from auth.sessions where id=(p_data->>'sessionId')::uuid and user_id=p_owner) then raise exception 'Active session required' using errcode='28000'; end if;
  if p_action='settings' then
    select * into v_settings from ball_knower_private.push_settings where auth_user_id=p_owner;
    return jsonb_build_object('quietEnabled',coalesce(v_settings.quiet_enabled,false),'timeZone',coalesce(v_settings.time_zone,'UTC'),'startMinute',coalesce(v_settings.start_minute,1320),'endMinute',coalesce(v_settings.end_minute,420));
  elsif p_action='save-settings' then
    if jsonb_typeof(p_data->'quietEnabled') is distinct from 'boolean' or length(p_data->>'timeZone') not between 1 and 80 or (p_data->>'startMinute')::integer not between 0 and 1439 or (p_data->>'endMinute')::integer not between 0 and 1439 or (p_data->>'startMinute')::integer=(p_data->>'endMinute')::integer then raise exception 'Invalid quiet interval' using errcode='22023'; end if;
    insert into ball_knower_private.push_settings(auth_user_id,quiet_enabled,time_zone,start_minute,end_minute) values(p_owner,(p_data->>'quietEnabled')::boolean,p_data->>'timeZone',(p_data->>'startMinute')::integer,(p_data->>'endMinute')::integer)
    on conflict(auth_user_id) do update set quiet_enabled=excluded.quiet_enabled,time_zone=excluded.time_zone,start_minute=excluded.start_minute,end_minute=excluded.end_minute,updated_at=clock_timestamp();
    -- A shorter/disabled interval must unblock previously deferred alerts promptly.
    update ball_knower_private.push_deliveries set available_at=clock_timestamp() where auth_user_id=p_owner and state='pending' and outcome_code='quiet_hours' and available_at>clock_timestamp();
    return public.manage_ball_knower_push(p_owner,'settings',jsonb_build_object('sessionId',p_data->>'sessionId'));
  elsif p_action='devices' then
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'installationId',installation_id,'transport',transport,'label',label,'lastSeenAt',last_seen_at,'revokedAt',revoked_at) order by last_seen_at desc),'[]') into v_result from ball_knower_private.push_devices where auth_user_id=p_owner;
    return v_result;
  elsif p_action in ('installation','subscribe','unsubscribe') then
    if (p_data->>'installationSecretHash') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid installation' using errcode='22023'; end if;
    perform pg_advisory_xact_lock(hashtextextended('bk-push-owner:'||p_owner::text,0));
    perform pg_advisory_xact_lock(hashtextextended(p_data->>'installationId',0));
    select * into v_intent from ball_knower_private.push_installation_intents where installation_id=(p_data->>'installationId')::uuid for update;
    if found and v_intent.installation_secret_hash is distinct from p_data->>'installationSecretHash' then raise exception 'Installation access denied' using errcode='42501'; end if;
    if p_action='installation' then return jsonb_build_object('epoch',v_intent.epoch,'revision',coalesce(v_intent.revision,0)); end if;
    if jsonb_typeof(p_data->'intentRevision') is distinct from 'number' or (p_data->>'intentRevision') !~ '^[0-9]{1,16}$' or (p_data->>'intentRevision')::numeric not between 1 and 9007199254740991 or p_data->>'intentId' is null then raise exception 'Invalid installation intent' using errcode='22023'; end if;
    v_revision:=(p_data->>'intentRevision')::bigint; v_intent_id:=(p_data->>'intentId')::uuid;
    -- An old account's pending logout cannot alter a newer owner's installation.
    if p_action='unsubscribe' and v_intent.auth_user_id is not null and v_intent.auth_user_id<>p_owner then return jsonb_build_object('ok',true); end if;
    if coalesce((p_data->>'restore')::boolean,false) and (v_intent.installation_id is null or not v_intent.enabled or v_intent.auth_user_id<>p_owner or v_intent.session_id<>(p_data->>'sessionId')::uuid or v_intent.revision<>v_revision or v_intent.intent_id<>v_intent_id or v_intent.epoch is distinct from (p_data->>'expectedEpoch')::uuid) then raise exception 'Explicit re-enable required' using errcode='BK001'; end if;
    if v_intent.installation_id is not null and (v_revision<v_intent.revision or (v_revision=v_intent.revision and v_intent_id<>v_intent.intent_id) or ((v_intent.epoch_required or p_data->>'expectedEpoch' is not null) and v_intent.epoch is distinct from (p_data->>'expectedEpoch')::uuid)) then raise exception 'Installation intent changed' using errcode='BK002'; end if;
    if v_intent.installation_id is not null and v_revision=v_intent.revision and v_intent.enabled is distinct from (p_action='subscribe') then raise exception 'Installation intent changed' using errcode='BK002'; end if;
    insert into ball_knower_private.push_installation_intents(installation_id,installation_secret_hash,auth_user_id,session_id,revision,intent_id,enabled) values((p_data->>'installationId')::uuid,p_data->>'installationSecretHash',p_owner,(p_data->>'sessionId')::uuid,v_revision,v_intent_id,p_action='subscribe')
    on conflict(installation_id) do update set auth_user_id=excluded.auth_user_id,session_id=excluded.session_id,revision=excluded.revision,intent_id=excluded.intent_id,enabled=excluded.enabled returning * into v_intent;
    if p_action='unsubscribe' then
      update ball_knower_private.push_devices set revoked_at=clock_timestamp() where installation_id=v_intent.installation_id and auth_user_id=p_owner returning id into v_id;
      if v_id is not null then update ball_knower_private.push_deliveries set state='suppressed',outcome_code='device_revoked',claim_token=null,lease_until=null where device_id=v_id and state in ('pending','leased'); end if;
      return jsonb_build_object('ok',true,'epoch',v_intent.epoch);
    end if;
    if (p_data->>'installationSecretHash') !~ '^[a-f0-9]{64}$' or p_data->>'transport' not in ('web','apns') or length(p_data->>'label') not between 1 and 60 then raise exception 'Invalid installation' using errcode='22023'; end if;
    select * into v_device from ball_knower_private.push_devices where installation_id=(p_data->>'installationId')::uuid for update;
    if found and v_device.installation_secret_hash is distinct from p_data->>'installationSecretHash' then raise exception 'Installation access denied' using errcode='42501'; end if;
    if coalesce((p_data->>'restore')::boolean,false) and (v_device.id is null or v_device.revoked_at is not null or v_device.auth_user_id<>p_owner or v_device.session_id<>(p_data->>'sessionId')::uuid) then raise exception 'Explicit re-enable required' using errcode='BK001'; end if;
    v_hash:=encode(sha256(convert_to((p_data->>'transport')||':'||case when p_data->>'transport'='web' then p_data->'payload'->>'endpoint' else lower(p_data->'payload'->>'token') end,'UTF8')),'hex');
    if exists(select 1 from ball_knower_private.push_devices where endpoint_hash=v_hash and installation_id<>(p_data->>'installationId')::uuid) then raise exception 'Installation conflict' using errcode='23505'; end if;
    if (select count(*) from ball_knower_private.push_devices where auth_user_id=p_owner and revoked_at is null)>=20 and (v_device.id is null or v_device.auth_user_id<>p_owner or v_device.revoked_at is not null) then raise exception 'Device limit reached' using errcode='22023'; end if;
    -- Rebinding invalidates all old pending deliveries even when the owner is unchanged.
    if v_device.id is not null and (v_device.auth_user_id<>p_owner or v_device.session_id<>(p_data->>'sessionId')::uuid or v_device.endpoint_hash<>v_hash or v_device.payload is distinct from p_data->'payload') then update ball_knower_private.push_deliveries set state='suppressed',outcome_code='device_rebound',claim_token=null,lease_until=null where device_id=v_device.id and state in ('pending','leased'); end if;
    insert into ball_knower_private.push_devices(auth_user_id,session_id,installation_id,installation_secret_hash,transport,endpoint_hash,payload,label) values(p_owner,(p_data->>'sessionId')::uuid,(p_data->>'installationId')::uuid,p_data->>'installationSecretHash',p_data->>'transport',v_hash,p_data->'payload',p_data->>'label')
    on conflict(installation_id) do update set auth_user_id=excluded.auth_user_id,session_id=excluded.session_id,transport=excluded.transport,endpoint_hash=excluded.endpoint_hash,payload=excluded.payload,label=excluded.label,last_seen_at=clock_timestamp(),revoked_at=null returning id into v_id;
    return jsonb_build_object('id',v_id,'epoch',v_intent.epoch);
  elsif p_action='revoke-device' then
    -- Match the mutation lock order; changing epoch invalidates previously prepared explicit requests.
    select * into v_device from ball_knower_private.push_devices where id=(p_data->>'deviceId')::uuid and auth_user_id=p_owner;
    if not found then return jsonb_build_object('ok',true); end if;
    perform pg_advisory_xact_lock(hashtextextended('bk-push-owner:'||p_owner::text,0));
    perform pg_advisory_xact_lock(hashtextextended(v_device.installation_id::text,0));
    update ball_knower_private.push_installation_intents set enabled=false,epoch=gen_random_uuid(),epoch_required=true where installation_id=v_device.installation_id and auth_user_id=p_owner;
    update ball_knower_private.push_devices set revoked_at=clock_timestamp() where id=v_device.id and auth_user_id=p_owner returning id into v_id;
    if v_id is not null then update ball_knower_private.push_deliveries set state='suppressed',outcome_code='device_revoked',claim_token=null,lease_until=null where device_id=v_id and state in ('pending','leased'); end if;
    return jsonb_build_object('ok',true);
  elsif p_action='notification' then
    select jsonb_build_object('notificationId',n.id,'leagueId',n.league_id,'kind',n.kind,'category',n.category) into v_result from public.ball_knower_notifications n
    where n.id=(p_data->>'id')::uuid and n.auth_user_id=p_owner and n.league_id is not null and exists(select 1 from public.ball_knower_league_members m where m.league_id=n.league_id and m.auth_user_id=p_owner and not m.is_ai);
    return v_result;
  end if;
  raise exception 'Unknown push action' using errcode='22023';
end;$function$;
revoke all on function public.manage_ball_knower_push(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.manage_ball_knower_push(uuid,text,jsonb) to service_role;

create or replace function ball_knower_private.enqueue_fantasy_push()
returns trigger language plpgsql security definer set search_path='' as $function$
declare v_expiry timestamptz; v_draft public.ball_knower_live_drafts%rowtype; v_context jsonb:='{}'; v_scheduled timestamptz;
begin
  if not new.push_eligible or new.auth_user_id is null or new.read_at is not null or not exists(select 1 from auth.users where id=new.auth_user_id and not coalesce(is_anonymous,false)) then return new; end if;
  v_expiry:=new.created_at+case when new.kind='draft_on_clock' then interval '2 minutes' when new.kind in ('draft_on_deck','draft_started') then interval '10 minutes' when new.kind like 'draft_reminder%' or new.kind in ('matchup_starting','lineup_incomplete','starter_ruled_out','roster_lock') then interval '15 minutes' else interval '24 hours' end;
  if new.kind='draft_reminder' then
    begin select nullif(settings->>'draftScheduledAt','')::timestamptz into v_scheduled from public.ball_knower_leagues where id=new.league_id; exception when invalid_datetime_format or datetime_field_overflow then v_scheduled:=null; end;
    v_context:=jsonb_build_object('scheduledAt',v_scheduled);
    v_expiry:=least(v_expiry,coalesce(v_scheduled,clock_timestamp()));
    update ball_knower_private.push_deliveries q set state='suppressed',outcome_code='reminder_superseded',claim_token=null,lease_until=null where q.state in ('pending','leased') and q.notification_id in(select id from public.ball_knower_notifications where auth_user_id=new.auth_user_id and league_id=new.league_id and kind='draft_reminder' and id<>new.id);
  elsif new.kind in ('draft_on_clock','draft_on_deck','draft_started') then
    select * into v_draft from public.ball_knower_live_drafts where league_id=new.league_id;
    v_context:=jsonb_build_object('pickIndex',v_draft.pick_index,'draftStartedAt',v_draft.started_at);
    if new.kind<>'draft_started' then v_expiry:=least(v_expiry,coalesce(v_draft.pick_deadline_at,v_expiry)); end if;
  end if;
  insert into ball_knower_private.push_deliveries(notification_id,device_id,auth_user_id,expires_at,context)
  select new.id,d.id,new.auth_user_id,v_expiry,v_context from ball_knower_private.push_devices d
  where d.auth_user_id=new.auth_user_id and d.revoked_at is null and d.last_seen_at>clock_timestamp()-interval '180 days'
    and (new.league_id is null or exists(select 1 from public.ball_knower_league_members m where m.league_id=new.league_id and m.auth_user_id=new.auth_user_id and not m.is_ai))
  on conflict(notification_id,device_id) do nothing;
  return new;
end;$function$;
revoke all on function ball_knower_private.enqueue_fantasy_push() from public,anon,authenticated;
drop trigger if exists ball_knower_enqueue_push on public.ball_knower_notifications;
create trigger ball_knower_enqueue_push after insert on public.ball_knower_notifications for each row execute function ball_knower_private.enqueue_fantasy_push();

create or replace function public.claim_ball_knower_push(p_limit integer default 12,p_transports text[] default array['web','apns'],p_now timestamptz default clock_timestamp())
returns table(id uuid,claim_token uuid) language plpgsql security invoker set search_path='' as $function$
begin
  if current_user <> 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  update ball_knower_private.push_deliveries q set state='suppressed',outcome_code='expired',claim_token=null,lease_until=null,updated_at=p_now where q.id in(select x.id from ball_knower_private.push_deliveries x where x.state in ('pending','leased') and x.expires_at<=p_now order by x.expires_at limit 500);
  return query with candidates as (
    select q.id from ball_knower_private.push_deliveries q join ball_knower_private.push_devices d on d.id=q.device_id
    where (q.state='pending' and q.available_at<=p_now or q.state='leased' and q.lease_until<=p_now) and q.expires_at>p_now and d.transport=any(p_transports)
    order by q.available_at,q.created_at limit greatest(0,least(coalesce(p_limit,12),24)) for update of q skip locked
  ) update ball_knower_private.push_deliveries q set state='leased',claim_token=gen_random_uuid(),lease_until=p_now+interval '2 minutes',updated_at=p_now from candidates c where q.id=c.id returning q.id,q.claim_token;
end;$function$;
revoke all on function public.claim_ball_knower_push(integer,text[],timestamptz) from public,anon,authenticated;
grant execute on function public.claim_ball_knower_push(integer,text[],timestamptz) to service_role;

create or replace function public.prepare_ball_knower_push(p_id uuid,p_claim uuid,p_now timestamptz default clock_timestamp())
returns jsonb language plpgsql security invoker set search_path='' as $function$
declare q ball_knower_private.push_deliveries%rowtype; d ball_knower_private.push_devices%rowtype; n public.ball_knower_notifications%rowtype; s ball_knower_private.push_settings%rowtype; v_reason text; v_until timestamptz; v_draft public.ball_knower_live_drafts%rowtype; v_count integer; v_member text; v_scheduled timestamptz;
begin
  if current_user <> 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  select * into q from ball_knower_private.push_deliveries where id=p_id for update;
  if not found or q.state<>'leased' or q.claim_token is distinct from p_claim or q.lease_until<=p_now then return jsonb_build_object('state','stale'); end if;
  select * into d from ball_knower_private.push_devices where id=q.device_id;
  select * into n from public.ball_knower_notifications where id=q.notification_id;
  if q.expires_at<=p_now then v_reason:='expired';
  elsif q.attempts>=5 and q.context->>'preparedClaim' is distinct from p_claim::text then v_reason:='attempt_limit';
  elsif d.revoked_at is not null or d.auth_user_id is distinct from q.auth_user_id or d.last_seen_at<=p_now-interval '180 days' then v_reason:='device_revoked';
  elsif not exists(select 1 from auth.sessions where id=d.session_id and user_id=q.auth_user_id) then v_reason:='session_ended';
  elsif not exists(select 1 from auth.users where id=q.auth_user_id and not coalesce(is_anonymous,false)) then v_reason:='account_unavailable';
  elsif n.auth_user_id is distinct from q.auth_user_id or n.read_at is not null or not n.push_eligible then v_reason:='event_suppressed';
  elsif n.league_id is not null and not exists(select 1 from public.ball_knower_league_members where league_id=n.league_id and auth_user_id=q.auth_user_id and not is_ai) then v_reason:='membership_ended';
  elsif exists(select 1 from public.ball_knower_notification_preferences where auth_user_id=q.auth_user_id and category=n.category and not push_enabled) then v_reason:='category_disabled';
  end if;
  if v_reason is null and n.kind='draft_reminder' then
    begin select nullif(settings->>'draftScheduledAt','')::timestamptz into v_scheduled from public.ball_knower_leagues where id=n.league_id; exception when invalid_datetime_format or datetime_field_overflow then v_scheduled:=null; end;
    if v_scheduled is null or v_scheduled<=p_now or v_scheduled is distinct from (q.context->>'scheduledAt')::timestamptz or exists(select 1 from public.ball_knower_live_drafts where league_id=n.league_id) then v_reason:='draft_schedule_changed'; end if;
  elsif v_reason is null and n.kind in ('draft_started','draft_on_deck') then
    select * into v_draft from public.ball_knower_live_drafts where league_id=n.league_id;
    if v_draft.status is distinct from 'active' or v_draft.started_at is distinct from (q.context->>'draftStartedAt')::timestamptz or (n.kind='draft_on_deck' and v_draft.pick_index is distinct from (q.context->>'pickIndex')::integer) then v_reason:='draft_turn_ended'; end if;
  end if;
  if v_reason is null and n.kind='draft_on_clock' then
    select * into v_draft from public.ball_knower_live_drafts where league_id=n.league_id;
    v_count:=jsonb_array_length(to_jsonb(v_draft)->'order_member_ids');
    if v_draft.status is distinct from 'active' or v_draft.started_at is distinct from (q.context->>'draftStartedAt')::timestamptz or v_draft.pick_index is distinct from (q.context->>'pickIndex')::integer or coalesce(v_draft.pick_deadline_at,p_now)<=p_now or coalesce(v_count,0)=0 then v_reason:='draft_turn_ended';
    else
      v_member:=to_jsonb(v_draft)->'order_member_ids'->>(case when mod(v_draft.pick_index/v_count,2)=0 then mod(v_draft.pick_index,v_count) else v_count-1-mod(v_draft.pick_index,v_count) end);
      if not exists(select 1 from public.ball_knower_league_members where id=v_member and league_id=n.league_id and auth_user_id=q.auth_user_id and not is_ai) then v_reason:='draft_turn_ended'; end if;
    end if;
  end if;
  if v_reason is not null then
    update ball_knower_private.push_deliveries set state='suppressed',outcome_code=v_reason,lease_until=null,claim_token=null,updated_at=p_now where id=q.id;
    return jsonb_build_object('state','suppressed','code',v_reason);
  end if;
  select * into s from ball_knower_private.push_settings where auth_user_id=q.auth_user_id;
  if q.context->>'preparedClaim' is distinct from p_claim::text then
    update ball_knower_private.push_deliveries set attempts=attempts+1,context=context||jsonb_build_object('preparedClaim',p_claim),updated_at=p_now where id=q.id;
  end if;
  return jsonb_build_object('state','ready','transport',d.transport,'subscription',d.payload,'quietHours',jsonb_build_object('quietEnabled',coalesce(s.quiet_enabled,false),'timeZone',coalesce(s.time_zone,'UTC'),'startMinute',coalesce(s.start_minute,1320),'endMinute',coalesce(s.end_minute,420)),'payload',jsonb_build_object('notificationId',n.id,'title',left(n.title,100),'body',left(n.body,240),'expiresAt',q.expires_at,'tag','bk-'||n.id::text));
end;$function$;
revoke all on function public.prepare_ball_knower_push(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.prepare_ball_knower_push(uuid,uuid,timestamptz) to service_role;

create or replace function public.finish_ball_knower_push(p_id uuid,p_claim uuid,p_result jsonb,p_now timestamptz default clock_timestamp())
returns boolean language plpgsql security invoker set search_path='' as $function$
declare q ball_knower_private.push_deliveries%rowtype; v_state text:=p_result->>'state'; v_code text:=p_result->>'code'; v_delay integer; v_until timestamptz;
begin
  if current_user <> 'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  select * into q from ball_knower_private.push_deliveries where id=p_id for update;
  if not found or q.state<>'leased' or q.claim_token is distinct from p_claim or q.lease_until<=p_now then return false; end if;
  if v_state not in ('accepted','retry','failed','invalid','deferred') or v_code !~ '^[a-z_]{1,48}$' then raise exception 'Invalid delivery result' using errcode='22023'; end if;
  if v_state='deferred' then
    v_until:=(p_result->>'availableAt')::timestamptz;
    if v_until is null or v_until<=p_now or v_until>p_now+interval '26 hours' then raise exception 'Invalid deferral' using errcode='22023'; end if;
    update ball_knower_private.push_deliveries set state=case when v_until>=expires_at then 'suppressed' else 'pending' end,outcome_code=case when v_until>=expires_at then 'expired_in_quiet_hours' else 'quiet_hours' end,available_at=v_until,attempts=greatest(0,attempts-1),lease_until=null,claim_token=null,updated_at=p_now where id=q.id;
    return true;
  end if;
  v_delay:=greatest(60,least(3600,coalesce((p_result->>'retryAfterSeconds')::integer,(30*power(2,least(q.attempts,6)))::integer)));
  if v_state='invalid' then update ball_knower_private.push_devices set revoked_at=p_now where id=q.device_id and auth_user_id=q.auth_user_id; end if;
  update ball_knower_private.push_deliveries set state=case when v_state='accepted' then 'accepted' when v_state='retry' and attempts<5 and p_now+make_interval(secs=>v_delay)<expires_at then 'pending' else 'failed' end,
    outcome_code=v_code,provider_id=case when p_result->>'providerId' ~ '^[A-Za-z0-9:_-]{1,128}$' then p_result->>'providerId' end,
    available_at=p_now+make_interval(secs=>v_delay),accepted_at=case when v_state='accepted' then p_now end,lease_until=null,claim_token=null,updated_at=p_now where id=q.id;
  return true;
end;$function$;
revoke all on function public.finish_ball_knower_push(uuid,uuid,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.finish_ball_knower_push(uuid,uuid,jsonb,timestamptz) to service_role;
comment on table ball_knower_private.push_deliveries is 'Provider acceptance receipts, not proof of device receipt. Unique event/device, bounded retries, current-access checks and quiet-hours suppression.';
notify pgrst, 'reload schema';
