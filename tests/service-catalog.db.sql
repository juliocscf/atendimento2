begin;
do $$
declare org uuid; actor uuid; order_id uuid; service_id uuid; quote_id uuid; next_version integer;
begin
 select m.organization_id, m.user_id, o.id into org, actor, order_id
 from public.unit_memberships m join public.service_orders o on o.organization_id = m.organization_id
 where m.is_active and m.role = 'gestor' limit 1;
 if org is null then raise exception 'Nenhuma organização com gestor e OS disponível para teste'; end if;
 insert into public.service_catalog(organization_id, code, name, description, default_price_cents)
 values (org, 'TEST_' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), 'Serviço de validação', 'Descrição original', 15000) returning id into service_id;
 begin
  insert into public.service_catalog(organization_id, code, name, default_price_cents)
  select organization_id, code, 'Duplicado', 15000 from public.service_catalog where id = service_id;
  raise exception 'Código duplicado foi aceito';
 exception when unique_violation then null; end;
 select coalesce(max(version), 0) + 1 into next_version from public.quotes where organization_id = org and service_order_id = order_id;
 insert into public.quotes(organization_id, service_order_id, version, subtotal_cents, total_cents, created_by)
 values (org, order_id, next_version, 12500, 12500, actor) returning id into quote_id;
 insert into public.quote_items(organization_id, quote_id, description, quantity, unit_price_cents, total_cents, item_type, service_catalog_id, service_code, service_name)
 select org, quote_id, 'Descrição ajustada no orçamento', 1, 12500, 12500, 'labor', id, code, name from public.service_catalog where id = service_id;
 update public.service_catalog set name = 'Nome alterado', description = 'Nova descrição', default_price_cents = 20000, is_active = false where id = service_id;
 if not exists(select 1 from public.quote_items where service_catalog_id = service_id and service_name = 'Serviço de validação' and description = 'Descrição ajustada no orçamento' and unit_price_cents = 12500) then raise exception 'Dados históricos não foram preservados'; end if;
 raise notice 'Cadastro, unicidade, inativação e histórico validados; transação revertida ao final.';
end $$;
rollback;
