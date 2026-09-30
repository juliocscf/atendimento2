-- Allow active managers to update the organization identity shown in settings.
create policy "managers can update their organization"
on public.organizations
for update
to authenticated
using (private.is_active_manager(id, (select auth.uid())))
with check (private.is_active_manager(id, (select auth.uid())));
