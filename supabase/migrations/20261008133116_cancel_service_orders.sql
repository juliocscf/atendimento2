alter type public.service_order_status add value if not exists 'Cancelada';

create or replace function public.cancel_service_order(p_order_id uuid, p_reason text)
returns public.service_orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_order public.service_orders;
  previous_status public.service_order_status;
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Authentication is required';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Informe o motivo do cancelamento (mínimo de 5 caracteres).';
  end if;

  select * into current_order
  from public.service_orders
  where id = p_order_id
  for update;

  if current_order.id is null then
    raise exception 'Service order not found';
  end if;
  if not private.has_org_role(current_order.organization_id, actor, array['gestor', 'atendimento']::public.member_role[]) then
    raise exception 'Somente gestão ou atendimento pode cancelar esta OS.';
  end if;
  if current_order.status::text = 'Concluído' then
    raise exception 'Uma OS concluída não pode ser cancelada.';
  end if;
  if current_order.status::text = 'Cancelada' then
    raise exception 'Esta OS já está cancelada.';
  end if;
  previous_status := current_order.status;

  update public.quote_portal_links
  set revoked_at = now()
  where organization_id = current_order.organization_id
    and quote_id in (
      select id from public.quotes where organization_id = current_order.organization_id and service_order_id = current_order.id
    )
    and revoked_at is null;

  update public.quotes
  set status = 'expired'
  where organization_id = current_order.organization_id
    and service_order_id = current_order.id
    and status = 'sent';

  execute 'update public.service_orders set status = ''Cancelada''::public.service_order_status where id = $1'
    using p_order_id;

  select * into current_order from public.service_orders where id = p_order_id;

  insert into public.service_order_events (
    organization_id, service_order_id, event_type, from_status, to_status, description, actor_id, metadata
  ) values (
    current_order.organization_id,
    current_order.id,
    'status_changed',
    previous_status,
    current_order.status,
    format('OS cancelada. Motivo: %s', btrim(p_reason)),
    actor,
    jsonb_build_object('reason', btrim(p_reason), 'cancelled_status', 'Cancelada')
  );

  return current_order;
end;
$$;

revoke all on function public.cancel_service_order(uuid, text) from public, anon;
grant execute on function public.cancel_service_order(uuid, text) to authenticated;
