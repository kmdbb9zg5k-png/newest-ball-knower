begin;
-- Synthetic users and results only; entire fixture rolls back.
create function pg_temp.arena_reject(action text,args jsonb) returns boolean language plpgsql as $$
begin perform public.ball_knower_football_arena(action,args);return false;exception when others then return true;end $$;
do $$
<<fixture>>
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();outsider uuid:=gen_random_uuid();guest uuid:=gen_random_uuid();
 mid uuid;tieid uuid;expiryid uuid;tok text;launch uuid;response jsonb;row jsonb;n integer;who uuid;allowed boolean;
begin
 insert into auth.users(id,aud,role,email,is_anonymous,raw_app_meta_data,raw_user_meta_data)
 select x,'authenticated','authenticated',x::text||'@football-arena-fixture.invalid',x=guest,'{}'::jsonb,'{}'::jsonb from unnest(array[a,b,outsider,guest]) x;
 insert into public.ball_knower_progress_profiles(user_id,display_name) select x,'Football arena test' from unnest(array[a,b,outsider]) x on conflict(user_id) do nothing;
 insert into public.ball_knower_friendships(requester_id,recipient_id,status) values(a,b,'accepted');
 perform set_config('request.jwt.claim.sub',guest::text,true);perform set_config('role','authenticated',true);
 assert pg_temp.arena_reject('home','{}'), 'Anonymous auth cannot participate';
 perform set_config('request.jwt.claim.sub',a::text,true);
 assert pg_temp.arena_reject('create','{"team":"INVALID"}'), 'Unknown roster rejected';
 assert pg_temp.arena_reject('create',jsonb_build_object('team','JCY','opponent',outsider)), 'Friendship required';
 mid:=(public.ball_knower_football_arena('create',jsonb_build_object('team','JCY','opponent',b))->>'id')::uuid;
 assert pg_temp.arena_reject('accept',jsonb_build_object('id',mid,'team','BRK')), 'No self acceptance';
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 assert pg_temp.arena_reject('accept',jsonb_build_object('id',mid,'team','BRK')), 'Invitation is private';
 assert pg_temp.arena_reject('begin',jsonb_build_object('id',mid,'drive',1,'launch',gen_random_uuid())), 'No outsider attempts';
 response:=public.ball_knower_football_arena('home');
 assert not exists(select 1 from jsonb_array_elements(response->'matches') x where x->>'id'=mid::text), 'No private history leak';
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform public.ball_knower_football_arena('accept',jsonb_build_object('id',mid,'team','BRK'));
 assert pg_temp.arena_reject('accept',jsonb_build_object('id',mid,'team','MIL')), 'Cannot change locked team';
 foreach who in array array[a,b] loop
   perform set_config('request.jwt.claim.sub',who::text,true);
   assert pg_temp.arena_reject('begin',jsonb_build_object('id',mid,'drive',3,'launch',gen_random_uuid())), 'No skipping drives';
   for n in 1..3 loop
     launch:=gen_random_uuid();response:=public.ball_knower_football_arena('begin',jsonb_build_object('id',mid,'drive',n,'launch',launch));tok:=response->>'token';
     assert response->>'team'=case when who=a then 'JCY' else 'BRK' end and response->>'opponent'=case when who=a then 'BRK' else 'JCY' end, 'Opponent defense matchup';
     assert (public.ball_knower_football_arena('begin',jsonb_build_object('id',mid,'drive',n,'launch',launch))->>'token')=tok, 'Lost response retry is stable';
     assert pg_temp.arena_reject('begin',jsonb_build_object('id',mid,'drive',n,'launch',gen_random_uuid())), 'Cannot restart drive';
     assert pg_temp.arena_reject('submit',jsonb_build_object('id',mid,'drive',n,'token',tok,'stats','{"points":8,"yards":75,"plays":1}'::jsonb)), 'Immediate fake result rejected';
     perform set_config('role','none',true);
     update bk_football_private.drives set started_at=now()-interval '1 minute' where match_id=mid and user_id=who and ordinal=n;
     perform set_config('role','authenticated',true);
     assert pg_temp.arena_reject('submit',jsonb_build_object('id',mid,'drive',n,'token',gen_random_uuid(),'stats','{"points":8,"yards":75,"plays":1}'::jsonb)), 'Wrong token rejected';
     assert pg_temp.arena_reject('submit',jsonb_build_object('id',mid,'drive',n,'token',tok,'stats','{"points":24,"yards":75,"plays":1}'::jsonb)), 'Impossible single-drive score';
     assert pg_temp.arena_reject('submit',jsonb_build_object('id',mid,'drive',n,'token',tok,'stats','{"points":8,"yards":75}'::jsonb)), 'Missing stats';
     assert pg_temp.arena_reject('submit',jsonb_build_object('id',mid,'drive',n,'token',tok,'stats','{"points":8,"yards":75,"plays":1.5}'::jsonb)), 'Fractional count';
     response:=public.ball_knower_football_arena('submit',jsonb_build_object('id',mid,'drive',n,'token',tok,'stats',jsonb_build_object('points',case when who=a then 7 else 3 end,'yards',75,'plays',5)));
     response:=public.ball_knower_football_arena('submit',jsonb_build_object('id',mid,'drive',n,'token',tok,'stats','{"points":8,"yards":100,"plays":6}'::jsonb));
     assert (response->>'points')::int=case when who=a then 7 else 3 end, 'Result immutable';
     assert pg_temp.arena_reject('begin',jsonb_build_object('id',mid,'drive',n,'launch',launch)), 'Finished drive cannot relaunch';
   end loop;
 end loop;
 response:=public.ball_knower_football_arena('home');select x into row from jsonb_array_elements(response->'matches') x where x->>'id'=mid::text;
 assert row->>'status'='completed' and row->>'winner_id'=a::text, '21 to 9 winner';
 assert jsonb_array_length(row->'drives')=6 and not (row->'drives'->0)?'token' and not (row->'drives'->0)?'launch_id', 'Only safe drive data';
 select x into row from jsonb_array_elements(response->'standings') x where x->>'user_id'=a::text;
 assert row->>'wins'='1' and row->>'rating'='3', 'Standings derived once';
 assert pg_temp.arena_reject('begin',jsonb_build_object('id',mid,'drive',4,'launch',gen_random_uuid())), 'No fourth drive';
 -- Open mirror-team match, interrupted drive and automatic expiry tie.
 perform set_config('request.jwt.claim.sub',a::text,true);
 tieid:=(public.ball_knower_football_arena('create','{"team":"MIL"}')->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform public.ball_knower_football_arena('accept',jsonb_build_object('id',tieid,'team','MIL'));
 response:=public.ball_knower_football_arena('begin',jsonb_build_object('id',tieid,'drive',1,'launch',gen_random_uuid()));tok:=response->>'token';
 assert response->>'team'='MIL' and response->>'opponent'='MIL','Mirror matchup preserves chosen teams';
 perform public.ball_knower_football_arena('forfeit',jsonb_build_object('id',tieid,'drive',1));
 assert (public.ball_knower_football_arena('submit',jsonb_build_object('id',tieid,'drive',1,'token',tok,'stats','{"points":8,"yards":75,"plays":1}'::jsonb))->>'points')='0','Forfeit cannot be overwritten';
 response:=public.ball_knower_football_arena('begin',jsonb_build_object('id',tieid,'drive',2,'launch',gen_random_uuid()));tok:=response->>'token';
 perform set_config('role','none',true);
 update bk_football_private.drives set deadline=now()-interval '1 minute' where match_id=tieid and ordinal=2;
 perform set_config('role','authenticated',true);
 assert (public.ball_knower_football_arena('submit',jsonb_build_object('id',tieid,'drive',2,'token',tok,'stats','{"points":8,"yards":75,"plays":1}'::jsonb))->>'points')='0','Server attempt deadline';
 perform set_config('role','none',true);update bk_football_private.matches set expires_at=now()-interval '1 minute' where id=tieid;perform set_config('role','authenticated',true);
 response:=public.ball_knower_football_arena('home');select x into row from jsonb_array_elements(response->'matches') x where x->>'id'=tieid::text;
 assert row->>'status'='completed' and row->>'winner_id' is null and jsonb_array_length(row->'drives')=6,'Expired missing drives become zeros and tie';
 -- Block lists protect reads and new actions; raw tables are inaccessible.
 perform set_config('role','none',true);
 insert into public.ball_knower_user_blocks(blocker_id,blocked_id) values(a,b);
 perform set_config('role','authenticated',true);perform set_config('request.jwt.claim.sub',a::text,true);
 assert pg_temp.arena_reject('create',jsonb_build_object('team','JCY','opponent',b)), 'Blocked friend unavailable';
 response:=public.ball_knower_football_arena('home');assert not exists(select 1 from jsonb_array_elements(response->'matches') x where x->>'id'=mid::text),'Blocked history hidden';
 begin perform count(*) from bk_football_private.drives;allowed:=true;exception when insufficient_privilege then allowed:=false;end;
 assert not allowed,'No direct attempt read';
 begin update bk_football_private.matches set winner_id=a where id=mid;allowed:=true;exception when insufficient_privilege then allowed:=false;end;
 assert not allowed,'No direct score writes';
 perform set_config('role','none',true);
 assert not has_function_privilege('anon','public.ball_knower_football_arena(text,jsonb)','execute'),'No public RPC grant';
 assert not has_function_privilege('authenticated','bk_football_private.settle(uuid)','execute'),'Settlement internal only';
 raise notice 'PASS Football H2H: auth, friends, open matches, privacy, tokens, sequence, immutable results, teams, standings, forfeit, deadlines, expiry, ties, blocks and grants';
end $$;
rollback;
