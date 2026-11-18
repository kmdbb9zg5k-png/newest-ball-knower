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

insert into auth.users(id) values('f9804aee-38b4-4344-99f1-675f6b000002');
do $$
declare test_order public.bk_store_orders; live_order public.bk_store_orders;
  buyer uuid := 'f9804aee-38b4-4344-99f1-675f6b000002';
  items jsonb := '[{"id":"frostbite","name":"Frostbite","amount":100,"kind":"character"},{"id":"gold-standard","name":"Gold Standard","amount":299}]';
begin
 if has_function_privilege('anon','public.bk_store_character_purchases()','EXECUTE')
  or not has_function_privilege('authenticated','public.bk_store_character_purchases()','EXECUTE')
  or has_table_privilege('authenticated','public.bk_store_orders','SELECT') then raise exception 'ownership read privileges'; end if;
 perform set_config('request.jwt.claims', json_build_object('sub',buyer,'is_anonymous',false)::text,true);
 test_order:=public.bk_store_begin(buyer,'test','stripe',items,399);
 perform public.bk_store_settle(test_order.id,'cs_test_character','pi_test_character','paid');
 live_order:=public.bk_store_begin(buyer,'live','stripe',items,399);
 if exists(select from public.bk_store_character_purchases()) then raise exception 'pending or sandbox granted access'; end if;
 perform public.bk_store_settle(live_order.id,'cs_live_character','pi_live_character','paid');
 if (select array_agg(sku) from public.bk_store_character_purchases()) is distinct from array['frostbite'] then raise exception 'live bundle fulfillment failed'; end if;
 perform set_config('request.jwt.claims', json_build_object('sub',buyer,'is_anonymous',true)::text,true);
 if exists(select from public.bk_store_character_purchases()) then raise exception 'anonymous grant'; end if;
 perform set_config('request.jwt.claims', '{"sub":"f9804aee-38b4-4344-99f1-675f6b000001","is_anonymous":false}',true);
 if exists(select from public.bk_store_character_purchases()) then raise exception 'cross-account grant'; end if;
 perform set_config('request.jwt.claims', json_build_object('sub',buyer,'is_anonymous',false)::text,true);
 perform public.bk_store_settle(live_order.id,'cs_live_character','pi_live_character','refunded');
 perform public.bk_store_settle(live_order.id,'cs_live_character','pi_live_character','paid');
 if exists(select from public.bk_store_character_purchases()) then raise exception 'refund or replay left access'; end if;
end $$;
select 'PASS: live character-only ownership, pending and sandbox isolation, account isolation, refund and replay';
