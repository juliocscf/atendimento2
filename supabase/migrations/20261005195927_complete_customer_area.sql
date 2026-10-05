begin;

grant select, insert on table public.customer_contact_requests to authenticated;

create or replace function private.customer_area_claim()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); email_value text := lower(nullif(btrim((select email from auth.users where id = uid)),'')); phone_value text := nullif(btrim((select phone from auth.users where id = uid)), ''); client_row public.clients; org_name text; result jsonb;
begin
  if uid is null then raise exception 'Authentication is required.'; end if;
  select c.* into client_row from public.clients c where c.customer_user_id = uid or (c.customer_user_id is null and ((email_value is not null and lower(c.email)=email_value) or (phone_value is not null and regexp_replace(c.phone,'[^0-9]','','g') = regexp_replace(phone_value,'[^0-9]','','g')))) order by c.created_at limit 1;
  if client_row.id is null then return null; end if;
  if client_row.customer_user_id is null then update public.clients set customer_user_id=uid where id=client_row.id and customer_user_id is null; end if;
  select name into org_name from public.organizations where id=client_row.organization_id;
  select jsonb_build_object(
    'first_name', split_part(client_row.full_name,' ',1), 'client_id', client_row.id, 'organization_id', client_row.organization_id, 'organization_name', org_name,
    'devices', coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'code',d.code,'kind',d.kind,'brand',d.brand,'model',d.model) order by d.created_at desc) from public.devices d where d.organization_id=client_row.organization_id and d.client_id=client_row.id and d.status='active'),'[]'::jsonb),
    'orders', coalesce((select jsonb_agg(jsonb_build_object(
      'id',o.id,'client_id',o.client_id,'number',o.number,'status',o.status,'issue',o.issue,'created_at',o.created_at,'due_date',o.due_date,
      'device_label',coalesce(nullif(concat_ws(' ',d.kind,d.brand,d.model),''),'Atendimento sem equipamento'),
      'total_cents',o.amount_cents,'paid_cents',o.paid_cents,'balance_cents',greatest(o.amount_cents-o.paid_cents,0),
      'events',coalesce((select jsonb_agg(jsonb_build_object('status',e.to_status,'created_at',e.created_at) order by e.created_at) from public.service_order_events e where e.organization_id=o.organization_id and e.service_order_id=o.id and e.to_status is not null),'[]'::jsonb),
      'quotes',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'version',q.version,'status',q.status,'subtotal_cents',q.subtotal_cents,'discount_cents',q.discount_cents,'total_cents',q.total_cents,'approved_at',q.approved_at,'valid_until',q.valid_until,'notes',q.notes,'items',coalesce((select jsonb_agg(jsonb_build_object('description',qi.description,'quantity',qi.quantity,'unit_price_cents',qi.unit_price_cents,'total_cents',qi.total_cents) order by qi.position) from public.quote_items qi where qi.organization_id=q.organization_id and qi.quote_id=q.id),'[]'::jsonb)) order by q.version desc) from public.quotes q where q.organization_id=o.organization_id and q.service_order_id=o.id and q.status in ('sent','approved')),'[]'::jsonb),
      'payments',coalesce((select jsonb_agg(jsonb_build_object('amount_cents',p.amount_cents,'method',p.method,'received_at',p.received_at) order by p.received_at desc) from public.service_order_payments p where p.organization_id=o.organization_id and p.service_order_id=o.id),'[]'::jsonb),
      'pickups',coalesce((select jsonb_agg(jsonb_build_object('authorized_name',a.authorized_name,'cpf_last4',a.cpf_last4,'status',a.status,'requested_at',a.requested_at,'confirmed_at',a.confirmed_at,'cancelled_at',a.cancelled_at,'collected_at',a.collected_at) order by a.requested_at desc) from public.service_order_pickup_authorizations a where a.organization_id=o.organization_id and a.service_order_id=o.id),'[]'::jsonb)
    ) order by o.created_at desc) from public.service_orders o left join public.devices d on d.organization_id=o.organization_id and d.id=o.device_id where o.organization_id=client_row.organization_id and o.client_id=client_row.id),'[]'::jsonb),
    'contact_requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'channel',r.channel,'new_contact',r.new_contact,'status',r.status,'created_at',r.created_at) order by r.created_at desc) from public.customer_contact_requests r where r.customer_user_id=uid and r.client_id=client_row.id),'[]'::jsonb)
  ) into result;
  return result;
end; $$;

create or replace function private.customer_approve_quote(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); client_row public.clients; quote_row public.quotes;
begin
  if uid is null then raise exception 'Authentication is required.'; end if;
  select c.* into client_row from public.clients c join public.service_orders o on o.organization_id=c.organization_id and o.client_id=c.id where c.customer_user_id=uid and o.id=p_order_id limit 1;
  if client_row.id is null then raise exception 'Order not found.' using errcode='42501'; end if;
  select q.* into quote_row from public.quotes q where q.organization_id=client_row.organization_id and q.service_order_id=p_order_id and q.status='sent' and (q.valid_until is null or q.valid_until>=current_date) order by q.version desc limit 1 for update;
  if quote_row.id is null then raise exception 'No quote available.'; end if;
  update public.quotes set status='approved',approved_at=now(),approved_by=uid,approval_channel='portal' where id=quote_row.id returning * into quote_row;
  return jsonb_build_object('id',quote_row.id,'status',quote_row.status,'approved_at',quote_row.approved_at);
end; $$;
revoke all on function private.customer_approve_quote(uuid) from public, anon, authenticated;
grant execute on function private.customer_approve_quote(uuid) to authenticated;
create or replace function public.customer_approve_quote(p_order_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.customer_approve_quote(p_order_id); $$;
revoke all on function public.customer_approve_quote(uuid) from public, anon;
grant execute on function public.customer_approve_quote(uuid) to authenticated;

commit;
