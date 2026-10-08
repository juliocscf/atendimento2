begin;
do $$
declare
 actor uuid:=gen_random_uuid(); org uuid:=gen_random_uuid(); branch uuid:=gen_random_uuid(); customer uuid:=gen_random_uuid();
 other_org uuid:=gen_random_uuid(); other_branch uuid:=gen_random_uuid(); other_product uuid:=gen_random_uuid();
 product uuid; sale uuid; order_id uuid:=gen_random_uuid(); part uuid; req uuid:=gen_random_uuid(); payload jsonb; result jsonb; n numeric;
begin
 insert into auth.users(id) values(actor);
 insert into public.organizations(id,name,slug) values(org,'Inventory transaction test',org::text),(other_org,'Other tenant',other_org::text);
 insert into public.units(id,organization_id,name,code) values(branch,org,'Test','TEST'),(other_branch,other_org,'Other','TEST');
 insert into public.unit_memberships(organization_id,unit_id,user_id,role) values(org,branch,actor,'gestor');
 insert into public.clients(id,organization_id,full_name,phone,created_by) values(customer,org,'Inventory test client','11999999999',actor);
 insert into public.products(id,organization_id,code,name) values(other_product,other_org,'OTHER','Other tenant product');
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 product:=(public.inventory_command(org,branch,gen_random_uuid(),'product','{"code":"TEST","name":"Test product","cost_cents":1000,"price_cents":2000,"minimum_stock":2}') ->>'id')::uuid;
 payload:=jsonb_build_object('product_id',product,'quantity',10,'reason','Opening inventory');
 perform public.inventory_command(org,branch,req,'adjust',payload);
 perform public.inventory_command(org,branch,req,'adjust',payload);
 select quantity into n from public.stock_balances where product_id=product;
 if n<>10 then raise exception 'FAIL: idempotent entry'; end if;
 begin
  perform public.inventory_command(org,branch,req,'adjust',payload||'{"quantity":20}');
  raise exception 'FAIL: changed retry accepted';
 exception when raise_exception then if SQLERRM like 'FAIL:%' then raise; end if; end;
 begin
  perform public.inventory_command(org,branch,gen_random_uuid(),'adjust',jsonb_build_object('product_id',other_product,'quantity',1,'reason','Cross tenant'));
  raise exception 'FAIL: cross-tenant product accepted';
 exception when raise_exception then if SQLERRM like 'FAIL:%' then raise; end if; end;
 begin
  perform public.inventory_command(other_org,other_branch,gen_random_uuid(),'adjust',jsonb_build_object('product_id',other_product,'quantity',1,'reason','Cross tenant'));
  raise exception 'FAIL: cross-tenant unit accepted';
 exception when raise_exception then if SQLERRM like 'FAIL:%' then raise; end if; end;
 insert into public.service_orders(id,organization_id,unit_id,client_id,number,issue,created_by) values(order_id,org,branch,customer,'test','Testing inventory integration',actor);
 part:=(public.inventory_command(org,branch,gen_random_uuid(),'reserve',jsonb_build_object('order_id',order_id,'product_id',product,'quantity',8))->>'id')::uuid;
 begin
  perform public.inventory_command(org,branch,gen_random_uuid(),'sale',jsonb_build_object('items',jsonb_build_array(jsonb_build_object('product_id',product,'quantity',3,'price_cents',2000))));
  raise exception 'FAIL: reserved stock was sold';
 exception when raise_exception then if SQLERRM like 'FAIL:%' then raise; end if; end;
 if exists(select 1 from public.product_sales where organization_id=org) then raise exception 'FAIL: failed sale not atomic'; end if;
 perform public.inventory_command(org,branch,gen_random_uuid(),'consume',jsonb_build_object('order_id',order_id,'part_id',part));
 select quantity into n from public.stock_balances where product_id=product;
 if n<>2 then raise exception 'FAIL: consume quantity'; end if;
 perform public.inventory_command(org,branch,gen_random_uuid(),'restock',jsonb_build_object('order_id',order_id,'part_id',part,'reason','Unused part physically returned'));
 perform public.inventory_command(org,branch,gen_random_uuid(),'reserve',jsonb_build_object('order_id',order_id,'product_id',product,'quantity',4));
 perform public.cancel_service_order(order_id,'Inventory test cancellation');
 if exists(select 1 from public.stock_balances where product_id=product and reserved<>0) then raise exception 'FAIL: cancellation did not release reservation'; end if;
 payload:=jsonb_build_object('client_id',customer,'items',jsonb_build_array(jsonb_build_object('product_id',product,'quantity',2,'price_cents',2000)),'discount_cents',100,'paid_cents',1000,'method','pix');
 req:=gen_random_uuid();result:=public.inventory_command(org,branch,req,'sale',payload);sale:=(result->>'id')::uuid;
 if public.inventory_command(org,branch,req,'sale',payload)<>result then raise exception 'FAIL: sale retry'; end if;
 if not exists(select 1 from public.product_sales where id=sale and total_cents=3900 and paid_cents=1000) then raise exception 'FAIL: sale totals'; end if;
 perform public.inventory_command(org,branch,gen_random_uuid(),'payment',jsonb_build_object('sale_id',sale,'amount_cents',2900,'method','dinheiro'));
 begin
  perform public.inventory_command(org,branch,gen_random_uuid(),'payment',jsonb_build_object('sale_id',sale,'amount_cents',1));
  raise exception 'FAIL: overpayment accepted';
 exception when raise_exception then if SQLERRM like 'FAIL:%' then raise; end if; end;
 perform public.inventory_command(org,branch,gen_random_uuid(),'return_sale',jsonb_build_object('sale_id',sale,'reason','All items returned','method','pix'));
 select sum(amount_cents) into n from public.product_sale_payments where sale_id=sale;
 if n<>0 then raise exception 'FAIL: refund ledger'; end if;
 select quantity into n from public.stock_balances where product_id=product;
 if n<>10 then raise exception 'FAIL: returned stock'; end if;
 payload:=jsonb_build_object('invoice_key',repeat('1',44),'supplier_tax_id','12345678000199','supplier_name','Test supplier','invoice_number','123','total_cents',10000,'items',jsonb_build_array(jsonb_build_object('product_id',product,'quantity',20,'cost_cents',500,'factor',10,'supplier_code','BOX','update_cost',true)));
 perform public.inventory_command(org,branch,gen_random_uuid(),'purchase',payload);
 begin
  perform public.inventory_command(org,branch,gen_random_uuid(),'purchase',payload);
  raise exception 'FAIL: duplicate invoice accepted';
 exception when unique_violation then null; end;
 select quantity into n from public.stock_balances where product_id=product;
 if n<>30 then raise exception 'FAIL: invoice quantity'; end if;
 if not exists(select 1 from public.products where id=product and cost_cents=500 and price_cents=2000) then raise exception 'FAIL: cost/price isolation'; end if;
 update public.unit_memberships set role='tecnico' where user_id=actor;
 begin
  perform public.inventory_command(org,branch,gen_random_uuid(),'sale',jsonb_build_object('items',jsonb_build_array(jsonb_build_object('product_id',product,'quantity',1,'price_cents',2000))));
  raise exception 'FAIL: technician sold products';
 exception when raise_exception then if SQLERRM like 'FAIL:%' then raise; end if; end;
 if has_table_privilege('authenticated','public.stock_balances','UPDATE') or has_table_privilege('authenticated','public.stock_movements','INSERT') then raise exception 'FAIL: direct stock writes'; end if;
 if has_function_privilege('anon','public.inventory_command(uuid,uuid,uuid,text,jsonb)','EXECUTE') then raise exception 'FAIL: anonymous execution'; end if;
 perform set_config('role','authenticated',true);
 if exists(select 1 from public.products where organization_id=other_org) then raise exception 'FAIL: RLS tenant isolation'; end if;
 if not exists(select 1 from public.products where id=product) then raise exception 'FAIL: RLS own tenant visibility'; end if;
 raise notice 'PASS: stock, reservations, cancellation, tenant isolation, permissions, invoice deduplication, sales, payments, refunds, atomicity and retries';
end $$;
rollback;
