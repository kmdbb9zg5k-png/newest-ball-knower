-- Guests are real, UUID-owned Supabase users in Ball Knower. Let them create a
-- recognizable GM identity without forcing PII, while keeping every read and
-- mutation scoped to that user's folder/rows. Email can be linked later.

drop policy if exists bk_avatar_list_own on storage.objects;
create policy bk_avatar_list_own on storage.objects
for select to authenticated
using (
  bucket_id='ball-knower-avatars'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

drop policy if exists bk_avatar_insert_own on storage.objects;
create policy bk_avatar_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id='ball-knower-avatars'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and lower(storage.extension(name)) in ('webp','jpg')
);

drop policy if exists bk_avatar_update_own on storage.objects;
create policy bk_avatar_update_own on storage.objects
for update to authenticated
using (
  bucket_id='ball-knower-avatars'
  and (storage.foldername(name))[1]=(select auth.uid())::text
)
with check (
  bucket_id='ball-knower-avatars'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and lower(storage.extension(name)) in ('webp','jpg')
);

drop policy if exists bk_avatar_delete_own on storage.objects;
create policy bk_avatar_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id='ball-knower-avatars'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

drop policy if exists bk_user_profiles_read_own on public.ball_knower_user_profiles;
create policy bk_user_profiles_read_own on public.ball_knower_user_profiles
for select to authenticated
using (auth_user_id=(select auth.uid()));

create or replace function public.set_ball_knower_profile_photo(p_avatar_path text)
returns table(saved_avatar_path text,saved_updated_at timestamptz)
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid:=(select auth.uid());
  v_updated_at timestamptz:=clock_timestamp();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_avatar_path is not null and p_avatar_path !~ (
    '^'||v_user_id::text||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$'
  ) then
    raise exception 'Profile photo path must belong to the authenticated user';
  end if;

  insert into public.ball_knower_user_profiles(auth_user_id,avatar_path,updated_at)
  values(v_user_id,p_avatar_path,v_updated_at)
  on conflict(auth_user_id) do update set
    avatar_path=excluded.avatar_path,
    updated_at=excluded.updated_at;

  update public.ball_knower_league_members
     set user_avatar=p_avatar_path
   where auth_user_id=v_user_id
     and coalesce(is_ai,false)=false;

  return query select p_avatar_path,v_updated_at;
end;
$function$;

revoke all on function public.set_ball_knower_profile_photo(text) from public,anon;
grant execute on function public.set_ball_knower_profile_photo(text) to authenticated;

create or replace function public.set_ball_knower_profile_name(p_display_name text)
returns text
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid:=(select auth.uid());
  v_name text:=regexp_replace(btrim(coalesce(p_display_name,'')),'[[:space:]]+',' ','g');
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if char_length(v_name)<2 or char_length(v_name)>40 or v_name ~ '[[:cntrl:]]' then
    raise exception 'GM name must contain 2 to 40 valid characters';
  end if;

  update public.ball_knower_league_members
     set user_name=v_name
   where auth_user_id=v_user_id
     and coalesce(is_ai,false)=false;

  update public.ball_knower_leagues
     set commissioner_name=v_name
   where commissioner_auth_id=v_user_id;

  if to_regclass('public.ball_knower_progress_profiles') is not null then
    execute 'update public.ball_knower_progress_profiles set display_name=$1 where user_id=$2'
      using v_name,v_user_id;
  end if;
  if to_regclass('public.ball_knower_leaderboard') is not null then
    execute 'update public.ball_knower_leaderboard set display_name=$1 where auth_user_id=$2'
      using v_name,v_user_id;
  end if;
  if to_regclass('public.ball_knower_owner_profiles') is not null then
    execute 'update public.ball_knower_owner_profiles set display_name=$1 where auth_user_id=$2'
      using v_name,v_user_id;
  end if;

  return v_name;
end;
$function$;

revoke all on function public.set_ball_knower_profile_name(text) from public,anon;
grant execute on function public.set_ball_knower_profile_name(text) to authenticated;

