begin;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);

drop policy "members can view their memberships" on public.unit_memberships;
drop policy "managers can manage memberships" on public.unit_memberships;

create policy "members and managers can view memberships"
on public.unit_memberships for select to authenticated
using (
  user_id = (select auth.uid())
  or private.is_active_manager(organization_id, (select auth.uid()))
);

create policy "managers can insert memberships"
on public.unit_memberships for insert to authenticated
with check (private.is_active_manager(organization_id, (select auth.uid())));

create policy "managers can update memberships"
on public.unit_memberships for update to authenticated
using (private.is_active_manager(organization_id, (select auth.uid())))
with check (private.is_active_manager(organization_id, (select auth.uid())));

create policy "managers can delete memberships"
on public.unit_memberships for delete to authenticated
using (private.is_active_manager(organization_id, (select auth.uid())));

commit;
