alter type public.service_order_status add value if not exists 'Anulada';

create or replace function private.release_closed_order_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  part public.order_stock_items;
begin
  if new.status::text in ('Cancelada', 'Anulada', 'Concluído') and old.status is distinct from new.status then
    perform 1 from public.units where id = new.unit_id and organization_id = new.organization_id for update;
    for part in
      select *
      from public.order_stock_items
      where organization_id = new.organization_id
        and order_id = new.id
        and status in ('reserved', 'consumed')
      for update
    loop
      if part.status = 'reserved' then
        perform private.move_stock(part.organization_id, part.unit_id, part.product_id, 0, -part.quantity, 'release', 'OS encerrada: ' || new.number, new.id);
        update public.order_stock_items set status = 'released' where id = part.id;
      elsif new.status::text = 'Anulada' then
        perform private.move_stock(part.organization_id, part.unit_id, part.product_id, part.quantity, 0, 'restock', 'OS anulada: ' || new.number, part.id);
        update public.order_stock_items set status = 'returned' where id = part.id;
      end if;
    end loop;
  end if;
  return new;
end;
$$;

revoke all on function private.release_closed_order_stock() from public, anon, authenticated;

create or replace function private.prevent_annulled_order_stock_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare order_status text;
begin
  select status::text into order_status
  from public.service_orders
  where organization_id = new.organization_id and id = new.order_id;
  if order_status = 'Anulada' and new.status in ('reserved', 'consumed') then
    raise exception 'A OS anulada não aceita novas movimentações de estoque.';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_annulled_order_stock_changes() from public, anon, authenticated;
drop trigger if exists prevent_annulled_order_stock_changes on public.order_stock_items;
create trigger prevent_annulled_order_stock_changes
before insert or update of status on public.order_stock_items
for each row execute function private.prevent_annulled_order_stock_changes();

create or replace function private.sync_service_order_portal_expiry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'Concluído' and old.status is distinct from 'Concluído' then
    update public.service_order_portal_links
    set expires_at = now() + interval '30 days'
    where organization_id = new.organization_id
      and service_order_id = new.id
      and revoked_at is null;
  elsif new.status = 'Anulada' and old.status is distinct from 'Anulada' then
    update public.service_order_portal_links
    set expires_at = now() + interval '30 days'
    where organization_id = new.organization_id
      and service_order_id = new.id
      and revoked_at is null;
  elsif old.status = 'Concluído' and new.status is distinct from 'Concluído' then
    update public.service_order_portal_links
    set expires_at = null
    where organization_id = new.organization_id
      and service_order_id = new.id
      and revoked_at is null
      and expires_at > now();
  end if;
  return new;
end;
$$;

revoke all on function private.sync_service_order_portal_expiry() from public, anon, authenticated;

create or replace function public.annul_completed_service_order(p_order_id uuid, p_reason text)
returns public.service_orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_order public.service_orders;
  actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'Authentication is required'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Informe o motivo da anulação (mínimo de 5 caracteres).';
  end if;

  select * into current_order
  from public.service_orders
  where id = p_order_id
  for update;

  if current_order.id is null then raise exception 'Service order not found'; end if;
  if not private.has_org_role(current_order.organization_id, actor, array['gestor']::public.member_role[]) then
    raise exception 'Somente o gestor pode anular uma OS concluída.';
  end if;
  if current_order.status::text <> 'Concluído' then
    raise exception 'Somente uma OS concluída pode ser anulada.';
  end if;

  update public.quote_portal_links
  set revoked_at = now()
  where organization_id = current_order.organization_id
    and quote_id in (
      select id from public.quotes
      where organization_id = current_order.organization_id
        and service_order_id = current_order.id
    )
    and revoked_at is null;

  update public.quotes
  set status = 'expired'
  where organization_id = current_order.organization_id
    and service_order_id = current_order.id
    and status = 'sent';

  update public.service_orders
  set status = 'Anulada'::public.service_order_status
  where id = current_order.id;

  select * into current_order from public.service_orders where id = p_order_id;

  insert into public.service_order_events (
    organization_id, service_order_id, event_type, from_status, to_status, description, actor_id, metadata
  ) values (
    current_order.organization_id,
    current_order.id,
    'status_changed',
    'Concluído'::public.service_order_status,
    current_order.status,
    format('OS anulada após conclusão. Motivo: %s', btrim(p_reason)),
    actor,
    jsonb_build_object('reason', btrim(p_reason), 'annulled_status', 'Anulada', 'stock_reverted', true)
  );

  return current_order;
end;
$$;

revoke all on function public.annul_completed_service_order(uuid, text) from public, anon;
grant execute on function public.annul_completed_service_order(uuid, text) to authenticated;
