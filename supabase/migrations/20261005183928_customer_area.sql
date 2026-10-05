begin;

alter table public.clients add column if not exists customer_user_id uuid references auth.users(id) on delete set null;
create unique index if not exists clients_customer_user_idx on public.clients(customer_user_id) where customer_user_id is not null;

create table if not exists public.customer_contact_requests (
  id uuid primary key default gen_random_uuid(), customer_user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null, channel text not null check (channel in ('phone','email')), new_contact text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')), created_at timestamptz not null default now(),
  foreign key (organization_id, client_id) references public.clients(organization_id,id) on delete cascade
);
alter table public.customer_contact_requests enable row level security;
create policy "customers view own contact requests" on public.customer_contact_requests for select to authenticated using (customer_user_id = (select auth.uid()));
create policy "customers create own contact requests" on public.customer_contact_requests for insert to authenticated with check (customer_user_id = (select auth.uid()) and exists (select 1 from public.clients c where c.id = client_id and c.organization_id = organization_id and c.customer_user_id = (select auth.uid())));

create or replace function private.customer_area_claim()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); email_value text := lower(nullif(btrim((select email from auth.users where id = uid)),'')); phone_value text := nullif(btrim((select phone from auth.users where id = uid)), ''); client_row public.clients; org_name text; result jsonb;
begin
  if uid is null then raise exception 'Authentication is required.'; end if;
  select c.* into client_row from public.clients c where c.customer_user_id = uid or (c.customer_user_id is null and ((email_value is not null and lower(c.email)=email_value) or (phone_value is not null and regexp_replace(c.phone,'[^0-9]','','g') = regexp_replace(phone_value,'[^0-9]','','g')))) order by c.created_at limit 1;
  if client_row.id is null then return null; end if;
  if client_row.customer_user_id is null then update public.clients set customer_user_id=uid where id=client_row.id and customer_user_id is null; end if;
  select name into org_name from public.organizations where id=client_row.organization_id;
  select jsonb_build_object('first_name', split_part(client_row.full_name,' ',1), 'client_id', client_row.id, 'organization_id', client_row.organization_id, 'organization_name', org_name,
    'devices', coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'code',d.code,'kind',d.kind,'brand',d.brand,'model',d.model) order by d.created_at desc) from public.devices d where d.organization_id=client_row.organization_id and d.client_id=client_row.id and d.status='active'),'[]'::jsonb),
    'orders', coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'client_id',o.client_id,'number',o.number,'status',o.status,'issue',o.issue,'created_at',o.created_at,'due_date',o.due_date,'device_label',coalesce(concat_ws(' ',d.kind,d.brand,d.model),'Atendimento sem equipamento'),'total_cents',o.amount_cents,'paid_cents',o.paid_cents,'balance_cents',greatest(o.amount_cents-o.paid_cents,0),'events',coalesce((select jsonb_agg(jsonb_build_object('status',e.to_status,'created_at',e.created_at) order by e.created_at) from public.service_order_events e where e.organization_id=o.organization_id and e.service_order_id=o.id and e.to_status is not null),'[]'::jsonb),'quotes','[]'::jsonb,'payments','[]'::jsonb,'pickups','[]'::jsonb) order by o.created_at desc) from public.service_orders o left join public.devices d on d.organization_id=o.organization_id and d.id=o.device_id where o.organization_id=client_row.organization_id and o.client_id=client_row.id),'[]'::jsonb),
    'contact_requests', coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'channel',r.channel,'new_contact',r.new_contact,'status',r.status,'created_at',r.created_at) order by r.created_at desc) from public.customer_contact_requests r where r.customer_user_id=uid and r.client_id=client_row.id),'[]'::jsonb)) into result;
  return result;
end; $$;
revoke all on function private.customer_area_claim() from public, anon, authenticated;
grant execute on function private.customer_area_claim() to authenticated;
create or replace function public.customer_area_claim() returns jsonb language sql security invoker set search_path='' as $$ select private.customer_area_claim(); $$;
revoke all on function public.customer_area_claim() from public, anon;
grant execute on function public.customer_area_claim() to authenticated;
commit;
