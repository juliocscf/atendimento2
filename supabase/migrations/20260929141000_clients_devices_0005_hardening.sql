begin;

create schema if not exists extensions;
alter extension pg_trgm set schema extensions;

create index clients_created_by_idx on public.clients (created_by);
create index devices_created_by_idx on public.devices (created_by);
create index devices_unit_idx on public.devices (organization_id, unit_id);
create index device_photos_created_by_idx on public.device_photos (created_by);

drop policy "service staff can manage client contacts" on public.client_contacts;
create policy "service staff can insert client contacts"
on public.client_contacts for insert to authenticated
with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::public.member_role[]));
create policy "service staff can update client contacts"
on public.client_contacts for update to authenticated
using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::public.member_role[]))
with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::public.member_role[]));
create policy "service staff can delete client contacts"
on public.client_contacts for delete to authenticated
using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::public.member_role[]));

drop policy "service staff can manage client addresses" on public.client_addresses;
create policy "service staff can insert client addresses"
on public.client_addresses for insert to authenticated
with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::public.member_role[]));
create policy "service staff can update client addresses"
on public.client_addresses for update to authenticated
using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::public.member_role[]))
with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::public.member_role[]));
create policy "service staff can delete client addresses"
on public.client_addresses for delete to authenticated
using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::public.member_role[]));

drop policy "service team can manage device photos" on public.device_photos;
create policy "service team can insert device photos"
on public.device_photos for insert to authenticated
with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::public.member_role[]));
create policy "service team can update device photos"
on public.device_photos for update to authenticated
using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::public.member_role[]))
with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::public.member_role[]));
create policy "service team can delete device photos"
on public.device_photos for delete to authenticated
using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::public.member_role[]));

commit;
