-- Fiscal integration metadata for direct product sales.
-- The Notaas API key remains exclusively in the application environment.
alter table public.products
  add column ncm text not null default '' check (ncm = '' or ncm ~ '^[0-9]{8}$'),
  add column cfop text not null default '' check (cfop = '' or cfop ~ '^[0-9]{4}$'),
  add column csosn text not null default '' check (csosn = '' or csosn ~ '^[0-9]{3}$'),
  add column cst text not null default '' check (cst = '' or cst ~ '^[0-9]{2}$'),
  add constraint products_single_icms_code check (csosn = '' or cst = '');

create table public.fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  unit_id uuid not null,
  sale_id uuid not null,
  provider text not null default 'notaas' check (provider = 'notaas'),
  model smallint not null default 65 check (model in (55, 65)),
  status text not null default 'submitting' check (status in ('submitting','queued','processing','issued','error','cancel_pending','cancelled','inutilized')),
  provider_invoice_id text,
  access_key text,
  number text,
  series text,
  protocol text,
  error_message text,
  provider_response jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sale_id),
  unique (organization_id, provider_invoice_id),
  foreign key (organization_id, unit_id) references public.units(organization_id, id),
  foreign key (organization_id, sale_id) references public.product_sales(organization_id, id)
);

create index fiscal_documents_unit_created_idx
  on public.fiscal_documents(organization_id, unit_id, created_at desc);
create index fiscal_documents_status_idx
  on public.fiscal_documents(organization_id, status);

alter table public.fiscal_documents enable row level security;
revoke all on public.fiscal_documents from anon, authenticated;
grant select, insert on public.fiscal_documents to authenticated;
grant update(status, provider_invoice_id, access_key, number, series, protocol, error_message, provider_response, updated_at)
  on public.fiscal_documents to authenticated;

create policy fiscal_documents_members_read
  on public.fiscal_documents for select to authenticated
  using (private.is_active_member(organization_id, (select auth.uid())));

create policy fiscal_documents_authorized_insert
  on public.fiscal_documents for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.unit_memberships membership
      where membership.organization_id = fiscal_documents.organization_id
        and membership.unit_id = fiscal_documents.unit_id
        and membership.user_id = (select auth.uid())
        and membership.is_active
        and membership.role in ('gestor', 'atendimento')
    )
  );

create policy fiscal_documents_authorized_update
  on public.fiscal_documents for update to authenticated
  using (
    exists (
      select 1 from public.unit_memberships membership
      where membership.organization_id = fiscal_documents.organization_id
        and membership.unit_id = fiscal_documents.unit_id
        and membership.user_id = (select auth.uid())
        and membership.is_active
        and membership.role in ('gestor', 'atendimento')
    )
  )
  with check (
    exists (
      select 1 from public.unit_memberships membership
      where membership.organization_id = fiscal_documents.organization_id
        and membership.unit_id = fiscal_documents.unit_id
        and membership.user_id = (select auth.uid())
        and membership.is_active
        and membership.role in ('gestor', 'atendimento')
    )
  );

grant update(ncm, cfop, csosn, cst) on public.products to authenticated;
create policy products_authorized_fiscal_update
  on public.products for update to authenticated
  using (
    exists (
      select 1 from public.unit_memberships membership
      where membership.organization_id = products.organization_id
        and membership.user_id = (select auth.uid())
        and membership.is_active
        and membership.role in ('gestor', 'atendimento')
    )
  )
  with check (
    exists (
      select 1 from public.unit_memberships membership
      where membership.organization_id = products.organization_id
        and membership.user_id = (select auth.uid())
        and membership.is_active
        and membership.role in ('gestor', 'atendimento')
    )
  );
