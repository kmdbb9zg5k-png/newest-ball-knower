-- Sandbox-only ledger. It intentionally never writes live/legacy entitlements.
create table public.bk_locker_test_orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 sku text not null check (sku in ('top-gold','top-electric','shoes-gold','wrist-gold')),
 stripe_account text not null default 'acct_1UVzIs7OIO7jIgo7' check (stripe_account='acct_1UVzIs7OIO7jIgo7'),
 livemode boolean not null default false check (livemode=false),
 price_id text not null,
 amount integer not null check(amount=100),
 currency text not null default 'usd' check(currency='usd'),
 session_id text unique,
 payment_intent text unique,
 status text not null default 'pending' check(status in ('pending','paid','expired','refunded','disputed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index bk_locker_test_orders_user_idx on public.bk_locker_test_orders(user_id);
create unique index bk_locker_test_orders_active_idx on public.bk_locker_test_orders(user_id,sku) where status in ('pending','paid');
create table public.bk_locker_test_outfits (
 user_id uuid primary key references auth.users(id) on delete cascade,
 outfit jsonb not null default '{}',
 updated_at timestamptz not null default now()
);
alter table public.bk_locker_test_orders enable row level security;
alter table public.bk_locker_test_outfits enable row level security;
revoke all on public.bk_locker_test_orders,public.bk_locker_test_outfits from public,anon,authenticated;
grant select,insert,update,delete on public.bk_locker_test_orders,public.bk_locker_test_outfits to service_role;

create function public.bk_begin_locker_test_order(p_user_id uuid,p_sku text,p_price text)
returns public.bk_locker_test_orders language plpgsql security invoker set search_path='' as $$
declare result public.bk_locker_test_orders;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||p_sku,0));
 select * into result from public.bk_locker_test_orders where user_id=p_user_id and sku=p_sku and status in ('pending','paid') limit 1;
 if found then return result; end if;
 insert into public.bk_locker_test_orders(user_id,sku,price_id,amount) values(p_user_id,p_sku,p_price,100) returning * into result;
 return result;
end $$;

create function public.bk_settle_locker_test_order(p_id uuid,p_session text,p_payment text,p_status text)
returns public.bk_locker_test_orders language plpgsql security invoker set search_path='' as $$
declare result public.bk_locker_test_orders;
begin
 if p_status not in ('pending','paid','expired','refunded','disputed') then raise exception 'invalid state'; end if;
 select * into strict result from public.bk_locker_test_orders where id=p_id for update;
 if p_session is null or (result.session_id is not null and result.session_id<>p_session) or
    (result.payment_intent is not null and result.payment_intent is distinct from p_payment) then raise exception 'binding mismatch'; end if;
 -- Revocations are terminal: delayed completion or duplicated events cannot regrant.
 update public.bk_locker_test_orders set session_id=p_session,
 payment_intent=coalesce(payment_intent,p_payment),
 status=case when status in ('refunded','disputed','expired') then status
             when p_status in ('refunded','disputed') then p_status
             when status='paid' then 'paid' else p_status end,
 updated_at=now() where id=p_id returning * into result;
 return result;
end $$;
revoke all on function public.bk_begin_locker_test_order(uuid,text,text) from public,anon,authenticated;
revoke all on function public.bk_settle_locker_test_order(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.bk_begin_locker_test_order(uuid,text,text) to service_role;
grant execute on function public.bk_settle_locker_test_order(uuid,text,text,text) to service_role;
