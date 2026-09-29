create or replace function public.get_quote_portal(p_token_hash text)
returns table (quote_id uuid, order_number text, client_name text, device_label text, issue text, quote_status public.quote_status, valid_until date, total_cents integer, items jsonb)
language sql security definer set search_path = public, pg_temp as $$
  select q.id, order_row.number, client.full_name,
    coalesce(device.code || ' · ' || device.brand || ' ' || device.model, 'Atendimento sem equipamento'),
    order_row.issue, q.status, q.valid_until, q.total_cents,
    coalesce((select jsonb_agg(jsonb_build_object('description', item.description, 'quantity', item.quantity, 'unitPriceCents', item.unit_price_cents, 'totalCents', item.total_cents) order by item.position) from public.quote_items item where item.quote_id = q.id), '[]'::jsonb)
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
revoke all on function public.get_quote_portal(text) from public;
grant execute on function public.get_quote_portal(text) to anon, authenticated;
