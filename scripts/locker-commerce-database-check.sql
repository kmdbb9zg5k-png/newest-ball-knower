-- Run via Supabase SQL against the migrated project. All fixtures roll back.
begin;
do $$
declare u uuid; a public.bk_locker_test_orders; b public.bk_locker_test_orders;
begin
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('bk_locker_test_orders','bk_locker_test_outfits') and not c.relrowsecurity) then raise exception 'RLS missing'; end if;
 if has_table_privilege('authenticated','public.bk_locker_test_orders','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('anon','public.bk_locker_test_orders','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.bk_locker_test_outfits','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('anon','public.bk_locker_test_outfits','SELECT,INSERT,UPDATE,DELETE') then raise exception 'Client table access'; end if;
 if has_function_privilege('authenticated','public.bk_begin_locker_test_order(uuid,text,text)','EXECUTE') or has_function_privilege('anon','public.bk_settle_locker_test_order(uuid,text,text,text)','EXECUTE') then raise exception 'Client function access'; end if;
 -- Use a user only as a FK; do not read or return personal fields. No permanent writes.
 select id into strict u from auth.users where id not in (select user_id from public.bk_locker_test_orders) limit 1;
 perform set_config('role','service_role',true);
 select * into a from public.bk_begin_locker_test_order(u,'top-gold','price_fixture');
 select * into b from public.bk_begin_locker_test_order(u,'top-gold','price_ignored');
 if a.id<>b.id or b.price_id<>'price_fixture' then raise exception 'Duplicate checkout'; end if;
 select * into b from public.bk_settle_locker_test_order(a.id,'cs_fixture','pi_fixture','paid');
 if b.status<>'paid' then raise exception 'Paid grant failed'; end if;
 select * into b from public.bk_settle_locker_test_order(a.id,'cs_fixture','pi_fixture','refunded');
 select * into b from public.bk_settle_locker_test_order(a.id,'cs_fixture','pi_fixture','paid');
 if b.status<>'refunded' then raise exception 'Stale webhook regranted'; end if;
 begin
  perform public.bk_settle_locker_test_order(a.id,'cs_other','pi_fixture','paid');
  raise exception 'Wrong binding accepted' using errcode='P0002';
 exception when sqlstate 'P0001' then null;
 end;
 select * into a from public.bk_begin_locker_test_order(u,'top-electric','price_fixture_2');
 select * into b from public.bk_settle_locker_test_order(a.id,'cs_fixture_2',null,'expired');
 select * into b from public.bk_begin_locker_test_order(u,'top-electric','price_fixture_2');
 if a.id=b.id then raise exception 'Expired session reused'; end if;
end $$;
rollback;
select 'PASS: RLS/grants, duplicate reservation, immutable binding, refund replay, expired replacement; fixtures rolled back' as result;
