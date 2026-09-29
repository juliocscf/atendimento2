insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'device-photos',
  'device-photos',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "device photos members can read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'device-photos'
  and exists (
    select 1
    from public.devices d
    where d.organization_id = nullif((storage.foldername(name))[1], '')::uuid
      and d.id = nullif((storage.foldername(name))[2], '')::uuid
      and private.is_active_member(d.organization_id, (select auth.uid()))
  )
);

create policy "device photos members can upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'device-photos'
  and exists (
    select 1
    from public.devices d
    where d.organization_id = nullif((storage.foldername(name))[1], '')::uuid
      and d.id = nullif((storage.foldername(name))[2], '')::uuid
      and private.is_active_member(d.organization_id, (select auth.uid()))
  )
);

create policy "device photos members can delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'device-photos'
  and exists (
    select 1
    from public.devices d
    where d.organization_id = nullif((storage.foldername(name))[1], '')::uuid
      and d.id = nullif((storage.foldername(name))[2], '')::uuid
      and private.is_active_member(d.organization_id, (select auth.uid()))
  )
);
