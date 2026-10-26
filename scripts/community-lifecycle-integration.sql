-- Run against an initialized Ball Knower database. All fixture rows roll back.
begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); m uuid; other uuid; home jsonb; failed boolean;
begin
  insert into auth.users(id,aud,role,email,is_anonymous,raw_app_meta_data,raw_user_meta_data)
    select id,'authenticated','authenticated',id::text||'@community-fixture.invalid',false,'{}'::jsonb,'{}'::jsonb from unnest(array[a,b,c]) id;
  insert into public.ball_knower_progress_profiles(user_id,display_name)
    select id,'Community lifecycle fixture' from unnest(array[a,b,c]) id on conflict(user_id) do nothing;
  insert into public.ball_knower_friendships(requester_id,recipient_id,status) values(a,b,'accepted'),(a,c,'accepted');
  perform set_config('request.jwt.claim.sub',a::text,true);
  failed:=false;
  begin perform public.start_ball_knower_h2h(a); exception when others then failed:=sqlerrm='Choose another Ball Knower'; end;
  assert failed,'Self challenge must be rejected';
  insert into public.ball_knower_user_blocks(blocker_id,blocked_id) values(b,a);
  failed:=false;
  begin perform public.start_ball_knower_h2h(b); exception when others then failed:=sqlerrm='Challenge is unavailable'; end;
  assert failed,'Bilateral block must reject challenge creation';
  delete from public.ball_knower_user_blocks where blocker_id=b and blocked_id=a;
  m:=public.start_ball_knower_h2h(b);
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform public.respond_ball_knower_h2h(m,true);
  assert (select status='active' from public.ball_knower_h2h_matches where id=m),'Accepted challenge becomes active';
  perform set_config('request.jwt.claim.sub',c::text,true);
  failed:=false;
  begin perform public.start_ball_knower_h2h(a); exception when others then failed:=sqlerrm like 'Your friend already has an H2H%'; end;
  assert failed,'Busy opponent must reject a second challenge';
  -- Simulate returning to an unfinished game after a long absence.
  update public.ball_knower_h2h_matches set started_at=now()-interval '8 days',created_at=now()-interval '8 days' where id=m;
  perform set_config('request.jwt.claim.sub',a::text,true);
  home:=public.get_ball_knower_community_home();
  assert exists(select 1 from jsonb_array_elements(home->'matches') x where x->>'id'=m::text),'Old active game must remain reachable';
  other:=public.start_ball_knower_h2h(c);
  assert (select status='completed' from public.ball_knower_h2h_matches where id=m),'Expired game must settle before the next challenge';
  assert (select h2h_ties=1 from public.ball_knower_progress_profiles where user_id=a),'Scoring applied once';
  perform public.finish_ball_knower_h2h(m);
  assert (select h2h_ties=1 from public.ball_knower_progress_profiles where user_id=a),'Repeated finish must be idempotent';
  perform public.cancel_ball_knower_h2h(other);
  -- Caller C did not participate in A/B's prior game: inviting A must still recover it.
  m:=public.start_ball_knower_h2h(b);
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform public.respond_ball_knower_h2h(m,true);
  update public.ball_knower_h2h_matches set started_at=now()-interval '70 seconds' where id=m;
  perform set_config('request.jwt.claim.sub',c::text,true);
  other:=public.start_ball_knower_h2h(a);
  assert (select status='completed' from public.ball_knower_h2h_matches where id=m),'Invited friend expired game must settle';
  perform public.cancel_ball_knower_h2h(other);
  perform set_config('request.jwt.claim.sub',a::text,true);
  assert not has_function_privilege('authenticated','ball_knower_private.complete_h2h_match(uuid)','execute'),'Internal completion must not be executable by clients';

  m:=public.start_ball_knower_h2h(b);
  update public.ball_knower_h2h_matches set created_at=now()-interval '11 minutes' where id=m;
  perform set_config('request.jwt.claim.sub',b::text,true);
  failed:=false;
  begin perform public.respond_ball_knower_h2h(m,true); exception when others then failed:=sqlerrm like 'Challenge expired%'; end;
  assert failed,'Expired invitation cannot start a game';
  assert not has_function_privilege('anon','public.start_ball_knower_h2h(uuid)','execute'),'Anonymous execute remains revoked';
  assert has_function_privilege('authenticated','public.start_ball_knower_h2h(uuid)','execute'),'Signed in execute remains available';
  raise notice 'Community lifecycle integration passed';
end $$;
rollback;
