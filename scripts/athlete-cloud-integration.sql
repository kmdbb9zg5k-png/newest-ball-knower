-- Run with the project's privileged SQL executor. Every fixture rolls back.
begin;
do $$ declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); n integer;
begin
insert into auth.users(id,aud,role,email,is_anonymous,raw_app_meta_data,raw_user_meta_data)
select x,'authenticated','authenticated',x::text||'@athlete-sync-fixture.invalid',false,'{}'::jsonb,'{}'::jsonb from unnest(array[a,b]) x;
perform set_config('request.jwt.claim.sub',a::text,true);
perform set_config('role','authenticated',true);
insert into public.ball_knower_user_state(user_id,state_key,value) values
(a,'solo_my_player_v2','{"raw":"profile fixture"}'),
(a,'solo_my_player_season_v2','{"raw":"season fixture"}');
select count(*) into n from public.ball_knower_user_state where user_id=a and state_key in('solo_my_player_v2','solo_my_player_season_v2');
assert n=2,'New v2 keys must be writable and readable by owner';
perform set_config('request.jwt.claim.sub',b::text,true);
select count(*) into n from public.ball_knower_user_state where user_id=a;
assert n=0,'Other account cannot read athlete state';
perform set_config('role','none',true);
end $$;
rollback;
