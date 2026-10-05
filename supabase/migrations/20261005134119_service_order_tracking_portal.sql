begin;

create table public.service_order_portal_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  service_order_id uuid not null,
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (token_hash),
  foreign key (organization_id, service_order_id)
    references public.service_orders(organization_id, id)
    on delete cascade
);

create index service_order_portal_links_order_idx
on public.service_order_portal_links (organization_id, service_order_id, created_at desc);

create unique index service_order_portal_links_one_active_idx
on public.service_order_portal_links (organization_id, service_order_id)
where revoked_at is null;

alter table public.service_order_portal_links enable row level security;

revoke all on table public.service_order_portal_links from public, anon, authenticated;
grant select, insert, update on table public.service_order_portal_links to authenticated;

create policy "members can view service order portal links"
on public.service_order_portal_links for select to authenticated
using (private.is_active_member(organization_id, (select auth.uid())));

create policy "service staff can create service order portal links"
on public.service_order_portal_links for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_org_role(
    organization_id,
    (select auth.uid()),
    array['gestor', 'atendimento']::public.member_role[]
  )
);

create policy "service staff can update service order portal links"
on public.service_order_portal_links for update to authenticated
using (
  private.has_org_role(
    organization_id,
    (select auth.uid()),
    array['gestor', 'atendimento']::public.member_role[]
  )
)
with check (
  private.has_org_role(
    organization_id,
    (select auth.uid()),
    array['gestor', 'atendimento']::public.member_role[]
  )
);

create or replace function private.get_service_order_portal_details(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_row public.service_order_portal_links;
  payload jsonb;
begin
  select link.* into link_row
  from public.service_order_portal_links link
  where link.token_hash = nullif(btrim(p_token_hash), '')
    and link.revoked_at is null
    and (link.expires_at is null or link.expires_at > now())
  limit 1;

  if link_row.id is null then
    return null;
  end if;

  update public.service_order_portal_links
  set last_accessed_at = now()
  where id = link_row.id;

  select jsonb_build_object(
    'order_number', order_row.number,
    'organization_name', organization_row.name,
    'unit_name', unit_row.name,
    'client_first_name', split_part(btrim(client_row.full_name), ' ', 1),
    'device_label', coalesce(
      nullif(concat_ws(' ', device_row.kind, device_row.brand, device_row.model), ''),
      'Atendimento sem equipamento vinculado'
    ),
    'issue', order_row.issue,
    'status', order_row.status,
    'created_at', order_row.created_at,
    'due_date', order_row.due_date,
    'updated_at', order_row.updated_at,
    'total_cents', order_row.amount_cents,
    'paid_cents', order_row.paid_cents,
    'balance_cents', greatest(order_row.amount_cents - order_row.paid_cents, 0),
    'events', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'status', event_row.to_status,
            'created_at', event_row.created_at
          )
          order by event_row.created_at, event_row.id
        )
        from public.service_order_events event_row
        where event_row.organization_id = order_row.organization_id
          and event_row.service_order_id = order_row.id
          and event_row.event_type in ('created', 'status_changed')
          and event_row.to_status is not null
      ),
      '[]'::jsonb
    ),
    'quote', (
      select jsonb_build_object(
        'status', quote_row.status,
        'version', quote_row.version,
        'valid_until', quote_row.valid_until,
        'notes', quote_row.notes,
        'subtotal_cents', quote_row.subtotal_cents,
        'discount_cents', quote_row.discount_cents,
        'total_cents', quote_row.total_cents,
        'approved_at', quote_row.approved_at,
        'items', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'description', item_row.description,
                'quantity', item_row.quantity,
                'unit_price_cents', item_row.unit_price_cents,
                'total_cents', item_row.total_cents
              )
              order by item_row.position, item_row.id
            )
            from public.quote_items item_row
            where item_row.organization_id = quote_row.organization_id
              and item_row.quote_id = quote_row.id
          ),
          '[]'::jsonb
        )
      )
      from public.quotes quote_row
      where quote_row.organization_id = order_row.organization_id
        and quote_row.service_order_id = order_row.id
        and (
          quote_row.status = 'approved'
          or (
            quote_row.status = 'sent'
            and (quote_row.valid_until is null or quote_row.valid_until >= current_date)
          )
        )
      order by quote_row.version desc
      limit 1
    )
  ) into payload
  from public.service_orders order_row
  join public.organizations organization_row
    on organization_row.id = order_row.organization_id
  join public.units unit_row
    on unit_row.organization_id = order_row.organization_id
   and unit_row.id = order_row.unit_id
  join public.clients client_row
    on client_row.organization_id = order_row.organization_id
   and client_row.id = order_row.client_id
  left join public.devices device_row
    on device_row.organization_id = order_row.organization_id
   and device_row.id = order_row.device_id
  where order_row.organization_id = link_row.organization_id
    and order_row.id = link_row.service_order_id;

  return payload;
end;
$$;

create or replace function private.approve_quote_from_service_order_portal(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_row public.service_order_portal_links;
  quote_row public.quotes;
begin
  select link.* into link_row
  from public.service_order_portal_links link
  where link.token_hash = nullif(btrim(p_token_hash), '')
    and link.revoked_at is null
    and (link.expires_at is null or link.expires_at > now())
  limit 1
  for update;

  if link_row.id is null then
    raise exception 'Este link de acompanhamento é inválido ou expirou.';
  end if;

  select quote.* into quote_row
  from public.quotes quote
  where quote.organization_id = link_row.organization_id
    and quote.service_order_id = link_row.service_order_id
    and quote.status = 'sent'
    and (quote.valid_until is null or quote.valid_until >= current_date)
  order by quote.version desc
  limit 1
  for update;

  if quote_row.id is null then
    raise exception 'Não há orçamento aguardando aprovação nesta ordem.';
  end if;

  update public.quotes
  set status = 'approved',
      approved_at = now(),
      approval_channel = 'portal'
  where id = quote_row.id
    and organization_id = quote_row.organization_id
  returning * into quote_row;

  update public.service_order_portal_links
  set last_accessed_at = now()
  where id = link_row.id;

  return jsonb_build_object(
    'status', quote_row.status,
    'approved_at', quote_row.approved_at,
    'total_cents', quote_row.total_cents
  );
end;
$$;

revoke all on function private.get_service_order_portal_details(text) from public, anon, authenticated;
revoke all on function private.approve_quote_from_service_order_portal(text) from public, anon, authenticated;
grant usage on schema private to anon;
grant execute on function private.get_service_order_portal_details(text) to anon;
grant execute on function private.approve_quote_from_service_order_portal(text) to anon;

create or replace function public.get_service_order_portal_details(p_token_hash text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.get_service_order_portal_details(p_token_hash);
$$;

create or replace function public.approve_quote_from_service_order_portal(p_token_hash text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.approve_quote_from_service_order_portal(p_token_hash);
$$;

revoke all on function public.get_service_order_portal_details(text) from public, authenticated;
revoke all on function public.approve_quote_from_service_order_portal(text) from public, authenticated;
grant execute on function public.get_service_order_portal_details(text) to anon;
grant execute on function public.approve_quote_from_service_order_portal(text) to anon;

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

create trigger service_orders_sync_portal_expiry
after update of status on public.service_orders
for each row execute function private.sync_service_order_portal_expiry();

commit;
