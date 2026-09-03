-- Secure, user-owned profile photos. The bucket is public for avatar rendering,
-- while listing and every mutation remain restricted to the authenticated
-- owner's UUID folder. Only the path is persisted in application tables.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ball-knower-avatars','ball-knower-avatars',true,2097152,array['image/webp'])
on conflict(id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

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
  and lower(storage.extension(name))='webp'
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
  and lower(storage.extension(name))='webp'
);

drop policy if exists bk_avatar_delete_own on storage.objects;
create policy bk_avatar_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id='ball-knower-avatars'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

create table if not exists public.ball_knower_user_profiles(
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ball_knower_user_profiles_avatar_path_shape check (
    avatar_path is null
    or (
      length(avatar_path)<=96
      and avatar_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
    )
  )
);

alter table public.ball_knower_user_profiles enable row level security;

drop policy if exists bk_user_profiles_read_own on public.ball_knower_user_profiles;
create policy bk_user_profiles_read_own on public.ball_knower_user_profiles
for select to authenticated
using (auth_user_id=(select auth.uid()));

revoke all on table public.ball_knower_user_profiles from public,anon,authenticated;
grant select on table public.ball_knower_user_profiles to authenticated;

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
    '^'||v_user_id::text||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
  ) then
    raise exception 'Profile photo path must belong to the authenticated user';
  end if;

  insert into public.ball_knower_user_profiles(auth_user_id,avatar_path,updated_at)
  values(v_user_id,p_avatar_path,v_updated_at)
  on conflict(auth_user_id) do update set
    avatar_path=excluded.avatar_path,
    updated_at=excluded.updated_at;

  -- Existing league rows are the privacy-safe identity projection consumed by
  -- standings, matchups, chat, and draft screens. Never expose the private
  -- account-profile table to unrelated users.
  update public.ball_knower_league_members
     set user_avatar=p_avatar_path
   where auth_user_id=v_user_id
     and coalesce(is_ai,false)=false;

  return query select p_avatar_path,v_updated_at;
end;
$function$;

revoke all on function public.set_ball_knower_profile_photo(text) from public,anon;
grant execute on function public.set_ball_knower_profile_photo(text) to authenticated;

