-- Stock is modified only through the checked private transaction engine.
-- No direct writes are granted: balances, ledger and receipts must commit together.
create table public.products (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 code text not null check (code ~ '^[A-Z0-9][A-Z0-9_-]{0,39}$'), name text not null check (length(btrim(name)) between 2 and 160),
 barcode text not null default '' check (length(barcode) <= 50), category text not null default '' check (length(category)<=100),
 brand text not null default '' check (length(brand)<=100), supplier text not null default '' check (length(supplier)<=160),
 unit text not null default 'UN' check (length(unit) between 1 and 10),
 cost_cents integer not null default 0 check (cost_cents>=0), price_cents integer not null default 0 check (price_cents>=0),
 minimum_stock numeric(14,3) not null default 0 check (minimum_stock>=0), active boolean not null default true,
 created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,code)
);
create table public.stock_balances (
 organization_id uuid not null, unit_id uuid not null, product_id uuid not null,
 quantity numeric(14,3) not null default 0, reserved numeric(14,3) not null default 0,
 primary key(organization_id,unit_id,product_id), check(quantity>=0 and reserved>=0 and reserved<=quantity),
 foreign key(organization_id,unit_id) references public.units(organization_id,id),
 foreign key(organization_id,product_id) references public.products(organization_id,id)
);
create table public.stock_operations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, unit_id uuid not null,
 request_id uuid not null, action text not null, payload jsonb not null, result jsonb,
 actor_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 unique(organization_id,request_id), foreign key(organization_id,unit_id) references public.units(organization_id,id)
);
create table public.stock_movements (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, unit_id uuid not null, product_id uuid not null,
 quantity_delta numeric(14,3) not null, reserved_delta numeric(14,3) not null default 0,
 kind text not null, reason text not null, source_id uuid, actor_id uuid references auth.users(id),
 created_at timestamptz not null default now(),
 foreign key(organization_id,unit_id) references public.units(organization_id,id),
 foreign key(organization_id,product_id) references public.products(organization_id,id)
);
create table public.product_sales (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, unit_id uuid not null, client_id uuid,
 status text not null default 'confirmed' check(status in ('confirmed','returned')),
 subtotal_cents integer not null default 0 check(subtotal_cents>=0), discount_cents integer not null default 0 check(discount_cents>=0),
 total_cents integer not null default 0 check(total_cents>=0 and total_cents=subtotal_cents-discount_cents),
 paid_cents integer not null default 0 check(paid_cents between 0 and total_cents),
 note text not null default '', created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 unique(organization_id,id), foreign key(organization_id,unit_id) references public.units(organization_id,id),
 foreign key(organization_id,client_id) references public.clients(organization_id,id)
);
create table public.product_sale_items (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, sale_id uuid not null, product_id uuid not null,
 name text not null, quantity numeric(14,3) not null check(quantity>0), price_cents integer not null check(price_cents>=0),
 cost_cents integer not null check(cost_cents>=0), total_cents integer not null check(total_cents>=0),
 foreign key(organization_id,sale_id) references public.product_sales(organization_id,id),
 foreign key(organization_id,product_id) references public.products(organization_id,id)
);
create table public.product_sale_payments (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, sale_id uuid not null,
 amount_cents integer not null check(amount_cents<>0), method text not null check(method in ('pix','cartao','dinheiro','transferencia','outro')),
 actor_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 foreign key(organization_id,sale_id) references public.product_sales(organization_id,id)
);
create table public.stock_purchases (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, unit_id uuid not null,
 invoice_key text not null check(invoice_key ~ '^[0-9]{44}$'), supplier_tax_id text not null, supplier_name text not null,
 invoice_number text not null, total_cents bigint not null check(total_cents>=0), details jsonb not null,
 actor_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 unique(organization_id,invoice_key), foreign key(organization_id,unit_id) references public.units(organization_id,id)
);
create table public.supplier_product_links (
 organization_id uuid not null, supplier_tax_id text not null, supplier_code text not null, product_id uuid not null,
 factor numeric(14,6) not null check(factor>0), primary key(organization_id,supplier_tax_id,supplier_code),
 foreign key(organization_id,product_id) references public.products(organization_id,id)
);
create table public.order_stock_items (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, unit_id uuid not null,
 order_id uuid not null, product_id uuid not null, quantity numeric(14,3) not null check(quantity>0),
 status text not null default 'reserved' check(status in ('reserved','consumed','released','returned')),
 cost_cents integer not null check(cost_cents>=0), created_at timestamptz not null default now(),
 foreign key(organization_id,unit_id) references public.units(organization_id,id),
 foreign key(organization_id,order_id) references public.service_orders(organization_id,id),
 foreign key(organization_id,product_id) references public.products(organization_id,id)
);
create index stock_balances_product_idx on public.stock_balances(organization_id,product_id);
create index stock_movements_history_idx on public.stock_movements(organization_id,unit_id,created_at desc);
create index stock_movements_product_idx on public.stock_movements(organization_id,product_id);
create index product_sales_unit_idx on public.product_sales(organization_id,unit_id,created_at desc);
create index product_sales_client_idx on public.product_sales(organization_id,client_id);
create index sale_items_sale_idx on public.product_sale_items(organization_id,sale_id);
create index sale_items_product_idx on public.product_sale_items(organization_id,product_id);
create index sale_payments_sale_idx on public.product_sale_payments(organization_id,sale_id);
create index stock_purchases_unit_idx on public.stock_purchases(organization_id,unit_id);
create index supplier_links_product_idx on public.supplier_product_links(organization_id,product_id);
create index order_stock_order_idx on public.order_stock_items(organization_id,order_id);
create index order_stock_unit_idx on public.order_stock_items(organization_id,unit_id);
create index order_stock_product_idx on public.order_stock_items(organization_id,product_id);
create index stock_operations_unit_idx on public.stock_operations(organization_id,unit_id);
do $$ declare t text; begin
 foreach t in array array['products','stock_balances','stock_operations','stock_movements','product_sales','product_sale_items','product_sale_payments','stock_purchases','supplier_product_links','order_stock_items'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy members_read on public.%I for select to authenticated using (private.is_active_member(organization_id,(select auth.uid())))',t);
 end loop;
end $$;

-- Internal helper; never exposed or callable by a client. Parent engine holds the unit lock.
create function private.move_stock(org uuid, branch uuid, product uuid, delta numeric, reservation numeric, movement text, explanation text, source uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
 insert into public.stock_balances(organization_id,unit_id,product_id) values(org,branch,product) on conflict do nothing;
 update public.stock_balances set quantity=quantity+delta,reserved=reserved+reservation
 where organization_id=org and unit_id=branch and product_id=product
 and quantity+delta>=0 and reserved+reservation>=0 and quantity+delta>=reserved+reservation;
 if not found then raise exception 'Estoque disponível insuficiente. Confira as reservas e quantidades.'; end if;
 insert into public.stock_movements(organization_id,unit_id,product_id,quantity_delta,reserved_delta,kind,reason,source_id,actor_id)
 values(org,branch,product,delta,reservation,movement,explanation,source,auth.uid());
end $$;
revoke all on function private.move_stock(uuid,uuid,uuid,numeric,numeric,text,text,uuid) from public,anon,authenticated;

create function private.inventory_command(org uuid, branch uuid, request uuid, command text, data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid := auth.uid(); member public.member_role; operation public.stock_operations; p public.products;
 sale public.product_sales; part public.order_stock_items; service_order public.service_orders;
 item jsonb; command_result jsonb; source uuid:=gen_random_uuid(); qty numeric; price integer; subtotal bigint:=0;
 discount integer; paid integer; reason text:=btrim(coalesce(data->>'reason','')); method text:=coalesce(data->>'method','pix');
begin
 if actor is null then raise exception 'Faça login para continuar.'; end if;
 select role into member from public.unit_memberships where organization_id=org and unit_id=branch and user_id=actor and is_active;
 if member is null then raise exception 'Sem acesso a esta unidade.'; end if;
 if command in ('reserve','consume','release','restock') then
  if member not in ('gestor','atendimento','tecnico') then raise exception 'Sem permissão para movimentar peças da OS.'; end if;
  select * into service_order from public.service_orders where organization_id=org and unit_id=branch and id=(data->>'order_id')::uuid for update;
  if service_order.id is null then raise exception 'OS não encontrada nesta unidade.'; end if;
 elsif command='payment' then
  if member not in ('gestor','atendimento','financeiro') then raise exception 'Sem permissão financeira.'; end if;
 elsif member not in ('gestor','atendimento') then raise exception 'Somente gestão ou atendimento pode fazer esta operação.';
 end if;
 -- Serialize operations per unit to prevent overselling and duplicate confirmations.
 perform 1 from public.units where id=branch and organization_id=org and is_active for update;
 if not found then raise exception 'Unidade inativa.'; end if;
 if request is null then raise exception 'Identificador da operação obrigatório.'; end if;
 select * into operation from public.stock_operations where organization_id=org and request_id=request;
 if operation.id is not null then
  if operation.unit_id<>branch or operation.action<>command or operation.payload<>data then raise exception 'Identificador reutilizado com dados diferentes.'; end if;
  return operation.result;
 end if;
 insert into public.stock_operations(organization_id,unit_id,request_id,action,payload,actor_id) values(org,branch,request,command,data,actor) returning * into operation;

 if command='product' then
  source:=coalesce(nullif(data->>'id','')::uuid,source);
  if data->>'id' is not null and not exists(select 1 from public.products where id=source and organization_id=org) then raise exception 'Produto não encontrado.'; end if;
  insert into public.products(id,organization_id,code,name,barcode,category,brand,supplier,unit,cost_cents,price_cents,minimum_stock,active)
  values(source,org,upper(btrim(data->>'code')),btrim(data->>'name'),coalesce(data->>'barcode',''),coalesce(data->>'category',''),coalesce(data->>'brand',''),coalesce(data->>'supplier',''),upper(coalesce(data->>'unit','UN')),(data->>'cost_cents')::integer,(data->>'price_cents')::integer,(data->>'minimum_stock')::numeric,coalesce((data->>'active')::boolean,true))
  on conflict(id) do update set code=excluded.code,name=excluded.name,barcode=excluded.barcode,category=excluded.category,brand=excluded.brand,supplier=excluded.supplier,unit=excluded.unit,cost_cents=excluded.cost_cents,price_cents=excluded.price_cents,minimum_stock=excluded.minimum_stock,active=excluded.active;

 elsif command='adjust' then
  qty:=(data->>'quantity')::numeric;
  if qty is null or qty=0 or qty<>round(qty,3) or abs(qty)>1000000 or length(reason)<5 then raise exception 'Informe quantidade válida e motivo com pelo menos 5 caracteres.'; end if;
  select * into p from public.products where organization_id=org and id=(data->>'product_id')::uuid;
  if p.id is null then raise exception 'Produto não encontrado.'; end if;
  perform private.move_stock(org,branch,p.id,qty,0,'adjust',reason,source);

 elsif command='purchase' then
  if jsonb_typeof(data->'items') is distinct from 'array' or jsonb_array_length(data->'items') not between 1 and 500 then raise exception 'Nota sem itens válidos.'; end if;
  insert into public.stock_purchases(id,organization_id,unit_id,invoice_key,supplier_tax_id,supplier_name,invoice_number,total_cents,details,actor_id)
  values(source,org,branch,data->>'invoice_key',data->>'supplier_tax_id',data->>'supplier_name',data->>'invoice_number',(data->>'total_cents')::bigint,data,actor);
  for item in select value from jsonb_array_elements(data->'items') loop
   select * into p from public.products where organization_id=org and id=(item->>'product_id')::uuid and active;
   if p.id is null then raise exception 'Vincule cada item a um produto ativo.'; end if;
   qty:=(item->>'quantity')::numeric; price:=(item->>'cost_cents')::integer;
   if qty is null or qty<=0 or qty>1000000 or qty<>round(qty,3) or price is null or price<0 then raise exception 'Quantidade ou custo inválido.'; end if;
   perform private.move_stock(org,branch,p.id,qty,0,'purchase','NF-e '||(data->>'invoice_number'),source);
   if coalesce((item->>'update_cost')::boolean,false) then update public.products set cost_cents=price where id=p.id; end if;
   insert into public.supplier_product_links(organization_id,supplier_tax_id,supplier_code,product_id,factor)
   values(org,data->>'supplier_tax_id',item->>'supplier_code',p.id,(item->>'factor')::numeric)
   on conflict(organization_id,supplier_tax_id,supplier_code) do update set product_id=excluded.product_id,factor=excluded.factor;
  end loop;

 elsif command='sale' then
  if jsonb_typeof(data->'items') is distinct from 'array' or jsonb_array_length(data->'items') not between 1 and 100 then raise exception 'Inclua entre 1 e 100 itens.'; end if;
  discount:=coalesce((data->>'discount_cents')::integer,0); paid:=coalesce((data->>'paid_cents')::integer,0);
  insert into public.product_sales(id,organization_id,unit_id,client_id,note,created_by)
  values(source,org,branch,nullif(data->>'client_id','')::uuid,left(coalesce(data->>'note',''),2000),actor);
  for item in select value from jsonb_array_elements(data->'items') loop
   select * into p from public.products where organization_id=org and id=(item->>'product_id')::uuid and active;
   if p.id is null then raise exception 'Produto indisponível.'; end if;
   qty:=(item->>'quantity')::numeric; price:=(item->>'price_cents')::integer;
   if qty is null or qty<=0 or qty>1000000 or qty<>round(qty,3) or price is null or price<0 then raise exception 'Quantidade ou preço inválido.'; end if;
   subtotal:=subtotal+round(qty*price);
   insert into public.product_sale_items(organization_id,sale_id,product_id,name,quantity,price_cents,cost_cents,total_cents)
   values(org,source,p.id,p.name,qty,price,p.cost_cents,round(qty*price));
   perform private.move_stock(org,branch,p.id,-qty,0,'sale','Venda '||left(source::text,8),source);
  end loop;
  if discount<0 or discount>subtotal or paid<0 or paid>subtotal-discount then raise exception 'Confira desconto e valor recebido.'; end if;
  update public.product_sales set subtotal_cents=subtotal,discount_cents=discount,total_cents=subtotal-discount,paid_cents=paid where id=source;
  if paid>0 then insert into public.product_sale_payments(organization_id,sale_id,amount_cents,method,actor_id) values(org,source,paid,method,actor); end if;

 elsif command in ('payment','return_sale') then
  select * into sale from public.product_sales where organization_id=org and unit_id=branch and id=(data->>'sale_id')::uuid for update;
  if sale.id is null or sale.status<>'confirmed' then raise exception 'Venda não encontrada ou já devolvida.'; end if;
  source:=sale.id;
  if command='payment' then
   paid:=(data->>'amount_cents')::integer;
   if paid is null or paid<=0 or paid>sale.total_cents-sale.paid_cents then raise exception 'Recebimento maior que o saldo ou inválido.'; end if;
   insert into public.product_sale_payments(organization_id,sale_id,amount_cents,method,actor_id) values(org,source,paid,method,actor);
   update public.product_sales set paid_cents=paid_cents+paid where id=source;
  else
   if length(reason)<5 then raise exception 'Informe o motivo da devolução.'; end if;
   for item in select to_jsonb(i) from public.product_sale_items i where sale_id=source loop
    perform private.move_stock(org,branch,(item->>'product_id')::uuid,(item->>'quantity')::numeric,0,'return',reason,source);
   end loop;
   if sale.paid_cents>0 then insert into public.product_sale_payments(organization_id,sale_id,amount_cents,method,actor_id) values(org,source,-sale.paid_cents,method,actor); end if;
   update public.product_sales set status='returned',paid_cents=0,note=note||E'\nDevolução: '||reason where id=source;
  end if;

 elsif command='reserve' then
  if service_order.status::text in ('Concluído','Cancelada') then raise exception 'Esta OS está encerrada.'; end if;
  select * into p from public.products where organization_id=org and id=(data->>'product_id')::uuid and active;
  qty:=(data->>'quantity')::numeric;
  if p.id is null or qty is null or qty<=0 or qty>1000000 or qty<>round(qty,3) then raise exception 'Produto ou quantidade inválida.'; end if;
  insert into public.order_stock_items(id,organization_id,unit_id,order_id,product_id,quantity,cost_cents) values(source,org,branch,service_order.id,p.id,qty,p.cost_cents);
  perform private.move_stock(org,branch,p.id,0,qty,'reserve','Reserva para '||service_order.number,service_order.id);

 elsif command in ('consume','release','restock') then
  select * into part from public.order_stock_items where organization_id=org and unit_id=branch and order_id=service_order.id and id=(data->>'part_id')::uuid for update;
  if part.id is null then raise exception 'Peça não encontrada.'; end if;
  if command in ('consume','release') and part.status<>'reserved' then raise exception 'Esta reserva já foi processada.'; end if;
  if command='consume' and service_order.status::text in ('Concluído','Cancelada') then raise exception 'Esta OS está encerrada.'; end if;
  if command='restock' and (part.status<>'consumed' or length(reason)<5) then raise exception 'Confirme a peça devolvida e informe o motivo.'; end if;
  perform private.move_stock(org,branch,part.product_id,case when command='consume' then -part.quantity when command='restock' then part.quantity else 0 end,
   case when command='restock' then 0 else -part.quantity end,command,service_order.number||': '||coalesce(nullif(reason,''),command),service_order.id);
  update public.order_stock_items set status=case command when 'consume' then 'consumed' when 'release' then 'released' else 'returned' end where id=part.id;
  source:=part.id;
 else raise exception 'Operação desconhecida.';
 end if;
 if command in ('reserve','consume','release','restock') then
  insert into public.service_order_events(organization_id,service_order_id,event_type,description,actor_id)
  values(org,service_order.id,'note',case command when 'reserve' then 'Peça reservada no estoque.' when 'consume' then 'Peça utilizada; baixa de estoque registrada.' when 'release' then 'Reserva de peça liberada.' else 'Peça devolvida ao estoque: '||reason end,actor);
 end if;
 command_result:=jsonb_build_object('id',source);
 update public.stock_operations set result=command_result where id=operation.id;
 return command_result;
end $$;
revoke all on function private.inventory_command(uuid,uuid,uuid,text,jsonb) from public,anon;
grant execute on function private.inventory_command(uuid,uuid,uuid,text,jsonb) to authenticated;
create function public.inventory_command(p_organization_id uuid,p_unit_id uuid,p_request_id uuid,p_action text,p_data jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select private.inventory_command(p_organization_id,p_unit_id,p_request_id,p_action,p_data);
$$;
revoke all on function public.inventory_command(uuid,uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.inventory_command(uuid,uuid,uuid,text,jsonb) to authenticated;

-- Closing an order releases unused reservations; used parts require an explicit return.
create function private.release_closed_order_stock() returns trigger language plpgsql security definer set search_path='' as $$
declare part public.order_stock_items;
begin
 if new.status::text in ('Cancelada','Concluído') and old.status is distinct from new.status then
  perform 1 from public.units where id=new.unit_id for update;
  for part in select * from public.order_stock_items where organization_id=new.organization_id and order_id=new.id and status='reserved' for update loop
   perform private.move_stock(part.organization_id,part.unit_id,part.product_id,0,-part.quantity,'release','OS encerrada: '||new.number,new.id);
   update public.order_stock_items set status='released' where id=part.id;
  end loop;
 end if;
 return new;
end $$;
revoke all on function private.release_closed_order_stock() from public,anon,authenticated;
create trigger release_closed_order_stock after update of status on public.service_orders for each row execute function private.release_closed_order_stock();
