-- Verify public browse and unchanged private boundaries. All fixtures roll back.
begin;
do $$
declare person uuid:=gen_random_uuid(); guest uuid:=gen_random_uuid(); suspended uuid:=gen_random_uuid(); visible uuid;
begin
  insert into auth.users(id,aud,role,email,is_anonymous,raw_app_meta_data,raw_user_meta_data)
    select id,'authenticated','authenticated',id::text||'@community-guest-fixture.invalid',id=guest,'{}'::jsonb,'{}'::jsonb from unnest(array[person,guest,suspended]) id;
  insert into public.ball_knower_progress_profiles(user_id,display_name)
    select id,'Guest browse fixture' from unnest(array[person,guest,suspended]) id on conflict(user_id) do nothing;
  insert into public.ball_knower_community_messages(kind,author_id,body) values('global',person,'PUBLIC_GUEST_BROWSE') returning id into visible;
  insert into public.ball_knower_community_messages(kind,author_id,recipient_id,body) values('direct',person,guest,'PRIVATE_MUST_NOT_LEAK');
  insert into public.ball_knower_community_messages(kind,author_id,body,removed_at) values('global',person,'REMOVED_MUST_NOT_LEAK',now());
  insert into public.ball_knower_community_messages(kind,author_id,body) values('global',suspended,'SUSPENDED_MUST_NOT_LEAK'),('global',guest,'ANONYMOUS_MUST_NOT_LEAK');
  insert into ball_knower_private.community_suspensions(auth_user_id,reason,expires_at) values(suspended,'Fixture',now()+interval '1 hour');
  perform set_config('bk.guest_fixture',guest::text,true);
  perform set_config('bk.visible_fixture',visible::text,true);
end $$;
set local role anon;
set local request.jwt.claim.sub='';
do $$
declare payload jsonb:=public.get_ball_knower_community_preview(); denied boolean:=false;
begin
  assert payload->'friends'='[]'::jsonb and payload->'matches'='[]'::jsonb,'Guest browse must not expose private relationships or matches';
  assert jsonb_array_length(payload->'leaderboard')<=50 and jsonb_array_length(payload->'messages')<=75,'Guest browse must be bounded';
  assert exists(select 1 from jsonb_array_elements(payload->'messages') x where x->>'id'=current_setting('bk.visible_fixture')),'No-session visitors must see public chat';
  assert payload::text not like '%MUST_NOT_LEAK%','Private/removed/suspended/anonymous messages must not leak';
  assert not exists(select 1 from jsonb_array_elements(payload->'messages') x where x ? 'recipient_id'),'No recipient identifiers in public messages';
  assert not exists(select 1 from jsonb_array_elements(payload->'leaderboard') x where x ? 'email'),'No emails in public rankings';
  begin perform public.post_ball_knower_global_message('guest cannot post'); exception when insufficient_privilege then denied:=true; end;
  assert denied,'Unauthenticated writes must remain denied';
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('bk.guest_fixture'),true);
do $$
declare denied boolean:=false;
begin
  perform public.get_ball_knower_community_preview();
  begin perform public.post_ball_knower_global_message('anonymous cannot post'); exception when others then denied:=sqlerrm like 'Save or sign in%'; end;
  assert denied,'Anonymous authenticated sessions must remain unable to post';
  denied:=false;
  begin perform public.get_ball_knower_community_home(); exception when others then denied:=sqlerrm like 'Save or sign in%'; end;
  assert denied,'Private community home remains account-only';
  denied:=false;
  begin perform public.send_ball_knower_direct_message(current_setting('bk.guest_fixture')::uuid,'no'); exception when others then denied:=sqlerrm like 'Save or sign in%'; end;
  assert denied,'Guest DM writes remain denied';
  denied:=false;
  begin perform public.start_ball_knower_h2h(null); exception when others then denied:=sqlerrm like 'Save or sign in%'; end;
  assert denied,'Guest H2H writes remain denied';
end $$;
rollback;
