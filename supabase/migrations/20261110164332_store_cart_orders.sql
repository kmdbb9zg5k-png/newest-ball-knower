-- Private ledger: clients never write payment status or grants.
create table public.bk_store_orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 mode text not null check(mode in ('test','live')),
 provider text not null check(provider in ('stripe','paypal')),
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 20),
 amount integer not null check(amount>0),
 provider_id text,
 payment_id text,
 status text not null default 'pending' check(status in ('pending','paid','expired','refunded','disputed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(provider,mode,provider_id)
);
create index bk_store_orders_user on public.bk_store_orders(user_id,mode);
create unique index bk_store_one_pending on public.bk_store_orders(user_id,mode) where status='pending';
alter table public.bk_store_orders enable row level security;
revoke all on public.bk_store_orders from public,anon,authenticated;
grant select,insert,update,delete on public.bk_store_orders to service_role;

create function public.bk_store_begin(p_user uuid,p_mode text,p_provider text,p_items jsonb,p_amount integer)
returns public.bk_store_orders language plpgsql security invoker set search_path='' as $$
declare result public.bk_store_orders;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||':store:'||p_mode,0));
 select * into result from public.bk_store_orders where user_id=p_user and mode=p_mode and status='pending';
 if found then
  if result.items<>p_items or result.provider<>p_provider then raise exception 'PENDING_CART'; end if;
  return result;
 end if;
 if exists(select 1 from public.bk_store_orders o, jsonb_array_elements(o.items) owned, jsonb_array_elements(p_items) requested
  where o.user_id=p_user and o.mode=p_mode and o.status='paid' and owned->>'id'=requested->>'id') then raise exception 'ALREADY_OWNED'; end if;
 insert into public.bk_store_orders(user_id,mode,provider,items,amount) values(p_user,p_mode,p_provider,p_items,p_amount) returning * into result;
 return result;
end $$;
create function public.bk_store_settle(p_id uuid,p_provider_id text,p_payment_id text,p_status text)
returns public.bk_store_orders language plpgsql security invoker set search_path='' as $$
declare result public.bk_store_orders;
begin
 select * into strict result from public.bk_store_orders where id=p_id for update;
 if p_provider_id is null or (result.provider_id is not null and result.provider_id<>p_provider_id)
 or (result.payment_id is not null and p_payment_id is not null and result.payment_id<>p_payment_id) then raise exception 'binding mismatch'; end if;
 if p_status not in ('pending','paid','expired','refunded','disputed') then raise exception 'invalid state'; end if;
 update public.bk_store_orders set provider_id=p_provider_id,payment_id=coalesce(payment_id,p_payment_id),
 status=case when status in ('refunded','disputed','expired') then status
 when p_status in ('refunded','disputed') then p_status
 when status='paid' then 'paid' else p_status end,updated_at=now() where id=p_id returning * into result;
 return result;
end $$;
revoke all on function public.bk_store_begin(uuid,text,text,jsonb,integer),public.bk_store_settle(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.bk_store_begin(uuid,text,text,jsonb,integer),public.bk_store_settle(uuid,text,text,text) to service_role;

create table public.bk_store_outfits (
 user_id uuid not null references auth.users(id) on delete cascade,
 mode text not null check(mode in ('test','live')),
 outfit jsonb not null default '{}',
 updated_at timestamptz not null default now(),
 primary key(user_id,mode)
);
alter table public.bk_store_outfits enable row level security;
revoke all on public.bk_store_outfits from public,anon,authenticated;
grant select,insert,update,delete on public.bk_store_outfits to service_role;
