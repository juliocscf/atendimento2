begin;

drop policy if exists "members can view quote items" on public.quote_items;
drop policy if exists "service staff can manage quote items" on public.quote_items;
create policy "members can view quote items"
on public.quote_items for select to authenticated
using (private.is_active_member(organization_id, (select auth.uid())));
create policy "service staff can insert quote items"
on public.quote_items for insert to authenticated
with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::member_role[]));
create policy "service staff can update quote items"
on public.quote_items for update to authenticated
using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::member_role[]))
with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::member_role[]));
create policy "service staff can delete quote items"
on public.quote_items for delete to authenticated
using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::member_role[]));

drop policy if exists "members can view remote sessions" on public.remote_sessions;
drop policy if exists "service team can manage remote sessions" on public.remote_sessions;
create policy "members can view remote sessions"
on public.remote_sessions for select to authenticated
using (private.is_active_member(organization_id, (select auth.uid())));
create policy "service team can insert remote sessions"
on public.remote_sessions for insert to authenticated
with check ((created_by = (select auth.uid())) and private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::member_role[]));
create policy "service team can update remote sessions"
on public.remote_sessions for update to authenticated
using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::member_role[]))
with check ((created_by = (select auth.uid())) and private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::member_role[]));
create policy "service team can delete remote sessions"
on public.remote_sessions for delete to authenticated
using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::member_role[]));

drop policy if exists "members can view service order attachments" on public.service_order_attachments;
drop policy if exists "service team can manage service order attachments" on public.service_order_attachments;
create policy "members can view service order attachments"
on public.service_order_attachments for select to authenticated
using (private.is_active_member(organization_id, (select auth.uid())));
create policy "service team can insert service order attachments"
on public.service_order_attachments for insert to authenticated
with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::member_role[]));
create policy "service team can update service order attachments"
on public.service_order_attachments for update to authenticated
using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::member_role[]))
with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::member_role[]));
create policy "service team can delete service order attachments"
on public.service_order_attachments for delete to authenticated
using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::member_role[]));

drop policy if exists "members can view service order tasks" on public.service_order_tasks;
drop policy if exists "service team can manage service order tasks" on public.service_order_tasks;
create policy "members can view service order tasks"
on public.service_order_tasks for select to authenticated
using (private.is_active_member(organization_id, (select auth.uid())));
create policy "service team can insert service order tasks"
on public.service_order_tasks for insert to authenticated
with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::member_role[]));
create policy "service team can update service order tasks"
on public.service_order_tasks for update to authenticated
using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::member_role[]))
with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::member_role[]));
create policy "service team can delete service order tasks"
on public.service_order_tasks for delete to authenticated
using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::member_role[]));

commit;
