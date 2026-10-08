create or replace function private.reserve_quote_parts(
  p_quote_id uuid,
  p_order_id uuid,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  quote_row public.quotes;
  order_row public.service_orders;
  product_row public.products;
  quote_item record;
  actor uuid := p_actor;
  existing_qty numeric;
  needed_qty numeric;
  reserved_qty numeric := 0;
  linked_items integer := 0;
  unlinked_items integer := 0;
begin
  if actor is null then
    raise exception 'Não foi possível identificar o responsável pela reserva.';
  end if;

  select * into quote_row
  from public.quotes
  where id = p_quote_id
  for update;

  if quote_row.id is null or quote_row.status <> 'approved' then
    raise exception 'Somente orçamentos aprovados podem reservar peças.';
  end if;

  select * into order_row
  from public.service_orders
  where organization_id = quote_row.organization_id
    and id = p_order_id
  for update;

  if order_row.id is null or order_row.id <> quote_row.service_order_id then
    raise exception 'Ordem de serviço do orçamento não encontrada.';
  end if;

  if order_row.status in ('Cancelada', 'Concluído') then
    raise exception 'A OS já está encerrada e não pode reservar peças.';
  end if;

  perform 1
  from public.units
  where organization_id = order_row.organization_id
    and id = order_row.unit_id
    and is_active
  for update;

  if not found then
    raise exception 'Unidade da OS não está ativa.';
  end if;

  select count(*)::integer into unlinked_items
  from public.quote_items
  where organization_id = quote_row.organization_id
    and quote_id = quote_row.id
    and item_type = 'part'
    and product_id is null;

  for quote_item in
    select product_id, sum(quantity)::numeric as quantity
    from public.quote_items
    where organization_id = quote_row.organization_id
      and quote_id = quote_row.id
      and item_type = 'part'
      and product_id is not null
    group by product_id
  loop
    linked_items := linked_items + 1;

    select * into product_row
    from public.products
    where organization_id = quote_row.organization_id
      and id = quote_item.product_id
      and active;

    if product_row.id is null then
      raise exception 'A peça vinculada ao orçamento não está ativa no cadastro.';
    end if;

    select coalesce(sum(quantity), 0)
    into existing_qty
    from public.order_stock_items
    where organization_id = quote_row.organization_id
      and unit_id = order_row.unit_id
      and order_id = order_row.id
      and product_id = quote_item.product_id
      and status in ('reserved', 'consumed');

    needed_qty := greatest(quote_item.quantity - existing_qty, 0);
    if needed_qty > 0 then
      insert into public.stock_balances (organization_id, unit_id, product_id)
      values (quote_row.organization_id, order_row.unit_id, quote_item.product_id)
      on conflict do nothing;

      update public.stock_balances
      set reserved = reserved + needed_qty
      where organization_id = quote_row.organization_id
        and unit_id = order_row.unit_id
        and product_id = quote_item.product_id
        and quantity >= reserved + needed_qty;

      if not found then
        raise exception 'Estoque insuficiente para a peça %.', product_row.name
          using errcode = 'P0001';
      end if;

      insert into public.order_stock_items (
        organization_id, unit_id, order_id, product_id, quantity, status, cost_cents
      ) values (
        quote_row.organization_id, order_row.unit_id, order_row.id,
        quote_item.product_id, needed_qty, 'reserved', product_row.cost_cents
      );

      insert into public.stock_movements (
        organization_id, unit_id, product_id, quantity_delta, reserved_delta,
        kind, reason, source_id, actor_id
      ) values (
        quote_row.organization_id, order_row.unit_id, quote_item.product_id,
        0, needed_qty, 'reserve',
        format('Reserva automática do orçamento v%s · %s', quote_row.version, order_row.number),
        quote_row.id, actor
      );

      reserved_qty := reserved_qty + needed_qty;
    end if;
  end loop;

  insert into public.service_order_events (
    organization_id, service_order_id, event_type, description, actor_id, metadata
  ) values (
    order_row.organization_id, order_row.id, 'note',
    case
      when linked_items = 0 and unlinked_items > 0 then
        'Autorização registrada, mas há peças sem vínculo com o cadastro de produtos.'
      when reserved_qty > 0 then
        format('Peças do orçamento v%s reservadas automaticamente no estoque.', quote_row.version)
      else
        format('Reserva do orçamento v%s conferida; não havia quantidade adicional a reservar.', quote_row.version)
    end,
    actor,
    jsonb_build_object(
      'quote_id', quote_row.id,
      'quote_version', quote_row.version,
      'linked_items', linked_items,
      'unlinked_items', unlinked_items,
      'reserved_quantity', reserved_qty,
      'automatic', true
    )
  );

  return jsonb_build_object(
    'quoteId', quote_row.id,
    'orderId', order_row.id,
    'reservedQuantity', reserved_qty,
    'linkedItems', linked_items,
    'unlinkedItems', unlinked_items
  );
end;
$$;

revoke all on function private.reserve_quote_parts(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function private.reserve_approved_quote_parts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status is distinct from new.status then
    perform private.reserve_quote_parts(
      new.id,
      new.service_order_id,
      coalesce((select auth.uid()), new.created_by)
    );
  end if;
  return new;
end;
$$;

revoke all on function private.reserve_approved_quote_parts() from public, anon, authenticated;

drop trigger if exists quotes_auto_reserve_parts on public.quotes;
create trigger quotes_auto_reserve_parts
after update of status on public.quotes
for each row execute function private.reserve_approved_quote_parts();

create or replace function public.advance_service_order(
  p_order_id uuid,
  p_status public.service_order_status,
  p_note text default null
)
returns public.service_orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_order public.service_orders;
  expected_status public.service_order_status;
  latest_quote public.quotes;
  actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'Authentication is required'; end if;
  select * into current_order from public.service_orders where id = p_order_id for update;
  if current_order.id is null then raise exception 'Service order not found'; end if;
  if not private.has_org_role(current_order.organization_id, actor, array['gestor', 'atendimento', 'tecnico']::public.member_role[]) then
    raise exception 'You do not have permission to advance this service order';
  end if;

  expected_status := case current_order.status
    when 'Recebido' then 'Diagnóstico'::public.service_order_status
    when 'Diagnóstico' then 'Aguardando aprovação'::public.service_order_status
    when 'Aguardando aprovação' then 'Em execução'::public.service_order_status
    when 'Em execução' then 'Em testes'::public.service_order_status
    when 'Em testes' then case when current_order.mode = 'Balcão' then 'Pronto para entrega'::public.service_order_status else 'Concluído'::public.service_order_status end
    when 'Pronto para entrega' then 'Concluído'::public.service_order_status
    else null
  end;
  if expected_status is null or p_status <> expected_status then raise exception 'Invalid status transition'; end if;

  if p_status in ('Aguardando aprovação', 'Em execução') then
    select * into latest_quote from public.quotes
    where organization_id = current_order.organization_id and service_order_id = current_order.id
    order by version desc limit 1;
    if p_status = 'Aguardando aprovação' and
       (latest_quote.id is null or latest_quote.status not in ('sent', 'approved') or
        not exists (select 1 from public.quote_items where organization_id = current_order.organization_id and quote_id = latest_quote.id)) then
      raise exception 'Envie um orçamento com itens antes de solicitar a aprovação.' using errcode = 'P0001';
    end if;
    if p_status = 'Em execução' and (latest_quote.id is null or latest_quote.status <> 'approved') then
      raise exception 'Aguarde a aprovação do orçamento pelo cliente antes de iniciar a execução.' using errcode = 'P0001';
    end if;
    if p_status = 'Em execução' then
      perform private.reserve_quote_parts(latest_quote.id, current_order.id, actor);
    end if;
  end if;

  update public.service_orders set status = p_status where id = p_order_id;
  insert into public.service_order_events (organization_id, service_order_id, event_type, from_status, to_status, description, actor_id, metadata)
  values (current_order.organization_id, current_order.id, 'status_changed', current_order.status, p_status,
    coalesce(nullif(btrim(p_note), ''), format('Etapa atualizada para %s', p_status)), actor,
    jsonb_build_object('from', current_order.status, 'to', p_status));
  select * into current_order from public.service_orders where id = p_order_id;
  return current_order;
end;
$$;
