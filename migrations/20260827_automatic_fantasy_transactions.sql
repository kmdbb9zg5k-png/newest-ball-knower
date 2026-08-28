-- Automatic, server-authoritative fantasy transactions.

alter table public.ball_knower_league_members
  add column if not exists waiver_priority integer not null default 999;

alter table public.ball_knower_waiver_claims
  add column if not exists claim_group_id uuid,
  add column if not exists claim_order integer not null default 1,
  add column if not exists process_at timestamptz,
  add column if not exists failure_reason text;

update public.ball_knower_waiver_claims
set claim_group_id=coalesce(claim_group_id,id), process_at=coalesce(process_at,now());

alter table public.ball_knower_waiver_claims
  alter column claim_group_id set default gen_random_uuid(),
  alter column claim_group_id set not null,
  alter column process_at set default now(),
  alter column process_at set not null;

-- Existing roster protection remains in force for people. Trusted transaction
-- functions explicitly mark their operation so the service-role cron can work
-- without pretending to be a league member.
create or replace function public.enforce_ball_knower_member_update()
returns trigger language plpgsql set search_path to '' as $$
declare
  v_requester uuid:=public.fantasy_requester_id();v_is_commissioner boolean:=public.is_ball_knower_commissioner(new.league_id);v_paused boolean;v_rosters_locked boolean;v_roster_count integer;v_authorized_operation text:=current_setting('ball_knower.authorized_roster_operation',true);
begin
  if v_requester is null and coalesce(v_authorized_operation,'') not in ('trade','waiver','system') then raise exception 'Authentication required'; end if;
  if not v_is_commissioner and old.auth_user_id=v_requester then
    if new.id is distinct from old.id or new.league_id is distinct from old.league_id or new.auth_user_id is distinct from old.auth_user_id or new.app_user_id is distinct from old.app_user_id or new.is_commissioner is distinct from old.is_commissioner or new.is_ai is distinct from old.is_ai then raise exception 'League membership identity fields cannot be changed by members'; end if;
  end if;
  select league.paused,league.rosters_locked into v_paused,v_rosters_locked from public.ball_knower_leagues league where league.id=new.league_id;
  if not found then raise exception 'League not found'; end if;
  if not v_is_commissioner and old.auth_user_id=v_requester and coalesce(v_authorized_operation,'') not in ('trade','waiver') and (new.roster is distinct from old.roster or new.team_ratings is distinct from old.team_ratings or new.status is distinct from old.status or new.submitted_at is distinct from old.submitted_at) then
    if v_paused then raise exception 'This league is paused by the commissioner'; end if;
    if v_rosters_locked then raise exception 'Roster submissions are currently locked by the commissioner'; end if;
  end if;
  if new.status='ready' and (new.status is distinct from old.status or new.roster is distinct from old.roster) then
    v_roster_count:=jsonb_array_length(coalesce(new.roster,'[]'::jsonb));
    if coalesce(v_authorized_operation,'') in ('trade','waiver') then
      if v_roster_count>20 then raise exception 'Roster cannot exceed 20 players'; end if;
    elsif v_roster_count<>20 then raise exception 'A ready roster must contain exactly 20 players'; end if;
  end if;
  return new;
end;$$;

select set_config('ball_knower.authorized_roster_operation','system',true);

with ranked as (
  select id,row_number() over(partition by league_id order by id)::integer as priority
  from public.ball_knower_league_members
)
update public.ball_knower_league_members m set waiver_priority=r.priority
from ranked r where r.id=m.id and m.waiver_priority=999;
select set_config('ball_knower.authorized_roster_operation','',true);

create table if not exists public.ball_knower_player_waivers (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.ball_knower_leagues(id) on delete cascade,
  player_id text not null,
  player_snapshot jsonb not null,
  dropped_by_member_id text references public.ball_knower_league_members(id) on delete set null,
  clears_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(league_id,player_id)
);

create table if not exists public.ball_knower_waiver_runs (
  id uuid primary key default gen_random_uuid(),
  processed_at timestamptz not null default now(),
  won_count integer not null default 0,
  lost_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists bk_waivers_due_idx on public.ball_knower_waiver_claims(status,process_at,league_id);
create index if not exists bk_waivers_member_group_idx on public.ball_knower_waiver_claims(member_id,claim_group_id,claim_order);
create index if not exists bk_player_waivers_clear_idx on public.ball_knower_player_waivers(league_id,clears_at);

alter table public.ball_knower_player_waivers enable row level security;
alter table public.ball_knower_waiver_runs enable row level security;

drop policy if exists bk_waivers_member_read on public.ball_knower_waiver_claims;
drop policy if exists bk_waivers_member_write on public.ball_knower_waiver_claims;
drop policy if exists bk_waivers_member_update on public.ball_knower_waiver_claims;
create policy bk_waivers_owner_read on public.ball_knower_waiver_claims for select to authenticated
using (
  exists(select 1 from public.ball_knower_league_members m where m.id=member_id and m.auth_user_id=auth.uid())
  or public.is_ball_knower_commissioner(league_id)
);

create policy bk_player_waivers_member_read on public.ball_knower_player_waivers for select to authenticated
using (public.can_access_ball_knower_league(league_id));

revoke all on public.ball_knower_waiver_claims from anon,authenticated;
revoke all on public.ball_knower_player_waivers from anon,authenticated;
revoke all on public.ball_knower_waiver_runs from anon,authenticated;
revoke all on public.ball_knower_transactions from anon,authenticated;
revoke insert,update,delete,truncate,references,trigger on public.ball_knower_trades from anon,authenticated;
grant select on public.ball_knower_waiver_claims,public.ball_knower_player_waivers,public.ball_knower_transactions,public.ball_knower_trades to authenticated;

create or replace function public.next_ball_knower_waiver_run(p_settings jsonb,p_from timestamptz default now())
returns timestamptz language plpgsql stable set search_path to 'public' as $$
declare v_hour integer:=greatest(0,least(23,coalesce(nullif(p_settings->>'waiverProcessHourUtc','')::integer,9)));v_days jsonb:=coalesce(p_settings->'waiverRunDays','[0,1,2,3,4,5,6]'::jsonb);v_candidate timestamptz;v_offset integer;
begin
  for v_offset in 0..7 loop
    v_candidate:=date_trunc('day',p_from)+(v_offset||' days')::interval+(v_hour||' hours')::interval;
    if v_candidate>p_from and exists(select 1 from jsonb_array_elements_text(v_days) d(value) where d.value=extract(dow from v_candidate)::integer::text) then return v_candidate; end if;
  end loop;
  return date_trunc('day',p_from)+interval '1 day'+(v_hour||' hours')::interval;
end;$$;

create or replace function public.apply_ball_knower_player_move(
  p_league_id text,p_member_id text,p_player_snapshot jsonb,p_drop_player_id text,p_faab_bid numeric,p_kind text,p_claim_id uuid default null
) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_member public.ball_knower_league_members%rowtype;v_settings jsonb;v_roster jsonb;v_new_roster jsonb;v_drop jsonb;v_player_id text;v_player_name text;v_cap numeric;v_spent numeric;v_limit integer;v_days integer;
begin
  perform set_config('ball_knower.authorized_roster_operation','waiver',true);
  v_player_id:=p_player_snapshot->>'id';v_player_name:=coalesce(p_player_snapshot->>'name',v_player_id);
  if v_player_id is null or v_player_id='' then raise exception 'Player data is missing'; end if;
  select l.settings,l.salary_cap into v_settings,v_cap from public.ball_knower_leagues l where l.id=p_league_id for update;
  if not found then raise exception 'League not found'; end if;
  perform 1 from public.ball_knower_league_members where league_id=p_league_id order by id for update;
  if exists(select 1 from public.ball_knower_league_members m,jsonb_array_elements(coalesce(m.roster,'[]'::jsonb)) e where m.league_id=p_league_id and e->>'id'=v_player_id) then raise exception 'Player is no longer available'; end if;
  select * into v_member from public.ball_knower_league_members where league_id=p_league_id and id=p_member_id;
  if not found then raise exception 'League member not found'; end if;
  if p_faab_bid<0 or p_faab_bid>v_member.faab_balance then raise exception 'FAAB bid exceeds remaining budget'; end if;
  v_roster:=coalesce(v_member.roster,'[]'::jsonb);v_limit:=coalesce(nullif(v_settings->>'rosterSize','')::integer,20);
  if p_drop_player_id is not null then
    select e into v_drop from jsonb_array_elements(v_roster)e where e->>'id'=p_drop_player_id limit 1;
    if v_drop is null then raise exception 'Drop player is no longer on this roster'; end if;
  elsif jsonb_array_length(v_roster)>=v_limit then raise exception 'Choose a player to drop from the full roster';
  end if;
  select coalesce(jsonb_agg(e),'[]'::jsonb) into v_new_roster from jsonb_array_elements(v_roster)e where p_drop_player_id is null or e->>'id'<>p_drop_player_id;
  v_new_roster:=v_new_roster||jsonb_build_array(p_player_snapshot);
  if jsonb_array_length(v_new_roster)>v_limit then raise exception 'Move would exceed the roster limit'; end if;
  select coalesce(sum(coalesce(nullif(e->>'salary','')::numeric,0)),0) into v_spent from jsonb_array_elements(v_new_roster)e;
  if v_spent>v_cap then raise exception 'Move would exceed the salary cap'; end if;
  update public.ball_knower_league_members set roster=v_new_roster,status='building',team_ratings=null,submitted_at=null,faab_balance=greatest(0,faab_balance-p_faab_bid) where id=v_member.id;
  delete from public.ball_knower_player_waivers where league_id=p_league_id and player_id=v_player_id;
  if v_drop is not null then
    v_days:=greatest(0,least(7,coalesce(nullif(v_settings->>'waiverDays','')::integer,2)));
    insert into public.ball_knower_player_waivers(league_id,player_id,player_snapshot,dropped_by_member_id,clears_at)
    values(p_league_id,p_drop_player_id,v_drop,v_member.id,now()+make_interval(days=>v_days))
    on conflict(league_id,player_id) do update set player_snapshot=excluded.player_snapshot,dropped_by_member_id=excluded.dropped_by_member_id,clears_at=excluded.clears_at,created_at=now();
  end if;
  insert into public.ball_knower_transactions(league_id,member_id,transaction_type,summary,metadata)
  values(p_league_id,v_member.id,p_kind,v_member.user_name||' added '||v_player_name||case when v_drop is null then '.' else ' and dropped '||coalesce(v_drop->>'name',p_drop_player_id)||'.' end,
    jsonb_build_object('claimId',p_claim_id,'playerId',v_player_id,'dropPlayerId',p_drop_player_id,'faabBid',p_faab_bid,'kind',p_kind));
  return jsonb_build_object('playerId',v_player_id,'dropPlayerId',p_drop_player_id,'memberId',v_member.id);
end;$$;

create or replace function public.submit_ball_knower_player_move(
  p_league_id text,p_player_snapshot jsonb,p_drop_player_id text default null,p_faab_bid numeric default 0,p_claim_order integer default 1,p_claim_group_id uuid default null
) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_auth uuid:=auth.uid();v_member public.ball_knower_league_members%rowtype;v_settings jsonb;v_player_id text;v_active_waiver boolean;v_continuous boolean;v_claim_id uuid;v_process_at timestamptz;v_bid numeric:=round(greatest(0,coalesce(p_faab_bid,0)),2);v_group uuid:=coalesce(p_claim_group_id,gen_random_uuid());v_result jsonb;
begin
  if v_auth is null then raise exception 'Authentication required'; end if;
  v_player_id:=p_player_snapshot->>'id';
  if v_player_id is null or v_player_id='' then raise exception 'Player data is missing'; end if;
  select * into v_member from public.ball_knower_league_members where league_id=p_league_id and auth_user_id=v_auth limit 1 for update;
  if not found then raise exception 'League membership not found'; end if;
  select settings into v_settings from public.ball_knower_leagues where id=p_league_id;
  if exists(select 1 from public.ball_knower_league_members m,jsonb_array_elements(coalesce(m.roster,'[]'::jsonb))e where m.league_id=p_league_id and e->>'id'=v_player_id) then raise exception 'Player is no longer available'; end if;
  select exists(select 1 from public.ball_knower_player_waivers w where w.league_id=p_league_id and w.player_id=v_player_id and w.clears_at>now()) into v_active_waiver;
  v_continuous:=coalesce(v_settings->>'freeAgentMode','instant')='continuous';
  if not v_active_waiver and not v_continuous then
    v_result:=public.apply_ball_knower_player_move(p_league_id,v_member.id,p_player_snapshot,p_drop_player_id,0,'free_agent',null);
    return v_result||jsonb_build_object('status','added','message','Free agent added instantly.');
  end if;
  if coalesce(v_settings->>'waiverType','priority')='faab' and v_bid>v_member.faab_balance then raise exception 'FAAB bid exceeds remaining budget'; end if;
  if exists(select 1 from public.ball_knower_waiver_claims where league_id=p_league_id and member_id=v_member.id and player_id=v_player_id and status='pending') then raise exception 'You already have a pending claim for this player'; end if;
  v_process_at:=case when v_active_waiver then public.next_ball_knower_waiver_run(v_settings,(select clears_at from public.ball_knower_player_waivers where league_id=p_league_id and player_id=v_player_id)-interval '1 second') else public.next_ball_knower_waiver_run(v_settings,now()) end;
  insert into public.ball_knower_waiver_claims(league_id,member_id,player_id,player_snapshot,drop_player_id,priority,faab_bid,claim_group_id,claim_order,process_at)
  values(p_league_id,v_member.id,v_player_id,p_player_snapshot,p_drop_player_id,greatest(1,p_claim_order),v_bid,v_group,greatest(1,p_claim_order),v_process_at) returning id into v_claim_id;
  return jsonb_build_object('status','pending','claimId',v_claim_id,'claimGroupId',v_group,'processAt',v_process_at,'message','Waiver claim scheduled.');
end;$$;

create or replace function public.cancel_my_ball_knower_waiver(p_claim_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  update public.ball_knower_waiver_claims c set status='cancelled',processed_at=now(),failure_reason='Cancelled by manager'
  where c.id=p_claim_id and c.status='pending' and exists(select 1 from public.ball_knower_league_members m where m.id=c.member_id and m.auth_user_id=auth.uid());
  if not found then raise exception 'Pending claim not found'; end if;
end;$$;

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
      if exists(select 1 from public.ball_knower_waiver_claims x where x.claim_group_id=c.claim_group_id and x.status='won') then
        update public.ball_knower_waiver_claims set status='cancelled',processed_at=p_now,failure_reason='Earlier conditional claim won' where id=c.id and status='pending';continue;
      end if;
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

revoke all on function public.next_ball_knower_waiver_run(jsonb,timestamptz) from public,anon,authenticated,service_role;
revoke all on function public.apply_ball_knower_player_move(text,text,jsonb,text,numeric,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.submit_ball_knower_player_move(text,jsonb,text,numeric,integer,uuid) from public,anon,authenticated,service_role;
revoke all on function public.cancel_my_ball_knower_waiver(uuid) from public,anon,authenticated,service_role;
revoke all on function public.process_due_ball_knower_waivers(timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.submit_ball_knower_player_move(text,jsonb,text,numeric,integer,uuid) to authenticated;
grant execute on function public.cancel_my_ball_knower_waiver(uuid) to authenticated;
grant execute on function public.process_due_ball_knower_waivers(timestamptz) to service_role;
