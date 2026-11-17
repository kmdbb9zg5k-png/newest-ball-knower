-- A paid live order is the source of ownership. Pending, test and reversed
-- orders cannot grant gameplay access, even if the checkout return is replayed.
create function public.bk_store_character_purchases()
returns table (sku text)
language sql stable security definer set search_path = ''
as $$
  select distinct item.value->>'id'
  from public.bk_store_orders as orders
  cross join lateral pg_catalog.jsonb_array_elements(orders.items) as item(value)
  where orders.user_id = (select auth.uid())
    and (select auth.jwt()->>'is_anonymous') is distinct from 'true'
    and orders.mode = 'live'
    and orders.status = 'paid'
    and item.value->>'kind' = 'character';
$$;
revoke all on function public.bk_store_character_purchases() from public, anon, authenticated;
grant execute on function public.bk_store_character_purchases() to authenticated;
