create schema bk_store_private;
revoke all on schema bk_store_private from public, anon, authenticated;
grant usage on schema bk_store_private to authenticated;

create table bk_store_private.character_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code_hash bytea not null check (octet_length(code_hash) = 32),
  skus text[] not null check (cardinality(skus) between 1 and 20),
  redeemed_at timestamptz
);
alter table bk_store_private.character_codes enable row level security;
revoke all on bk_store_private.character_codes from public, anon, authenticated;

create function bk_store_private.character_code_access(p_code text)
returns table (sku text)
language plpgsql security definer set search_path = ''
as $$
declare
  buyer uuid := auth.uid();
begin
  if buyer is null or (auth.jwt()->>'is_anonymous') is distinct from 'false' then
    return;
  end if;

  if p_code is null then
    return query
      select pg_catalog.unnest(c.skus)
      from bk_store_private.character_codes c
      where c.user_id = buyer and c.redeemed_at is not null;
  elsif pg_catalog.length(p_code) between 1 and 80 then
    return query
      with redeemed as (
        update bk_store_private.character_codes c
          set redeemed_at = coalesce(c.redeemed_at, pg_catalog.now())
          where c.user_id = buyer
            and c.code_hash = pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.upper(pg_catalog.btrim(p_code)), 'UTF8'))
          returning c.skus
      )
      select pg_catalog.unnest(redeemed.skus) from redeemed;
  end if;
end;
$$;

create function public.bk_store_character_code(p_code text default null)
returns table (sku text)
language sql security invoker set search_path = ''
as $$
  select sku from bk_store_private.character_code_access(p_code);
$$;

revoke all on function bk_store_private.character_code_access(text), public.bk_store_character_code(text)
  from public, anon, authenticated;
grant execute on function bk_store_private.character_code_access(text), public.bk_store_character_code(text)
  to authenticated;
