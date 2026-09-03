-- Keep the profile-photo ownership policies init-plan friendly. Selecting the
-- auth JWT once avoids re-evaluating auth.jwt() for every candidate row.

alter policy bk_avatar_list_own on storage.objects
using (
  bucket_id='ball-knower-avatars'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)=false
);

alter policy bk_avatar_insert_own on storage.objects
with check (
  bucket_id='ball-knower-avatars'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and lower(storage.extension(name))='webp'
  and coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)=false
);

alter policy bk_avatar_update_own on storage.objects
using (
  bucket_id='ball-knower-avatars'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)=false
)
with check (
  bucket_id='ball-knower-avatars'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and lower(storage.extension(name))='webp'
  and coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)=false
);

alter policy bk_avatar_delete_own on storage.objects
using (
  bucket_id='ball-knower-avatars'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)=false
);

alter policy bk_user_profiles_read_own on public.ball_knower_user_profiles
using (
  auth_user_id=(select auth.uid())
  and coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)=false
);
