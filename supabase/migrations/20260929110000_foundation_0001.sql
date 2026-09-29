begin;

create extension if not exists pgcrypto;

create type public.member_role as enum ('gestor', 'atendimento', 'tecnico', 'financeiro');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  currency char(3) not null default 'BRL',
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now()
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null,
  code text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (organization_id, id)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.unit_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, unit_id, user_id),
  foreign key (organization_id, unit_id)
    references public.units(organization_id, id)
    on delete cascade
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index units_organization_idx on public.units (organization_id, is_active);
create index memberships_user_idx on public.unit_memberships (user_id, is_active);
create index audit_log_organization_idx on public.audit_log (organization_id, created_at desc);

create schema if not exists private;

create or replace function private.is_active_member(target_organization_id uuid, target_user_id uuid)
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
      and membership.is_active
  );
$$;

create or replace function private.is_active_manager(target_organization_id uuid, target_user_id uuid)
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
      and membership.role = 'gestor'
      and membership.is_active
  );
$$;

revoke all on function private.is_active_member(uuid, uuid) from public;
revoke all on function private.is_active_manager(uuid, uuid) from public;
grant execute on function private.is_active_member(uuid, uuid) to authenticated;
grant execute on function private.is_active_manager(uuid, uuid) to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger units_set_updated_at
before update on public.units
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.units enable row level security;
alter table public.profiles enable row level security;
alter table public.unit_memberships enable row level security;
alter table public.audit_log enable row level security;

create policy "members can view their organizations"
on public.organizations for select to authenticated
using (
  private.is_active_member(organizations.id, (select auth.uid()))
);

create policy "managers can manage units"
on public.units for all to authenticated
using (
  private.is_active_manager(units.organization_id, (select auth.uid()))
)
with check (
  private.is_active_manager(units.organization_id, (select auth.uid()))
);

create policy "members can view their own profile"
on public.profiles for select to authenticated
using (id = (select auth.uid()));

create policy "members can create their own profile"
on public.profiles for insert to authenticated
with check (id = (select auth.uid()));

create policy "members can update their own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "members can view their memberships"
on public.unit_memberships for select to authenticated
using (
  user_id = (select auth.uid())
  or private.is_active_manager(unit_memberships.organization_id, (select auth.uid()))
);

create policy "managers can manage memberships"
on public.unit_memberships for all to authenticated
using (
  private.is_active_manager(unit_memberships.organization_id, (select auth.uid()))
)
with check (
  private.is_active_manager(unit_memberships.organization_id, (select auth.uid()))
);

create policy "managers can view audit log"
on public.audit_log for select to authenticated
using (
  private.is_active_manager(audit_log.organization_id, (select auth.uid()))
);

commit;
