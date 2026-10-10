begin;

-- Keep token-based quote portal RPCs reachable to unauthenticated customers,
-- while moving the privileged implementation out of the exposed `public` API.
create schema if not exists private;
grant usage on schema private to anon, authenticated;

create or replace function private.get_quote_portal(p_token_hash text)
returns table (
  quote_id uuid,
  order_number text,
  client_name text,
  device_label text,
  issue text,
  quote_status public.quote_status,
  valid_until date,
  total_cents integer,
  items jsonb
)
language sql
security definer
set search_path = ''
as $$
  select q.id, order_row.number, client.full_name,
    coalesce(device.code || ' · ' || device.brand || ' ' || device.model, 'Atendimento sem equipamento'),
    order_row.issue, q.status, q.valid_until, q.total_cents,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'description', item.description,
            'quantity', item.quantity,
            'unitPriceCents', item.unit_price_cents,
            'totalCents', item.total_cents
          ) order by item.position
        )
        from public.quote_items item
        where item.quote_id = q.id
      ),
      '[]'::jsonb
    )
  from public.quote_portal_links link
  join public.quotes q on q.id = link.quote_id and q.organization_id = link.organization_id
  join public.service_orders order_row on order_row.id = q.service_order_id and order_row.organization_id = q.organization_id
  join public.clients client on client.id = order_row.client_id and client.organization_id = order_row.organization_id
  left join public.devices device on device.id = order_row.device_id and device.organization_id = order_row.organization_id
  where link.token_hash = nullif(btrim(p_token_hash), '')
    and link.revoked_at is null
    and link.expires_at > now()
    and q.status in ('sent', 'approved')
    and (q.valid_until is null or q.valid_until >= current_date)
  limit 1;
$$;

create or replace function private.approve_quote_portal(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  approved_quote public.quotes;
  link_row public.quote_portal_links;
begin
  select link.* into link_row
  from public.quote_portal_links link
  where link.token_hash = nullif(btrim(p_token_hash), '')
    and link.revoked_at is null
    and link.expires_at > now()
  for update;

  if link_row.id is null then
    raise exception 'This approval link is invalid or expired';
  end if;

  update public.quotes
  set status = 'approved', approved_at = now(), approval_channel = 'portal'
  where id = link_row.quote_id
    and organization_id = link_row.organization_id
    and status = 'sent'
  returning * into approved_quote;

  if approved_quote.id is null then
    raise exception 'This quote is no longer awaiting approval';
  end if;

  update public.quote_portal_links
  set last_accessed_at = now()
  where id = link_row.id;

  return jsonb_build_object(
    'quoteId', approved_quote.id,
    'status', approved_quote.status,
    'approvedAt', approved_quote.approved_at
  );
end;
$$;

revoke all on function private.get_quote_portal(text) from public, anon, authenticated;
revoke all on function private.approve_quote_portal(text) from public, anon, authenticated;
grant execute on function private.get_quote_portal(text) to anon;
grant execute on function private.approve_quote_portal(text) to anon;

-- Public invoker wrappers preserve the existing RPC URLs without exposing a
-- SECURITY DEFINER endpoint in the Data API schema.
create or replace function public.get_quote_portal(p_token_hash text)
returns table (
  quote_id uuid,
  order_number text,
  client_name text,
  device_label text,
  issue text,
  quote_status public.quote_status,
  valid_until date,
  total_cents integer,
  items jsonb
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.get_quote_portal(p_token_hash);
$$;

create or replace function public.approve_quote_portal(p_token_hash text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.approve_quote_portal(p_token_hash);
$$;

revoke all on function public.get_quote_portal(text) from public, authenticated;
revoke all on function public.approve_quote_portal(text) from public, authenticated;
grant execute on function public.get_quote_portal(text) to anon;
grant execute on function public.approve_quote_portal(text) to anon;

-- Keep onboarding's established RLS-bypass behavior, but isolate it in the
-- non-exposed schema. The function validates the authenticated user and only
-- allows that user to create their first organization.
create or replace function private.create_initial_organization(
  p_name text,
  p_unit_name text,
  p_slug text default null
)
returns table (organization_id uuid, unit_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  created_organization_id uuid;
  created_unit_id uuid;
  normalized_slug text;
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;
  if length(btrim(coalesce(p_name, ''))) < 3 then
    raise exception 'Organization name is required';
  end if;
  if length(btrim(coalesce(p_unit_name, ''))) < 2 then
    raise exception 'Unit name is required';
  end if;
  if exists (
    select 1 from public.unit_memberships membership
    where membership.user_id = current_user_id and membership.is_active
  ) then
    raise exception 'User already belongs to an organization';
  end if;

  normalized_slug := lower(regexp_replace(btrim(coalesce(nullif(p_slug, ''), p_name)), '[^a-zA-Z0-9]+', '-', 'g'));
  normalized_slug := trim(both '-' from normalized_slug);
  if normalized_slug = '' then
    raise exception 'A valid organization slug is required';
  end if;
  if exists (select 1 from public.organizations where slug = normalized_slug) then
    raise exception 'Organization slug is already in use';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (btrim(p_name), normalized_slug, current_user_id)
  returning id into created_organization_id;

  insert into public.units (organization_id, name, code)
  values (created_organization_id, btrim(p_unit_name), 'MATRIZ')
  returning id into created_unit_id;

  insert into public.unit_memberships (organization_id, unit_id, user_id, role)
  values (created_organization_id, created_unit_id, current_user_id, 'gestor');

  insert into public.audit_log (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (created_organization_id, current_user_id, 'created', 'organization', created_organization_id, jsonb_build_object('unit_id', created_unit_id));

  return query select created_organization_id, created_unit_id;
end;
$$;

revoke all on function private.create_initial_organization(text, text, text) from public, anon, authenticated;
grant execute on function private.create_initial_organization(text, text, text) to authenticated;

-- Preserve the existing RPC URL without leaving a SECURITY DEFINER function
-- in the exposed API schema.
create or replace function public.create_initial_organization(
  p_name text,
  p_unit_name text,
  p_slug text default null
)
returns table (organization_id uuid, unit_id uuid)
language sql
security invoker
set search_path = ''
as $$
  select * from private.create_initial_organization(p_name, p_unit_name, p_slug);
$$;

revoke all on function public.create_initial_organization(text, text, text) from public, anon, authenticated;
grant execute on function public.create_initial_organization(text, text, text) to authenticated;

commit;

