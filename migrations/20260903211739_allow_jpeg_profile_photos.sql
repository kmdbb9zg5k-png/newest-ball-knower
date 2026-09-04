-- iOS/WebKit can decode HEIC/HEIF sources but does not reliably return the
-- requested WebP encoding from canvas.toBlob. Store the processed 512x512
-- result as JPEG while preserving existing WebP avatars and owner-only paths.

update storage.buckets
set allowed_mime_types=array['image/webp','image/jpeg']
where id='ball-knower-avatars';

drop policy if exists bk_avatar_insert_own on storage.objects;
create policy bk_avatar_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id='ball-knower-avatars'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and lower(storage.extension(name)) in ('webp','jpg')
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)=false
);

drop policy if exists bk_avatar_update_own on storage.objects;
create policy bk_avatar_update_own on storage.objects
for update to authenticated
using (
  bucket_id='ball-knower-avatars'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)=false
)
with check (
  bucket_id='ball-knower-avatars'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and lower(storage.extension(name)) in ('webp','jpg')
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)=false
);

alter table public.ball_knower_user_profiles
  drop constraint if exists ball_knower_user_profiles_avatar_path_shape;

alter table public.ball_knower_user_profiles
  add constraint ball_knower_user_profiles_avatar_path_shape check (
    avatar_path is null
    or (
      length(avatar_path)<=96
      and avatar_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg)$'
    )
  );

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
  if coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false) then
    raise exception 'A permanent account is required';
  end if;
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
