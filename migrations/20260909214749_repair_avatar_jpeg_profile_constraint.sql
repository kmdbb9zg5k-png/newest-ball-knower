-- The JPEG client/bucket hotfix reached production after the original JPEG
-- migration's timestamp had already been passed. Repair the remaining legacy
-- WebP-only table constraint with a forward-dated, independently verifiable
-- migration so 512x512 .jpg uploads can be committed to the user's profile.

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

do $$
declare
  v_definition text;
begin
  select pg_get_constraintdef(oid)
    into v_definition
    from pg_constraint
   where conrelid='public.ball_knower_user_profiles'::regclass
     and conname='ball_knower_user_profiles_avatar_path_shape';

  if v_definition is null or v_definition not like '%(webp|jpg)%' then
    raise exception 'Ball Knower profile path constraint must allow WebP and JPEG avatars';
  end if;
end;
$$;
