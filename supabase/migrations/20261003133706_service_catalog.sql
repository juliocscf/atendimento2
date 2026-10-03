begin;
create table public.service_catalog (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 code text not null check (code ~ '^[A-Z0-9][A-Z0-9_-]{0,29}$'), name text not null check (length(btrim(name)) between 2 and 120),
 description text not null default '' check (length(description) <= 2000), category text not null default '' check (length(category) <= 80),
 default_price_cents integer not null check (default_price_cents >= 0), is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (organization_id, code), unique (organization_id, id)
);
alter table public.service_catalog enable row level security;
grant select, insert, update on public.service_catalog to authenticated;
create policy "members read service catalog" on public.service_catalog for select to authenticated
 using (private.is_active_member(organization_id, (select auth.uid())));
create policy "service staff create catalog" on public.service_catalog for insert to authenticated
 with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor','atendimento']::public.member_role[]));
create policy "service staff edit catalog" on public.service_catalog for update to authenticated
 using (private.has_org_role(organization_id, (select auth.uid()), array['gestor','atendimento']::public.member_role[]))
 with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor','atendimento']::public.member_role[]));
create trigger service_catalog_updated before update on public.service_catalog for each row execute function public.set_updated_at();
alter table public.quote_items add column service_catalog_id uuid, add column service_code text, add column service_name text,
 add constraint quote_items_catalog_fk foreign key (organization_id, service_catalog_id) references public.service_catalog(organization_id, id),
 add constraint quote_items_service_is_labor check (service_catalog_id is null or item_type = 'labor'),
 add constraint quote_items_service_snapshot check ((service_catalog_id is null and service_code is null and service_name is null) or (service_catalog_id is not null and service_code is not null and service_name is not null));
create index quote_items_service_catalog_idx on public.quote_items (organization_id, service_catalog_id) where service_catalog_id is not null;
comment on column public.quote_items.service_code is 'Snapshot of selected service code. Catalog edits never modify existing quote items.';
commit;
