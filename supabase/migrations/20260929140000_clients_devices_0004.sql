begin;

create extension if not exists pg_trgm;

create or replace function private.has_org_role(
  target_organization_id uuid,
  target_user_id uuid,
  target_roles public.member_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.unit_memberships membership
    where membership.organization_id = target_organization_id
      and membership.user_id = target_user_id
      and membership.role = any(target_roles)
      and membership.is_active
  );
$$;

revoke all on function private.has_org_role(uuid, uuid, public.member_role[]) from public;
grant execute on function private.has_org_role(uuid, uuid, public.member_role[]) to authenticated;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  full_name text not null check (length(btrim(full_name)) >= 3),
  phone text not null check (length(btrim(phone)) >= 8),
  email text,
  tax_id text,
  notes text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  kind text not null check (kind in ('phone', 'email', 'whatsapp', 'other')),
  label text,
  value text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, client_id)
    references public.clients(organization_id, id)
    on delete cascade
);

create table public.client_addresses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  label text,
  street text not null,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  postal_code text,
  reference text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, client_id)
    references public.clients(organization_id, id)
    on delete cascade
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  client_id uuid not null,
  unit_id uuid,
  code text not null check (code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$'),
  kind text not null check (length(btrim(kind)) >= 2),
  brand text not null check (length(btrim(brand)) >= 2),
  model text not null check (length(btrim(model)) >= 2),
  serial text,
  configuration jsonb not null default '{}'::jsonb,
  notes text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, code),
  foreign key (organization_id, client_id)
    references public.clients(organization_id, id)
    on delete restrict,
  foreign key (organization_id, unit_id)
    references public.units(organization_id, id)
    on delete restrict
);

create table public.device_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  device_id uuid not null,
  storage_path text not null,
  mime_type text not null,
  file_size integer not null check (file_size > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, storage_path),
  foreign key (organization_id, device_id)
    references public.devices(organization_id, id)
    on delete cascade
);

create index clients_organization_name_idx on public.clients (organization_id, lower(full_name));
create index clients_phone_trgm_idx on public.clients using gin (phone gin_trgm_ops);
create index clients_name_trgm_idx on public.clients using gin (full_name gin_trgm_ops);
create index client_contacts_client_idx on public.client_contacts (organization_id, client_id);
create index client_addresses_client_idx on public.client_addresses (organization_id, client_id);
create index devices_organization_client_idx on public.devices (organization_id, client_id);
create index devices_code_trgm_idx on public.devices using gin (code gin_trgm_ops);
create index devices_serial_trgm_idx on public.devices using gin (serial gin_trgm_ops);
create index device_photos_device_idx on public.device_photos (organization_id, device_id);

create or replace function private.next_device_code(target_organization_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  candidate text;
  bytes bytea;
  position integer;
  attempt integer;
begin
  for attempt in 1..40 loop
    bytes := gen_random_bytes(4);
    candidate := '';
    for position in 0..3 loop
      candidate := candidate || substr(alphabet, (get_byte(bytes, position) % length(alphabet)) + 1, 1);
    end loop;

    if not exists (
      select 1 from public.devices
      where organization_id = target_organization_id and code = candidate
    ) then
      return candidate;
    end if;
  end loop;

  raise exception 'Could not generate a unique device code for organization %', target_organization_id
    using errcode = 'unique_violation';
end;
$$;

revoke all on function private.next_device_code(uuid) from public;
grant execute on function private.next_device_code(uuid) to authenticated;

create or replace function private.assign_device_code()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.code <> old.code then
    raise exception 'Device code is permanent and cannot be changed';
  end if;
  if tg_op = 'INSERT' then
    new.code := private.next_device_code(new.organization_id);
  end if;
  return new;
end;
$$;

revoke all on function private.assign_device_code() from public;

create trigger devices_assign_code
before insert or update of code on public.devices
for each row execute function private.assign_device_code();

create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create trigger client_addresses_set_updated_at
before update on public.client_addresses
for each row execute function public.set_updated_at();

create trigger devices_set_updated_at
before update on public.devices
for each row execute function public.set_updated_at();

alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;
alter table public.client_addresses enable row level security;
alter table public.devices enable row level security;
alter table public.device_photos enable row level security;

create policy "members can view clients"
on public.clients for select to authenticated
using (private.is_active_member(organization_id, (select auth.uid())));

create policy "service staff can create clients"
on public.clients for insert to authenticated
with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::public.member_role[]));

create policy "service staff can update clients"
on public.clients for update to authenticated
using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::public.member_role[]))
with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::public.member_role[]));

create policy "managers can archive clients"
on public.clients for delete to authenticated
using (private.has_org_role(organization_id, (select auth.uid()), array['gestor']::public.member_role[]));

create policy "members can view client contacts"
on public.client_contacts for select to authenticated
using (private.is_active_member(organization_id, (select auth.uid())));

create policy "service staff can manage client contacts"
on public.client_contacts for all to authenticated
using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::public.member_role[]))
with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::public.member_role[]));

create policy "members can view client addresses"
on public.client_addresses for select to authenticated
using (private.is_active_member(organization_id, (select auth.uid())));

create policy "service staff can manage client addresses"
on public.client_addresses for all to authenticated
using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::public.member_role[]))
with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::public.member_role[]));

create policy "members can view devices"
on public.devices for select to authenticated
using (private.is_active_member(organization_id, (select auth.uid())));

create policy "service team can create devices"
on public.devices for insert to authenticated
with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::public.member_role[]));

create policy "service team can update devices"
on public.devices for update to authenticated
using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::public.member_role[]))
with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::public.member_role[]));

create policy "managers can archive devices"
on public.devices for delete to authenticated
using (private.has_org_role(organization_id, (select auth.uid()), array['gestor']::public.member_role[]));

create policy "members can view device photos"
on public.device_photos for select to authenticated
using (private.is_active_member(organization_id, (select auth.uid())));

create policy "service team can manage device photos"
on public.device_photos for all to authenticated
using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::public.member_role[]))
with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::public.member_role[]));

commit;
