begin;

alter table public.organizations
  add column created_by uuid references auth.users(id) on delete set null;

create index organizations_created_by_idx on public.organizations (created_by);

drop policy "members can view their organizations" on public.organizations;
create policy "members and creators can view organizations"
on public.organizations for select to authenticated
using (
  created_by = (select auth.uid())
  or private.is_active_member(id, (select auth.uid()))
);

create policy "authenticated users can create organizations"
on public.organizations for insert to authenticated
with check (
  created_by = (select auth.uid())
  and not exists (
    select 1 from public.unit_memberships membership
    where membership.user_id = (select auth.uid())
      and membership.is_active
  )
);

drop policy "managers can manage units" on public.units;
create policy "members can view units"
on public.units for select to authenticated
using (private.is_active_member(organization_id, (select auth.uid())));

create policy "managers and creators can insert units"
on public.units for insert to authenticated
with check (
  private.is_active_manager(organization_id, (select auth.uid()))
  or exists (
    select 1 from public.organizations organization
    where organization.id = units.organization_id
      and organization.created_by = (select auth.uid())
      and not exists (
        select 1 from public.unit_memberships membership
        where membership.organization_id = units.organization_id
          and membership.is_active
      )
  )
);

create policy "managers can update units"
on public.units for update to authenticated
using (private.is_active_manager(organization_id, (select auth.uid())))
with check (private.is_active_manager(organization_id, (select auth.uid())));

create policy "managers can delete units"
on public.units for delete to authenticated
using (private.is_active_manager(organization_id, (select auth.uid())));

drop policy "managers can insert memberships" on public.unit_memberships;
create policy "managers and creators can insert memberships"
on public.unit_memberships for insert to authenticated
with check (
  private.is_active_manager(organization_id, (select auth.uid()))
  or (
    user_id = (select auth.uid())
    and role = 'gestor'
    and exists (
      select 1 from public.organizations organization
      where organization.id = unit_memberships.organization_id
        and organization.created_by = (select auth.uid())
    )
    and not exists (
      select 1 from public.unit_memberships existing
      where existing.user_id = (select auth.uid())
        and existing.is_active
    )
  )
);

create policy "managers can insert audit log"
on public.audit_log for insert to authenticated
with check (
  actor_id = (select auth.uid())
  and private.is_active_manager(organization_id, (select auth.uid()))
);

create or replace function public.create_initial_organization(
  p_name text,
  p_unit_name text,
  p_slug text default null
)
returns table (organization_id uuid, unit_id uuid)
language plpgsql
security invoker
set search_path = public, pg_temp
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

revoke all on function public.create_initial_organization(text, text, text) from public;
revoke all on function public.create_initial_organization(text, text, text) from anon;
grant execute on function public.create_initial_organization(text, text, text) to authenticated;

commit;
