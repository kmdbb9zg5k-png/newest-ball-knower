-- Run in a rollback transaction after the migration; test fixture is never retained.
insert into auth.users(id) values('f9804aee-38b4-4344-99f1-675f6b000001');
do $$
declare first_order public.bk_store_orders; again public.bk_store_orders; current_order public.bk_store_orders;
 items jsonb='[{"id":"gold-standard","name":"Gold Standard","amount":299},{"id":"tunnel-fit","name":"Tunnel Fit","amount":299}]';
begin
 if has_table_privilege('anon','public.bk_store_orders','INSERT') or has_function_privilege('authenticated','public.bk_store_settle(uuid,text,text,text)','EXECUTE') then raise exception 'client access'; end if;
 first_order:=public.bk_store_begin('f9804aee-38b4-4344-99f1-675f6b000001','test','stripe',items,598);
 again:=public.bk_store_begin('f9804aee-38b4-4344-99f1-675f6b000001','test','stripe',items,598);
 if again.id<>first_order.id then raise exception 'duplicate checkout'; end if;
 begin
  perform public.bk_store_begin('f9804aee-38b4-4344-99f1-675f6b000001','test','paypal',items,598);
  raise exception 'expected pending rejection';
 exception when others then if sqlerrm not like '%PENDING_CART%' then raise; end if; end;
 current_order:=public.bk_store_settle(first_order.id,'cs_fixture','pi_fixture','paid');
 if current_order.status<>'paid' then raise exception 'fulfillment failed'; end if;
 begin
  perform public.bk_store_begin('f9804aee-38b4-4344-99f1-675f6b000001','test','stripe',items,598);
  raise exception 'expected ownership rejection';
 exception when others then if sqlerrm not like '%ALREADY_OWNED%' then raise; end if; end;
 perform public.bk_store_settle(first_order.id,'cs_fixture','pi_fixture','refunded');
 current_order:=public.bk_store_settle(first_order.id,'cs_fixture','pi_fixture','paid');
 if current_order.status<>'refunded' then raise exception 'replay restored revoked purchase'; end if;
 begin
  perform public.bk_store_settle(first_order.id,'cs_other','pi_fixture','paid');
  raise exception 'expected binding rejection';
 exception when others then if sqlerrm not like '%binding mismatch%' then raise; end if; end;
end $$;
select 'PASS: client isolation, idempotency, pending cart lock, ownership, refund replay, provider binding' as result;
