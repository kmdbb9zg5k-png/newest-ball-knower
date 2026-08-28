-- Run after the automatic transaction migration. Everything rolls back.
begin;

insert into public.ball_knower_leagues(id,code,name,max_members,salary_cap,commissioner_auth_id,commissioner_name,settings)
values('bk-waiver-sim','BK-SIM27','Waiver Simulation',10,500,'00000000-0000-0000-0000-000000000001','Simulator','{"waiverType":"faab","freeAgentMode":"instant","waiverDays":2}'::jsonb);

insert into public.ball_knower_league_members(id,league_id,auth_user_id,user_name,is_ai,roster,faab_balance,waiver_priority)
select 'bk-sim-m'||n,'bk-waiver-sim',case when n=1 then '00000000-0000-0000-0000-000000000001'::uuid else null end,'Manager '||n,n<>1,
case when n=5 then '[{"id":"old-x","name":"Old Player","salary":1}]'::jsonb else '[]'::jsonb end,100,n
from generate_series(1,10)n;

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select public.submit_ball_knower_player_move('bk-waiver-sim','{"id":"instant-f","name":"Instant Free Agent","salary":1}'::jsonb,null,0,1,null);

update public.ball_knower_leagues set settings=settings||'{"freeAgentMode":"continuous"}'::jsonb where id='bk-waiver-sim';

insert into public.ball_knower_waiver_claims(league_id,member_id,player_id,player_snapshot,faab_bid,claim_group_id,claim_order,process_at,created_at,drop_player_id) values
('bk-waiver-sim','bk-sim-m1','player-a','{"id":"player-a","name":"Player A","salary":1}',10,'10000000-0000-0000-0000-000000000001',1,now()-interval '1 minute',now()-interval '10 seconds',null),
('bk-waiver-sim','bk-sim-m1','player-b','{"id":"player-b","name":"Player B","salary":1}',5,'10000000-0000-0000-0000-000000000001',2,now()-interval '1 minute',now()-interval '9 seconds',null),
('bk-waiver-sim','bk-sim-m2','player-a','{"id":"player-a","name":"Player A","salary":1}',20,'20000000-0000-0000-0000-000000000002',1,now()-interval '1 minute',now()-interval '8 seconds',null),
('bk-waiver-sim','bk-sim-m3','player-a','{"id":"player-a","name":"Player A","salary":1}',20,'30000000-0000-0000-0000-000000000003',1,now()-interval '1 minute',now()-interval '7 seconds',null),
('bk-waiver-sim','bk-sim-m4','player-c','{"id":"player-c","name":"Player C","salary":1}',200,'40000000-0000-0000-0000-000000000004',1,now()-interval '1 minute',now()-interval '6 seconds',null),
('bk-waiver-sim','bk-sim-m5','player-d','{"id":"player-d","name":"Player D","salary":1}',15,'50000000-0000-0000-0000-000000000005',1,now()-interval '1 minute',now()-interval '5 seconds','old-x'),
('bk-waiver-sim','bk-sim-m6','player-e','{"id":"player-e","name":"Player E","salary":1}',6,'60000000-0000-0000-0000-000000000006',1,now()-interval '1 minute',now()-interval '4 seconds',null),
('bk-waiver-sim','bk-sim-m7','player-e','{"id":"player-e","name":"Player E","salary":1}',7,'70000000-0000-0000-0000-000000000007',1,now()-interval '1 minute',now()-interval '3 seconds',null),
('bk-waiver-sim','bk-sim-m8','player-e','{"id":"player-e","name":"Player E","salary":1}',8,'80000000-0000-0000-0000-000000000008',1,now()-interval '1 minute',now()-interval '2 seconds',null),
('bk-waiver-sim','bk-sim-m9','player-e','{"id":"player-e","name":"Player E","salary":1}',9,'90000000-0000-0000-0000-000000000009',1,now()-interval '1 minute',now()-interval '1 second',null),
('bk-waiver-sim','bk-sim-m10','player-e','{"id":"player-e","name":"Player E","salary":1}',10,'a0000000-0000-0000-0000-000000000010',1,now()-interval '1 minute',now(),null);

select public.process_due_ball_knower_waivers(now()+interval '1 minute');

do $$
begin
  if (select count(*) from public.ball_knower_waiver_claims where league_id='bk-waiver-sim' and status='won')<>4 then raise exception 'Expected four winning claims'; end if;
  if not exists(select 1 from public.ball_knower_league_members m,jsonb_array_elements(m.roster)e where m.id='bk-sim-m2' and e->>'id'='player-a') then raise exception 'FAAB tie did not use waiver priority'; end if;
  if not exists(select 1 from public.ball_knower_league_members m,jsonb_array_elements(m.roster)e where m.id='bk-sim-m1' and e->>'id'='player-b') then raise exception 'Conditional fallback did not execute'; end if;
  if not exists(select 1 from public.ball_knower_league_members m,jsonb_array_elements(m.roster)e where m.id='bk-sim-m10' and e->>'id'='player-e') then raise exception 'Highest FAAB bid did not win'; end if;
  if not exists(select 1 from public.ball_knower_waiver_claims where member_id='bk-sim-m4' and status='lost' and failure_reason like '%exceeds%') then raise exception 'Invalid FAAB claim was not safely rejected'; end if;
  if not exists(select 1 from public.ball_knower_player_waivers where league_id='bk-waiver-sim' and player_id='old-x') then raise exception 'Dropped player did not enter waivers'; end if;
  if (select count(*) from public.ball_knower_transactions where league_id='bk-waiver-sim')<>5 then raise exception 'Transaction history is incomplete'; end if;
end$$;

select public.process_due_ball_knower_waivers(now()+interval '2 minutes');

do $$ begin
  if (select count(*) from public.ball_knower_waiver_claims where league_id='bk-waiver-sim' and status='won')<>4 then raise exception 'Second run was not idempotent'; end if;
end$$;

rollback;
