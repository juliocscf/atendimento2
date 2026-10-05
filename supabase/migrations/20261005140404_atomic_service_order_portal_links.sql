begin;

create or replace function public.replace_service_order_portal_link(
  p_order_id uuid,
  p_token_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  order_row public.service_orders;
  link_row public.service_order_portal_links;
begin
  if actor is null then
    raise exception 'Authentication is required.';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Token hash inválido.';
  end if;

  select orders.* into order_row
  from public.service_orders orders
  where orders.id = p_order_id
  for update;

  if order_row.id is null then
    raise exception 'Service order not found.';
  end if;
  if not private.has_org_role(
    order_row.organization_id,
    actor,
    array['gestor', 'atendimento']::public.member_role[]
  ) then
    raise exception 'Você não tem permissão para gerar este link.';
  end if;

  update public.service_order_portal_links
  set revoked_at = now()
  where organization_id = order_row.organization_id
    and service_order_id = order_row.id
    and revoked_at is null;

  insert into public.service_order_portal_links (
    organization_id,
    service_order_id,
    token_hash,
    expires_at,
    created_by
  ) values (
    order_row.organization_id,
    order_row.id,
    p_token_hash,
    case when order_row.status = 'Concluído' then now() + interval '30 days' else null end,
    actor
  ) returning * into link_row;

  insert into public.service_order_events (
    organization_id,
    service_order_id,
    event_type,
    description,
    actor_id,
    metadata
  ) values (
    order_row.organization_id,
    order_row.id,
    'note',
    'Link de acompanhamento do cliente gerado.',
    actor,
    jsonb_build_object('portal_link_id', link_row.id)
  );

  return jsonb_build_object(
    'id', link_row.id,
    'created_at', link_row.created_at,
    'expires_at', link_row.expires_at
  );
end;
$$;

create or replace function public.revoke_service_order_portal_link(p_order_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  order_row public.service_orders;
  affected integer;
begin
  if actor is null then
    raise exception 'Authentication is required.';
  end if;

  select orders.* into order_row
  from public.service_orders orders
  where orders.id = p_order_id
  for update;

  if order_row.id is null then
    raise exception 'Service order not found.';
  end if;
  if not private.has_org_role(
    order_row.organization_id,
    actor,
    array['gestor', 'atendimento']::public.member_role[]
  ) then
    raise exception 'Você não tem permissão para cancelar este link.';
  end if;

  update public.service_order_portal_links
  set revoked_at = now()
  where organization_id = order_row.organization_id
    and service_order_id = order_row.id
    and revoked_at is null;
  get diagnostics affected = row_count;

  if affected > 0 then
    insert into public.service_order_events (
      organization_id,
      service_order_id,
      event_type,
      description,
      actor_id
    ) values (
      order_row.organization_id,
      order_row.id,
      'note',
      'Acesso de acompanhamento do cliente cancelado.',
      actor
    );
  end if;

  return affected > 0;
end;
$$;

revoke all on function public.replace_service_order_portal_link(uuid, text) from public, anon;
revoke all on function public.revoke_service_order_portal_link(uuid) from public, anon;
grant execute on function public.replace_service_order_portal_link(uuid, text) to authenticated;
grant execute on function public.revoke_service_order_portal_link(uuid) to authenticated;

commit;
