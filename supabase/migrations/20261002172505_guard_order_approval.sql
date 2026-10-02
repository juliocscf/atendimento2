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

create or replace function private.get_quote_portal_details(p_token_hash text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select to_jsonb(portal) || jsonb_build_object(
    'notes', quote.notes,
    'subtotal_cents', quote.subtotal_cents,
    'discount_cents', quote.discount_cents
  )
  from private.get_quote_portal(p_token_hash) portal
  join public.quotes quote on quote.id = portal.quote_id
  limit 1;
$$;

revoke all on function private.get_quote_portal_details(text) from public, authenticated;
grant execute on function private.get_quote_portal_details(text) to anon;

create or replace function public.get_quote_portal_details(p_token_hash text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.get_quote_portal_details(p_token_hash);
$$;

revoke all on function public.get_quote_portal_details(text) from public, authenticated;
grant execute on function public.get_quote_portal_details(text) to anon;

create or replace function private.sync_approved_quote_amount()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    update public.service_orders
    set amount_cents = new.total_cents
    where organization_id = new.organization_id and id = new.service_order_id;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_approved_quote_amount() from public, anon, authenticated;
create trigger quotes_sync_approved_amount
after update of status on public.quotes
for each row execute function private.sync_approved_quote_amount();
