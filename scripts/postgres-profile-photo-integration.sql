\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant authenticated to postgres;

create schema auth;
create schema storage;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create function storage.foldername(value text) returns text[] language sql immutable as $$
  select string_to_array(value,'/')
$$;
create function storage.extension(value text) returns text language sql immutable as $$
  select split_part(value,'.',array_length(string_to_array(value,'.'),1))
$$;
create table storage.buckets(
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects(
  id uuid primary key,
  bucket_id text not null references storage.buckets(id),
  name text not null,
  mime_type text
);
alter table storage.objects enable row level security;
grant usage on schema storage,auth to authenticated;
grant select,insert,update,delete on storage.objects to authenticated;

create table public.ball_knower_league_members(
  id text primary key,
  auth_user_id uuid,
  user_avatar text,
  is_ai boolean not null default false
);
grant select on public.ball_knower_league_members to authenticated;

insert into auth.users(id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');
insert into public.ball_knower_league_members(id,auth_user_id) values
  ('member-one','11111111-1111-4111-8111-111111111111'),
  ('member-two','22222222-2222-4222-8222-222222222222');

\ir ../migrations/20260903080000_add_secure_profile_photos.sql

do $$
begin
  if not exists(
    select 1 from storage.buckets
    where id='ball-knower-avatars'
      and public
      and file_size_limit=2097152
      and allowed_mime_types=array['image/webp']
  ) then raise exception 'Avatar bucket restrictions are missing'; end if;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);

select public.set_ball_knower_profile_photo(
  '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp'
);

do $$
begin
  if (select count(*) from public.ball_knower_user_profiles)<>1 then
    raise exception 'The owner cannot read their own profile photo record';
  end if;
  if (select user_avatar from public.ball_knower_league_members where id='member-one')<>
    '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp' then
    raise exception 'Profile photo did not propagate to the owner membership';
  end if;
  if (select user_avatar from public.ball_knower_league_members where id='member-two') is not null then
    raise exception 'Profile photo crossed the ownership boundary';
  end if;
end;
$$;

insert into storage.objects(id,bucket_id,name,mime_type) values(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'ball-knower-avatars',
  '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp',
  'image/webp'
);

do $$
begin
  begin
    perform public.set_ball_knower_profile_photo(
      '22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp'
    );
    raise exception 'Cross-user profile overwrite unexpectedly succeeded';
  exception when others then
    if sqlerrm='Cross-user profile overwrite unexpectedly succeeded' then raise; end if;
  end;

  begin
    insert into storage.objects(id,bucket_id,name,mime_type) values(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'ball-knower-avatars',
      '22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp',
      'image/webp'
    );
    raise exception 'Cross-user storage write unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.ball_knower_user_profiles(auth_user_id,avatar_path) values(
      '11111111-1111-4111-8111-111111111111',null
    );
    raise exception 'Direct profile mutation unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $$
begin
  if (select count(*) from public.ball_knower_user_profiles)<>0 then
    raise exception 'Another user can enumerate private profile records';
  end if;
  if (select count(*) from storage.objects)<>0 then
    raise exception 'Another user can enumerate the owner avatar folder';
  end if;
end;
$$;

reset role;
select 'profile-photo ownership integration passed' as result;
