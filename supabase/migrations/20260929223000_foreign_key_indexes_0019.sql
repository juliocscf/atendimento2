begin;

create index if not exists appointment_events_actor_idx on public.appointment_events (actor_id);
create index if not exists appointments_assigned_to_idx on public.appointments (assigned_to);
create index if not exists appointments_created_by_idx on public.appointments (created_by);
create index if not exists appointments_client_fk_idx on public.appointments (organization_id, client_id);
create index if not exists appointments_service_order_fk_idx on public.appointments (organization_id, service_order_id);
create index if not exists appointments_unit_idx on public.appointments (unit_id);
create index if not exists appointments_updated_by_idx on public.appointments (updated_by);
create index if not exists quote_portal_links_created_by_idx on public.quote_portal_links (created_by);
create index if not exists quotes_approved_by_idx on public.quotes (approved_by);
create index if not exists quotes_created_by_idx on public.quotes (created_by);
create index if not exists remote_sessions_created_by_idx on public.remote_sessions (created_by);
create index if not exists remote_sessions_appointment_fk_idx on public.remote_sessions (organization_id, appointment_id);
create index if not exists remote_sessions_organization_idx on public.remote_sessions (organization_id);
create index if not exists service_order_attachments_created_by_idx on public.service_order_attachments (created_by);
create index if not exists service_order_events_actor_idx on public.service_order_events (actor_id);
create index if not exists service_order_payments_created_by_idx on public.service_order_payments (created_by);
create index if not exists service_order_tasks_completed_by_idx on public.service_order_tasks (completed_by);
create index if not exists service_order_tasks_created_by_idx on public.service_order_tasks (created_by);
create index if not exists service_orders_assigned_to_idx on public.service_orders (assigned_to);
create index if not exists service_orders_created_by_idx on public.service_orders (created_by);
create index if not exists service_orders_unit_fk_idx on public.service_orders (organization_id, unit_id);

commit;
