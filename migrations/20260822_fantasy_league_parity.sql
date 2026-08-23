-- Fantasy league parity foundation: weekly lineups, live score storage, FAAB,
-- IR, counter offers and commissioner trade review.

alter table public.ball_knower_league_members
  add column if not exists faab_balance numeric not null default 100,
  add column if not exists ir_player_ids jsonb not null default '[]'::jsonb;

alter table public.ball_knower_waiver_claims
  add column if not exists faab_bid numeric not null default 0;

alter table public.ball_knower_trades
  add column if not exists parent_trade_id uuid references public.ball_knower_trades(id) on delete set null;

create table if not exists public.ball_knower_weekly_lineups (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.ball_knower_leagues(id) on delete cascade,
  member_id text not null references public.ball_knower_league_members(id) on delete cascade,
  week_number integer not null check (week_number between 1 and 22),
  starters jsonb not null default '{}'::jsonb,
  bench jsonb not null default '[]'::jsonb,
  locked boolean not null default false,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, member_id, week_number)
);

create table if not exists public.ball_knower_weekly_scores (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.ball_knower_leagues(id) on delete cascade,
  member_id text not null references public.ball_knower_league_members(id) on delete cascade,
  week_number integer not null check (week_number between 1 and 22),
  live_points numeric not null default 0,
  projected_points numeric not null default 0,
  source text not null default 'ball_knower',
  is_final boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (league_id, member_id, week_number)
);

create index if not exists ball_knower_weekly_lineups_league_week_idx on public.ball_knower_weekly_lineups(league_id, week_number);
create index if not exists ball_knower_weekly_scores_league_week_idx on public.ball_knower_weekly_scores(league_id, week_number);

alter table public.ball_knower_weekly_lineups enable row level security;
alter table public.ball_knower_weekly_scores enable row level security;

drop policy if exists "league members read lineups" on public.ball_knower_weekly_lineups;
create policy "league members read lineups" on public.ball_knower_weekly_lineups
for select to authenticated using (exists(select 1 from public.ball_knower_league_members m where m.league_id=ball_knower_weekly_lineups.league_id and m.auth_user_id=auth.uid()));

drop policy if exists "owners manage own lineups" on public.ball_knower_weekly_lineups;
create policy "owners manage own lineups" on public.ball_knower_weekly_lineups
for all to authenticated using (exists(select 1 from public.ball_knower_league_members m where m.league_id=ball_knower_weekly_lineups.league_id and m.id=ball_knower_weekly_lineups.member_id and m.auth_user_id=auth.uid()))
with check (exists(select 1 from public.ball_knower_league_members m where m.league_id=ball_knower_weekly_lineups.league_id and m.id=ball_knower_weekly_lineups.member_id and m.auth_user_id=auth.uid()));

drop policy if exists "league members read weekly scores" on public.ball_knower_weekly_scores;
create policy "league members read weekly scores" on public.ball_knower_weekly_scores
for select to authenticated using (exists(select 1 from public.ball_knower_league_members m where m.league_id=ball_knower_weekly_scores.league_id and m.auth_user_id=auth.uid()));

create or replace function public.save_my_ball_knower_weekly_lineup(p_league_id text,p_week_number integer,p_starters jsonb,p_bench jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_auth uuid:=auth.uid();v_member public.ball_knower_league_members%rowtype;v_id uuid;v_player_id text;v_seen text[]:='{}';v_roster jsonb;
begin
 if v_auth is null then raise exception 'Authentication required'; end if;
 if p_week_number<1 or p_week_number>22 then raise exception 'Invalid week'; end if;
 if jsonb_typeof(p_starters)<>'object' then raise exception 'Starters must be an object'; end if;
 select * into v_member from public.ball_knower_league_members where league_id=p_league_id and auth_user_id=v_auth limit 1;
 if not found then raise exception 'League membership not found'; end if;
 v_roster:=coalesce(v_member.roster,'[]'::jsonb);
 for v_player_id in select value #>> '{}' from jsonb_each(p_starters) loop
   if v_player_id is null or v_player_id='' then continue; end if;
   if v_player_id=any(v_seen) then raise exception 'A player cannot fill more than one lineup slot'; end if;
   if not exists(select 1 from jsonb_array_elements(v_roster)e where e->>'id'=v_player_id) then raise exception 'Starter is not on your roster'; end if;
   v_seen:=array_append(v_seen,v_player_id);
 end loop;
 insert into public.ball_knower_weekly_lineups(league_id,member_id,week_number,starters,bench,submitted_at,updated_at)
 values(p_league_id,v_member.id,p_week_number,p_starters,coalesce(p_bench,'[]'::jsonb),now(),now())
 on conflict(league_id,member_id,week_number) do update set starters=excluded.starters,bench=excluded.bench,submitted_at=now(),updated_at=now()
 returning id into v_id;
 insert into public.ball_knower_transactions(league_id,member_id,transaction_type,summary,metadata) values(p_league_id,v_member.id,'lineup',v_member.user_name||' submitted Week '||p_week_number||' starters.',jsonb_build_object('week',p_week_number));
 return jsonb_build_object('id',v_id,'week',p_week_number,'memberId',v_member.id);
end;$$;

create or replace function public.set_my_ball_knower_ir(p_league_id text,p_player_id text,p_on_ir boolean)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_auth uuid:=auth.uid();v_member public.ball_knower_league_members%rowtype;v_ids jsonb;v_limit integer;v_player_name text;
begin
 if v_auth is null then raise exception 'Authentication required'; end if;
 select * into v_member from public.ball_knower_league_members where league_id=p_league_id and auth_user_id=v_auth limit 1 for update;
 if not found then raise exception 'League membership not found'; end if;
 if not exists(select 1 from jsonb_array_elements(coalesce(v_member.roster,'[]'::jsonb))e where e->>'id'=p_player_id) then raise exception 'Player is not on your roster'; end if;
 select e->>'name' into v_player_name from jsonb_array_elements(coalesce(v_member.roster,'[]'::jsonb))e where e->>'id'=p_player_id limit 1;
 v_ids:=coalesce(v_member.ir_player_ids,'[]'::jsonb);
 v_limit:=coalesce((select nullif(settings->>'irSlots','')::integer from public.ball_knower_leagues where id=p_league_id),2);
 if p_on_ir then
   if not exists(select 1 from public.ball_knower_injuries i where i.league_id=p_league_id and i.member_id=v_member.id and i.player_id=p_player_id and i.status in('out','ir','doubtful')) then raise exception 'Only injured players can be placed on IR'; end if;
   if not exists(select 1 from jsonb_array_elements_text(v_ids)x where x=p_player_id) then
     if jsonb_array_length(v_ids)>=v_limit then raise exception 'All IR slots are full'; end if;
     v_ids:=v_ids||to_jsonb(p_player_id);
   end if;
 else
   select coalesce(jsonb_agg(x),'[]'::jsonb) into v_ids from jsonb_array_elements_text(v_ids)x where x<>p_player_id;
 end if;
 update public.ball_knower_league_members set ir_player_ids=v_ids where id=v_member.id;
 insert into public.ball_knower_transactions(league_id,member_id,transaction_type,summary,metadata) values(p_league_id,v_member.id,'ir',v_member.user_name||(case when p_on_ir then ' placed ' else ' activated ' end)||coalesce(v_player_name,p_player_id)||(case when p_on_ir then ' on IR.' else ' from IR.' end),jsonb_build_object('playerId',p_player_id,'onIr',p_on_ir));
 return jsonb_build_object('onIr',p_on_ir,'playerId',p_player_id,'ir',v_ids);
end;$$;

create or replace function public.counter_ball_knower_trade(p_trade_id uuid,p_offered_player_ids text[],p_requested_player_ids text[],p_note text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_auth uuid:=auth.uid();v_trade public.ball_knower_trades%rowtype;v_recipient public.ball_knower_league_members%rowtype;v_new_id uuid;
begin
 if v_auth is null then raise exception 'Authentication required'; end if;
 select * into v_trade from public.ball_knower_trades where id=p_trade_id for update;
 if not found or v_trade.status<>'pending' then raise exception 'Trade is no longer pending'; end if;
 select * into v_recipient from public.ball_knower_league_members where league_id=v_trade.league_id and id=v_trade.recipient_member_id;
 if v_recipient.auth_user_id is distinct from v_auth then raise exception 'Only the receiving owner can counter this trade'; end if;
 if coalesce(array_length(p_offered_player_ids,1),0)<>coalesce(array_length(p_requested_player_ids,1),0) then raise exception 'Ball Knower trades must swap the same number of players'; end if;
 update public.ball_knower_trades set status='countered',resolved_at=now() where id=v_trade.id;
 insert into public.ball_knower_trades(league_id,proposer_member_id,recipient_member_id,offered_player_ids,requested_player_ids,note,parent_trade_id)
 values(v_trade.league_id,v_trade.recipient_member_id,v_trade.proposer_member_id,p_offered_player_ids,p_requested_player_ids,left(p_note,500),v_trade.id) returning id into v_new_id;
 return v_new_id;
end;$$;

-- FAAB mode selects the highest bid for a player even if the commissioner queue calls
-- another pending claim first. Ties go to the earlier claim.
create or replace function public.process_ball_knower_waiver(p_claim_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare c public.ball_knower_waiver_claims%rowtype;m public.ball_knower_league_members%rowtype;new_roster jsonb;cap numeric;spent numeric;rostered boolean;v_waiver_type text;
begin
 select * into c from public.ball_knower_waiver_claims where id=p_claim_id for update;
 if not found or c.status<>'pending' then raise exception 'Waiver claim is no longer pending'; end if;
 if not public.is_ball_knower_commissioner(c.league_id) then raise exception 'Commissioner authorization required'; end if;
 select coalesce(settings->>'waiverType','priority') into v_waiver_type from public.ball_knower_leagues where id=c.league_id;
 if v_waiver_type='faab' then select * into c from public.ball_knower_waiver_claims where league_id=c.league_id and player_id=c.player_id and status='pending' order by faab_bid desc,created_at asc limit 1 for update; end if;
 if c.player_snapshot is null then raise exception 'Waiver player snapshot missing'; end if;
 select exists(select 1 from public.ball_knower_league_members bm,jsonb_array_elements(coalesce(bm.roster,'[]'::jsonb))e where bm.league_id=c.league_id and e->>'id'=c.player_id) into rostered;
 if rostered then update public.ball_knower_waiver_claims set status='lost',processed_at=now() where id=c.id;return;end if;
 select * into m from public.ball_knower_league_members where league_id=c.league_id and id=c.member_id for update;
 if not found then raise exception 'Claiming member missing'; end if;
 if v_waiver_type='faab' and c.faab_bid>m.faab_balance then update public.ball_knower_waiver_claims set status='lost',processed_at=now() where id=c.id;raise exception 'Winning FAAB bid exceeds remaining budget';end if;
 if jsonb_array_length(coalesce(m.roster,'[]'::jsonb))>=20 and c.drop_player_id is null then raise exception 'A drop player is required for a full roster';end if;
 select coalesce(jsonb_agg(e),'[]'::jsonb) into new_roster from jsonb_array_elements(coalesce(m.roster,'[]'::jsonb))e where c.drop_player_id is null or e->>'id'<>c.drop_player_id;
 new_roster:=new_roster||jsonb_build_array(c.player_snapshot);
 if jsonb_array_length(new_roster)>20 then raise exception 'Waiver would exceed roster limit';end if;
 select salary_cap into cap from public.ball_knower_leagues where id=c.league_id;
 select coalesce(sum(coalesce((e->>'salary')::numeric,0)),0) into spent from jsonb_array_elements(new_roster)e;
 if spent>cap then raise exception 'Waiver would exceed salary cap';end if;
 update public.ball_knower_league_members set roster=new_roster,status='building',team_ratings=null,submitted_at=null,faab_balance=case when v_waiver_type='faab' then greatest(0,faab_balance-c.faab_bid) else faab_balance end where id=m.id;
 update public.ball_knower_waiver_claims set status='won',processed_at=now() where id=c.id;
 update public.ball_knower_waiver_claims set status='lost',processed_at=now() where league_id=c.league_id and player_id=c.player_id and status='pending' and id<>c.id;
 insert into public.ball_knower_transactions(league_id,member_id,transaction_type,summary,metadata) values(c.league_id,m.id,'waiver',m.user_name||' claimed '||coalesce(c.player_snapshot->>'name',c.player_id),jsonb_build_object('claimId',c.id,'playerId',c.player_id,'faabBid',c.faab_bid,'waiverType',v_waiver_type));
end;$$;

-- Recipient acceptance can either execute instantly or enter commissioner review.
create or replace function public.resolve_ball_knower_trade(p_trade_id uuid,p_action text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare t public.ball_knower_trades%rowtype;p public.ball_knower_league_members%rowtype;r public.ball_knower_league_members%rowtype;cap numeric;p_new jsonb;r_new jsonb;p_spent numeric;r_spent numeric;actor uuid:=auth.uid();v_review text;v_execute boolean:=false;
begin
 select * into t from public.ball_knower_trades where id=p_trade_id for update;if not found then raise exception 'Trade not found';end if;
 if p_action not in('accepted','rejected','cancelled','vetoed','approved') then raise exception 'Invalid trade action';end if;
 select * into p from public.ball_knower_league_members where league_id=t.league_id and id=t.proposer_member_id for update;
 select * into r from public.ball_knower_league_members where league_id=t.league_id and id=t.recipient_member_id for update;
 select coalesce(settings->>'tradeReview','none') into v_review from public.ball_knower_leagues where id=t.league_id;
 if p_action='accepted' then
   if t.status<>'pending' or r.auth_user_id is distinct from actor then raise exception 'Only the receiving owner can accept this pending trade';end if;
   if v_review='commissioner' and not public.is_ball_knower_commissioner(t.league_id) then update public.ball_knower_trades set status='accepted_pending_review',resolved_at=null where id=t.id;return;end if;v_execute:=true;
 elsif p_action='approved' then if t.status<>'accepted_pending_review' or not public.is_ball_knower_commissioner(t.league_id) then raise exception 'Trade is not awaiting commissioner review';end if;v_execute:=true;
 elsif p_action='rejected' then if t.status<>'pending' or r.auth_user_id is distinct from actor then raise exception 'Only the receiving owner can reject this trade';end if;update public.ball_knower_trades set status='rejected',resolved_at=now() where id=t.id;return;
 elsif p_action='cancelled' then if t.status<>'pending' or p.auth_user_id is distinct from actor then raise exception 'Only the proposing owner can cancel this trade';end if;update public.ball_knower_trades set status='cancelled',resolved_at=now() where id=t.id;return;
 elsif p_action='vetoed' then if t.status not in('pending','accepted_pending_review') or not public.is_ball_knower_commissioner(t.league_id) then raise exception 'Commissioner authorization required';end if;update public.ball_knower_trades set status='vetoed',resolved_at=now() where id=t.id;return;
 end if;
 if v_execute then
   if coalesce(array_length(t.offered_player_ids,1),0)<>coalesce(array_length(t.requested_player_ids,1),0) then raise exception 'Trades must exchange the same number of players';end if;
   if exists(select 1 from unnest(t.offered_player_ids)id where not exists(select 1 from jsonb_array_elements(coalesce(p.roster,'[]'::jsonb))e where e->>'id'=id)) then raise exception 'Proposer roster changed';end if;
   if exists(select 1 from unnest(t.requested_player_ids)id where not exists(select 1 from jsonb_array_elements(coalesce(r.roster,'[]'::jsonb))e where e->>'id'=id)) then raise exception 'Recipient roster changed';end if;
   select coalesce(jsonb_agg(e),'[]'::jsonb) into p_new from(select e from jsonb_array_elements(coalesce(p.roster,'[]'::jsonb))e where not((e->>'id')=any(t.offered_player_ids)) union all select e from jsonb_array_elements(coalesce(r.roster,'[]'::jsonb))e where(e->>'id')=any(t.requested_player_ids))q;
   select coalesce(jsonb_agg(e),'[]'::jsonb) into r_new from(select e from jsonb_array_elements(coalesce(r.roster,'[]'::jsonb))e where not((e->>'id')=any(t.requested_player_ids)) union all select e from jsonb_array_elements(coalesce(p.roster,'[]'::jsonb))e where(e->>'id')=any(t.offered_player_ids))q;
   if jsonb_array_length(p_new)<>20 or jsonb_array_length(r_new)<>20 then raise exception 'Trade would create an invalid roster size';end if;
   select salary_cap into cap from public.ball_knower_leagues where id=t.league_id;
   select coalesce(sum(coalesce((e->>'salary')::numeric,0)),0) into p_spent from jsonb_array_elements(p_new)e;select coalesce(sum(coalesce((e->>'salary')::numeric,0)),0) into r_spent from jsonb_array_elements(r_new)e;
   if p_spent>cap or r_spent>cap then raise exception 'Trade would put a team over the salary cap';end if;
   update public.ball_knower_league_members set roster=p_new,status='building',team_ratings=null,submitted_at=null where id=p.id;update public.ball_knower_league_members set roster=r_new,status='building',team_ratings=null,submitted_at=null where id=r.id;
   update public.ball_knower_trades set status='accepted',resolved_at=now() where id=t.id;
   insert into public.ball_knower_transactions(league_id,member_id,transaction_type,summary,metadata) values(t.league_id,p.id,'trade','Trade completed between '||p.user_name||' and '||r.user_name,jsonb_build_object('tradeId',t.id,'reviewed',p_action='approved'));
 end if;
end;$$;

revoke all on function public.save_my_ball_knower_weekly_lineup(text,integer,jsonb,jsonb) from public;
revoke all on function public.set_my_ball_knower_ir(text,text,boolean) from public;
revoke all on function public.counter_ball_knower_trade(uuid,text[],text[],text) from public;
grant execute on function public.save_my_ball_knower_weekly_lineup(text,integer,jsonb,jsonb) to authenticated;
grant execute on function public.set_my_ball_knower_ir(text,text,boolean) to authenticated;
grant execute on function public.counter_ball_knower_trade(uuid,text[],text[],text) to authenticated;
