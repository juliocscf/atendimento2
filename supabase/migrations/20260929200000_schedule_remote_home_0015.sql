create extension if not exists btree_gist;

do $$ begin
  create type public.appointment_status as enum ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');
exception when duplicate_object then null;
end; $$;

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete restrict,
  service_order_id uuid not null,
  client_id uuid not null,
  assigned_to uuid not null references auth.users(id) on delete restrict,
  mode public.service_order_mode not null,
  status public.appointment_status not null default 'scheduled',
  title text not null check (char_length(btrim(title)) between 2 and 160),
  start_at timestamptz not null,
  end_at timestamptz not null,
  address text,
  remote_tool text,
  travel_fee_cents integer not null default 0 check (travel_fee_cents >= 0),
  notes text,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  check (end_at > start_at),
  foreign key (organization_id, service_order_id) references public.service_orders(organization_id, id) on delete cascade,
  foreign key (organization_id, client_id) references public.clients(organization_id, id) on delete restrict,
  exclude using gist (organization_id with =, assigned_to with =, tstzrange(start_at, end_at, '[)') with &&) where (status in ('scheduled', 'confirmed'))
);

create index if not exists appointments_org_start_idx on public.appointments (organization_id, start_at);
create index if not exists appointments_org_assignee_idx on public.appointments (organization_id, assigned_to, start_at);

create table if not exists public.remote_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid not null unique,
  tool_name text not null check (char_length(btrim(tool_name)) between 2 and 80),
  authorization_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  summary text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, appointment_id) references public.appointments(organization_id, id) on delete cascade,
  check (ended_at is null or started_at is not null),
  check (ended_at is null or ended_at >= started_at)
);

create trigger appointments_set_updated_at before update on public.appointments for each row execute function public.set_updated_at();
create trigger remote_sessions_set_updated_at before update on public.remote_sessions for each row execute function public.set_updated_at();

alter table public.appointments enable row level security;
alter table public.remote_sessions enable row level security;
create policy "members can view appointments" on public.appointments for select to authenticated using (private.is_active_member(organization_id, (select auth.uid())));
create policy "service staff can create appointments" on public.appointments for insert to authenticated with check (created_by = (select auth.uid()) and updated_by = (select auth.uid()) and private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::public.member_role[]));
create policy "service staff can update appointments" on public.appointments for update to authenticated using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::public.member_role[])) with check (updated_by = (select auth.uid()) and private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::public.member_role[]));
create policy "members can view remote sessions" on public.remote_sessions for select to authenticated using (private.is_active_member(organization_id, (select auth.uid())));
create policy "service team can manage remote sessions" on public.remote_sessions for all to authenticated using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::public.member_role[])) with check (created_by = (select auth.uid()) and private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::public.member_role[]));
