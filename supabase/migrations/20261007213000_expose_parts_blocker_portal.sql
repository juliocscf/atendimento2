create or replace function private.get_service_order_portal_details_base(p_token_hash text)
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
    'parts_block', case
      when coalesce(order_row.parts_blocked, false) then jsonb_build_object(
        'active', true,
        'description', order_row.parts_description,
        'expected_date', order_row.parts_expected_date,
        'note', order_row.parts_note,
        'blocked_at', order_row.parts_blocked_at
      )
      when order_row.parts_received_at is not null then jsonb_build_object(
        'active', false,
        'received_at', order_row.parts_received_at
      )
      else null
    end,
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
    'parts_events', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'action', event_row.metadata ->> 'action',
            'description', event_row.description,
            'created_at', event_row.created_at
          )
          order by event_row.created_at, event_row.id
        )
        from public.service_order_events event_row
        where event_row.organization_id = order_row.organization_id
          and event_row.service_order_id = order_row.id
          and event_row.event_type = 'parts_block'
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

revoke all on function private.get_service_order_portal_details_base(text) from public, anon, authenticated;
