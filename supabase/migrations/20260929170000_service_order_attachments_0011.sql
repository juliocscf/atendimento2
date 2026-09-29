insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-attachments', 'order-attachments', false, 20971520, array['image/jpeg','image/png','image/webp','application/pdf','text/plain']::text[])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table public.service_order_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  service_order_id uuid not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size integer not null check (file_size > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, storage_path),
  foreign key (organization_id, service_order_id) references public.service_orders(organization_id, id) on delete cascade
);

create index service_order_attachments_order_idx on public.service_order_attachments (organization_id, service_order_id, created_at desc);
alter table public.service_order_attachments enable row level security;

create policy "members can view service order attachments" on public.service_order_attachments for select to authenticated using (private.is_active_member(organization_id, (select auth.uid())));
create policy "service team can manage service order attachments" on public.service_order_attachments for all to authenticated using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::public.member_role[])) with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::public.member_role[]));

create policy "order attachments members can read" on storage.objects for select to authenticated using (
  bucket_id = 'order-attachments' and exists (select 1 from public.service_orders order_row where order_row.organization_id = nullif((storage.foldername(name))[1], '')::uuid and order_row.id = nullif((storage.foldername(name))[2], '')::uuid and private.is_active_member(order_row.organization_id, (select auth.uid())))
);
create policy "order attachments team can upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'order-attachments' and exists (select 1 from public.service_orders order_row where order_row.organization_id = nullif((storage.foldername(name))[1], '')::uuid and order_row.id = nullif((storage.foldername(name))[2], '')::uuid and private.has_org_role(order_row.organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::public.member_role[]))
);
create policy "order attachments team can delete" on storage.objects for delete to authenticated using (
  bucket_id = 'order-attachments' and exists (select 1 from public.service_orders order_row where order_row.organization_id = nullif((storage.foldername(name))[1], '')::uuid and order_row.id = nullif((storage.foldername(name))[2], '')::uuid and private.has_org_role(order_row.organization_id, (select auth.uid()), array['gestor', 'atendimento', 'tecnico']::public.member_role[]))
);
