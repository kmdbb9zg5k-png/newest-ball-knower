begin;
-- All identities and results roll back. Exercise the public RPC as authenticated,
-- never submit a score for a real player.
create function pg_temp.must_reject(action text,args jsonb) returns boolean language plpgsql as $$
begin perform public.ball_knower_mini_challenges(action,args);return false;exception when others then return true;end $$;
do $$
<<fixture>>
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); guest uuid:=gen_random_uuid();
 id uuid; tok text; game text; leftstats jsonb; rightstats jsonb; row jsonb; response jsonb; i integer:=0;
begin
 insert into auth.users(id,aud,role,email,is_anonymous,raw_app_meta_data,raw_user_meta_data)
 select x,'authenticated','authenticated',x::text||'@mini-challenge-fixture.invalid',x=guest,'{}'::jsonb,'{}'::jsonb from unnest(array[a,b,outsider,guest]) x;
 insert into public.ball_knower_progress_profiles(user_id,display_name) select x,'Mini game test' from unnest(array[a,b,outsider]) x on conflict(user_id) do nothing;
 insert into public.ball_knower_friendships(requester_id,recipient_id,status) values(a,b,'accepted');
 perform set_config('request.jwt.claim.sub',guest::text,true);perform set_config('role','authenticated',true);
 assert pg_temp.must_reject('create','{"game":"dash"}'), 'Anonymous auth must not compete';
 perform set_config('role','none',true);
 foreach game in array array['dash','broad-jump','shuttle','bench','routes','one-on-one','rb','db','two-minute','five-minute','career'] loop
  perform set_config('request.jwt.claim.sub',a::text,true);perform set_config('role','authenticated',true);
  assert pg_temp.must_reject('create',jsonb_build_object('game',game,'opponent',outsider)), 'A friend invite must require friendship';
  response:=public.ball_knower_mini_challenges('create',jsonb_build_object('game',game,'opponent',b));id:=(response->>'id')::uuid;
  assert pg_temp.must_reject('accept',jsonb_build_object('id',id)), 'Challenger cannot accept own challenge';
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  assert pg_temp.must_reject('accept',jsonb_build_object('id',id)), 'Outsider cannot steal invite';
  assert pg_temp.must_reject('begin',jsonb_build_object('id',id)), 'Outsider cannot play';
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform public.ball_knower_mini_challenges('accept',jsonb_build_object('id',id));
  assert pg_temp.must_reject('accept',jsonb_build_object('id',id)), 'Cannot accept twice';
  perform set_config('request.jwt.claim.sub',a::text,true);
  assert pg_temp.must_reject('submit',jsonb_build_object('id',id,'token',gen_random_uuid(),'stats','{}'::jsonb)), 'Must begin before submitting';
  tok:=public.ball_knower_mini_challenges('begin',jsonb_build_object('id',id))->>'token';
  assert tok=public.ball_knower_mini_challenges('begin',jsonb_build_object('id',id))->>'token', 'Resume uses same attempt';
  perform set_config('role','none',true);
  update bk_minigames_private.attempts set started_at=now()-interval '10 minutes' where challenge_id=id;
  if game='career' then update bk_minigames_private.challenges set seed=100 where challenges.id=fixture.id; end if;
  leftstats:=case when game='career' then '{"raw0":80,"raw1":80,"raw2":80,"prep0":0,"prep1":1,"prep2":2,"film0":0,"film1":2,"film2":1}'::jsonb when game='dash' then '{"time":4.523,"split10":1.882,"split20":2.991}'::jsonb when game='shuttle' then '{"time":4.512,"penalty":0.12}'::jsonb when game='bench' then '{"reps":25}'::jsonb when game='broad-jump' then '{"distance":2.789}'::jsonb when game in('two-minute','five-minute') then '{"points":30,"yards":180,"turnovers":1}'::jsonb else jsonb_build_object('score',80,'reps',case when game='routes' then 8 else 5 end) end;
  rightstats:=case when game='career' then leftstats||'{"raw0":70,"raw1":70,"raw2":70}'::jsonb when game='dash' then '{"time":4.8,"split10":2.0,"split20":3.2}'::jsonb when game='shuttle' then '{"time":4.9,"penalty":0.2}'::jsonb when game='bench' then '{"reps":20}'::jsonb when game='broad-jump' then '{"distance":2.5}'::jsonb when game in('two-minute','five-minute') then '{"points":30,"yards":180,"turnovers":2}'::jsonb else jsonb_build_object('score',70,'reps',case when game='routes' then 8 else 5 end) end;
  perform set_config('role','authenticated',true);
  assert pg_temp.must_reject('submit',jsonb_build_object('id',id,'token',gen_random_uuid(),'stats',leftstats)), 'Reject wrong attempt token';
  assert pg_temp.must_reject('submit',jsonb_build_object('id',id,'token',tok,'stats',leftstats||'{"rating":999}'::jsonb)), 'Reject unrecognized stats';
  assert pg_temp.must_reject('submit',jsonb_build_object('id',id,'token',tok,'stats',leftstats||'{"reps":null}'::jsonb)), 'Reject null stats';
  if game in('routes','one-on-one','rb','db') then
   assert pg_temp.must_reject('submit',jsonb_build_object('id',id,'token',tok,'stats',leftstats||'{"reps":1}'::jsonb)), 'Cannot post incomplete session';
  end if;
  if game='career' then
   assert pg_temp.must_reject('submit',jsonb_build_object('id',id,'token',tok,'stats',leftstats-'raw2')), 'Reject unfinished career';
   assert pg_temp.must_reject('submit',jsonb_build_object('id',id,'token',tok,'stats',leftstats||'{"raw2":101}'::jsonb)), 'Reject impossible tape';
   assert pg_temp.must_reject('submit',jsonb_build_object('id',id,'token',tok,'stats',leftstats||'{"prep2":3}'::jsonb)), 'Reject unknown decision';
   assert pg_temp.must_reject('submit',jsonb_build_object('id',id,'token',tok,'stats',leftstats||'{"film2":1.5}'::jsonb)), 'Reject fractional decision';
   assert pg_temp.must_reject('submit',jsonb_build_object('id',id,'token',tok,'stats',leftstats||'{"score":100,"validated":1}'::jsonb)), 'Cannot self-verify or choose final score';
  end if;
  response:=public.ball_knower_mini_challenges('submit',jsonb_build_object('id',id,'token',tok,'stats',leftstats));
  if game='career' then
    assert response->'stats'->>'score'='85' and response->'stats'->>'correct'='3' and response->'stats'->>'validated'='1', 'Server arithmetic must match client';
    leftstats:=response->'stats';
  end if;
  perform public.ball_knower_mini_challenges('submit',jsonb_build_object('id',id,'token',tok,'stats',rightstats));
  perform set_config('request.jwt.claim.sub',b::text,true);
  tok:=public.ball_knower_mini_challenges('begin',jsonb_build_object('id',id))->>'token';
  perform set_config('role','none',true);
  update bk_minigames_private.attempts set started_at=now()-interval '10 minutes' where challenge_id=id;
  perform set_config('role','authenticated',true);
  perform public.ball_knower_mini_challenges('submit',jsonb_build_object('id',id,'token',tok,'stats',rightstats));
  response:=public.ball_knower_mini_challenges('list');
  select x into row from jsonb_array_elements(response) x where x->>'id'=id::text;
  assert row->>'status'='completed' and row->>'winner_id'=a::text, 'Expected correct winner for '||game;
  assert row->'challenger_stats'=leftstats, 'Locked score must not change';
  perform set_config('role','none',true);
  i:=i+1;
 end loop;
 -- Open acceptance, exact tie, stale invitations, blocking and raw table access.
 perform set_config('request.jwt.claim.sub',a::text,true);perform set_config('role','authenticated',true);
 id:=(public.ball_knower_mini_challenges('create','{"game":"bench"}')->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',b::text,true);perform public.ball_knower_mini_challenges('accept',jsonb_build_object('id',id));
 perform set_config('role','none',true);
 insert into bk_minigames_private.attempts(challenge_id,user_id,started_at) values(id,a,now()-interval '1 minute'),(id,b,now()-interval '1 minute');
 select token::text into tok from bk_minigames_private.attempts where challenge_id=id and user_id=a;
 perform set_config('request.jwt.claim.sub',a::text,true);perform set_config('role','authenticated',true);
 perform public.ball_knower_mini_challenges('submit',jsonb_build_object('id',id,'token',tok,'stats','{"reps":10}'::jsonb));
 perform set_config('role','none',true);select token::text into tok from bk_minigames_private.attempts where challenge_id=id and user_id=b;
 perform set_config('request.jwt.claim.sub',b::text,true);perform set_config('role','authenticated',true);
 perform public.ball_knower_mini_challenges('submit',jsonb_build_object('id',id,'token',tok,'stats','{"reps":10}'::jsonb));
 perform set_config('role','none',true);
 assert exists(select 1 from bk_minigames_private.challenges where challenges.id=fixture.id and status='completed' and winner_id is null), 'Equal results are a tie';
 perform set_config('request.jwt.claim.sub',a::text,true);perform set_config('role','authenticated',true);
 id:=(public.ball_knower_mini_challenges('create','{"game":"dash"}')->>'id')::uuid;
 perform set_config('role','none',true);update bk_minigames_private.challenges set expires_at=now()-interval '1 second' where challenges.id=fixture.id;
 perform set_config('request.jwt.claim.sub',b::text,true);perform set_config('role','authenticated',true);
 assert pg_temp.must_reject('accept',jsonb_build_object('id',id)), 'Expired challenges cannot start';
 perform set_config('request.jwt.claim.sub',a::text,true);
 id:=(public.ball_knower_mini_challenges('create',jsonb_build_object('game','dash','opponent',b))->>'id')::uuid;
 perform set_config('role','none',true);insert into public.ball_knower_user_blocks(blocker_id,blocked_id) values(b,a);
 perform set_config('request.jwt.claim.sub',b::text,true);perform set_config('role','authenticated',true);
 assert pg_temp.must_reject('accept',jsonb_build_object('id',id)), 'Block prevents acceptance';
 assert not exists(select 1 from jsonb_array_elements(public.ball_knower_mini_challenges('list')) x where x->>'id'=id::text), 'Blocked challenge hidden';
 begin perform count(*) from bk_minigames_private.challenges;raise exception 'Private tables were readable';exception when insufficient_privilege then null;end;
 perform set_config('role','none',true);
 assert not has_function_privilege('anon','public.ball_knower_mini_challenges(text,jsonb)','execute'), 'Guest cannot invoke challenge RPC';
 raise notice 'Passed: % game winners, exact tie, auth, invitations, open acceptance, tokens, idempotency, rep validation, expiry, blocking, table isolation',i;
end $$;
rollback;
