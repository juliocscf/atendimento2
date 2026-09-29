do $$
begin
  create type public.service_order_status as enum ('Recebido', 'Diagnóstico', 'Aguardando aprovação', 'Em execução', 'Em testes', 'Pronto para entrega', 'Concluído');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.service_order_mode as enum ('Balcão', 'Remoto', 'Domicílio');
exception when duplicate_object then null;
end;
$$;

create table if not exists private.service_order_counters (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_year integer not null,
  last_number integer not null default 0,
  primary key (organization_id, order_year)
);

create or replace function private.next_service_order_number(target_organization_id uuid)
returns text language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  current_year integer := extract(year from timezone('America/Sao_Paulo', now()))::integer;
  next_value integer;
begin
  insert into private.service_order_counters (organization_id, order_year, last_number)
  values (target_organization_id, current_year, 1)
  on conflict (organization_id, order_year)
  do update set last_number = private.service_order_counters.last_number + 1
  returning last_number into next_value;
  return format('OS-%s-%s', current_year, lpad(next_value::text, 5, '0'));
end;
$$;
revoke all on function private.next_service_order_number(uuid) from public;
grant execute on function private.next_service_order_number(uuid) to authenticated;

create table public.service_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  unit_id uuid not null,
  client_id uuid not null,
  device_id uuid,
  number text not null,
  mode public.service_order_mode not null default 'Balcão',
  status public.service_order_status not null default 'Recebido',
  priority text not null default 'Normal' check (priority in ('Normal', 'Alta', 'Urgente')),
  issue text not null check (length(btrim(issue)) >= 8),
  accessories text,
  due_date date,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  paid_cents integer not null default 0 check (paid_cents >= 0 and paid_cents <= amount_cents),
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, number),
  foreign key (organization_id, unit_id) references public.units(organization_id, id) on delete restrict,
  foreign key (organization_id, client_id) references public.clients(organization_id, id) on delete restrict,
  foreign key (organization_id, device_id) references public.devices(organization_id, id) on delete restrict
);

create table public.service_order_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  service_order_id uuid not null,
  event_type text not null check (event_type in ('created', 'status_changed', 'note', 'assignment')),
  from_status public.service_order_status,
  to_status public.service_order_status,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, service_order_id) references public.service_orders(organization_id, id) on delete cascade
);

create table public.service_order_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  service_order_id uuid not null,
  label text not null check (length(btrim(label)) >= 2),
  completed boolean not null default false,
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  position integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, service_order_id) references public.service_orders(organization_id, id) on delete cascade
);

create index service_orders_org_status_idx on public.service_orders (organization_id, status, updated_at desc);
create index service_orders_org_client_idx on public.service_orders (organization_id, client_id, created_at desc);
create index service_orders_org_device_idx on public.service_orders (organization_id, device_id, created_at desc);
create index service_orders_number_trgm_idx on public.service_orders using gin (number gin_trgm_ops);
create index service_order_events_order_idx on public.service_order_events (organization_id, service_order_id, created_at desc);
create index service_order_tasks_order_idx on public.service_order_tasks (organization_id, service_order_id, position);

create or replace function private.assign_service_order_number()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if tg_op = 'INSERT' then new.number := private.next_service_order_number(new.organization_id); end if;
  return new;
end;
$$;
revoke all on function private.assign_service_order_number() from public;
create trigger service_orders_assign_number before insert on public.service_orders for each row execute function private.assign_service_order_number();
create trigger service_orders_set_updated_at before update on public.service_orders for each row execute function public.set_updated_at();
create trigger service_order_tasks_set_updated_at before update on public.service_order_tasks for each row execute function public.set_updated_at();

create or replace function private.record_service_order_created()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.service_order_events (organization_id, service_order_id, event_type, to_status, description, actor_id)
  values (new.organization_id, new.id, 'created', new.status, 'Atendimento aberto', new.created_by);
  return new;
end;
$$;
revoke all on function private.record_service_order_created() from public;
create trigger service_orders_record_created after insert on public.service_orders for each row execute function private.record_service_order_created();

create or replace function public.advance_service_order(p_order_id uuid, p_status public.service_order_status, p_note text default null)
returns public.service_orders language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  current_order public.service_orders;
  expected_status public.service_order_status;
  actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'Authentication is required'; end if;
  select * into current_order from public.service_orders where id = p_order_id for update;
  if current_order.id is null then raise exception 'Service order not found'; end if;
  if not private.has_org_role(current_order.organization_id, actor, array['gestor', 'atendimento', 'tecnico']::public.member_role[]) then raise exception 'You do not have permission to advance this service order'; end if;
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
  update public.service_orders set status = p_status where id = p_order_id;
  insert into public.service_order_events (organization_id, service_order_id, event_type, from_status, to_status, description, actor_id, metadata)
  values (current_order.organization_id, current_order.id, 'status_changed', current_order.status, p_status, coalesce(nullif(btrim(p_note), ''), format('Etapa atualizada para %s', p_status)), actor, jsonb_build_object('from', current_order.status, 'to', p_status));
  select * into current_order from public.service_orders where id = p_order_id;
  return current_order;
end;
$$;
revoke all on function public.advance_service_order(uuid, public.service_order_status, text) from public;
revoke all on function public.advance_service_order(uuid, public.service_order_status, text) from anon;
grant execute on function public.advance_service_order(uuid, public.service_order_status, text) to authenticated;

alter table public.service_orders enable row level security;
alter table public.service_order_events enable row level security;
alter table public.service_order_tasks enable row level security;
create policy "members can view service orders" on public.service_orders for select to authenticated using (private.is_active_member(organization_id, (select auth.uid())));
create policy "service staff can create service orders" on public.service_orders for insert to authenticated with check (created_by = (select auth.uid()) and private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::public.member_role[]));
create policy "service team can update service orders" on public.service_orders for update to authenticated using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::public.member_role[])) with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::public.member_role[]));
create policy "members can view service order events" on public.service_order_events for select to authenticated using (private.is_active_member(organization_id, (select auth.uid())));
create policy "service team can add service order events" on public.service_order_events for insert to authenticated with check (actor_id = (select auth.uid()) and private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::public.member_role[]));
create policy "members can view service order tasks" on public.service_order_tasks for select to authenticated using (private.is_active_member(organization_id, (select auth.uid())));
create policy "service team can manage service order tasks" on public.service_order_tasks for all to authenticated using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::public.member_role[])) with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::public.member_role[]));
