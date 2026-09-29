do $$ begin create type public.quote_status as enum ('draft', 'sent', 'approved', 'rejected', 'expired'); exception when duplicate_object then null; end; $$;
do $$ begin create type public.quote_approval_channel as enum ('portal', 'manual'); exception when duplicate_object then null; end; $$;

create table public.quotes (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, service_order_id uuid not null,
  version integer not null check (version > 0), status public.quote_status not null default 'draft', valid_until date, notes text,
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0), discount_cents integer not null default 0 check (discount_cents >= 0 and discount_cents <= subtotal_cents), total_cents integer not null default 0 check (total_cents = subtotal_cents - discount_cents),
  sent_at timestamptz, approved_at timestamptz, approved_by uuid references auth.users(id) on delete set null, approval_channel public.quote_approval_channel,
  created_by uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, id), unique (organization_id, service_order_id, version),
  foreign key (organization_id, service_order_id) references public.service_orders(organization_id, id) on delete cascade
);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, quote_id uuid not null, description text not null check (length(btrim(description)) >= 2), quantity numeric(10,2) not null check (quantity > 0), unit_price_cents integer not null check (unit_price_cents >= 0), total_cents integer not null check (total_cents >= 0), position integer not null default 0, created_at timestamptz not null default now(),
  unique (organization_id, id), foreign key (organization_id, quote_id) references public.quotes(organization_id, id) on delete cascade
);

create table public.quote_portal_links (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, quote_id uuid not null, token_hash text not null, expires_at timestamptz not null, revoked_at timestamptz, last_accessed_at timestamptz, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
  unique (organization_id, id), unique (token_hash), foreign key (organization_id, quote_id) references public.quotes(organization_id, id) on delete cascade
);

create table public.service_order_payments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, service_order_id uuid not null, amount_cents integer not null check (amount_cents > 0), method text not null check (method in ('pix', 'cartao', 'dinheiro', 'transferencia', 'outro')), received_at timestamptz not null default now(), idempotency_key text not null, note text, created_by uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now(),
  unique (organization_id, id), unique (organization_id, idempotency_key), foreign key (organization_id, service_order_id) references public.service_orders(organization_id, id) on delete restrict
);

create index quotes_order_idx on public.quotes (organization_id, service_order_id, version desc);
create index quotes_status_idx on public.quotes (organization_id, status, updated_at desc);
create index quote_items_quote_idx on public.quote_items (organization_id, quote_id, position);
create index quote_portal_links_quote_idx on public.quote_portal_links (organization_id, quote_id);
create index payments_order_idx on public.service_order_payments (organization_id, service_order_id, received_at desc);
create trigger quotes_set_updated_at before update on public.quotes for each row execute function public.set_updated_at();

create or replace function private.refresh_order_paid_total() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare target_order_id uuid := coalesce(new.service_order_id, old.service_order_id); target_organization_id uuid := coalesce(new.organization_id, old.organization_id);
begin update public.service_orders set paid_cents = coalesce((select sum(amount_cents) from public.service_order_payments where organization_id = target_organization_id and service_order_id = target_order_id), 0) where organization_id = target_organization_id and id = target_order_id; return coalesce(new, old); end;
$$;
revoke all on function private.refresh_order_paid_total() from public;
create trigger payments_refresh_order_total after insert or update or delete on public.service_order_payments for each row execute function private.refresh_order_paid_total();

alter table public.quotes enable row level security; alter table public.quote_items enable row level security; alter table public.quote_portal_links enable row level security; alter table public.service_order_payments enable row level security;
create policy "members can view quotes" on public.quotes for select to authenticated using (private.is_active_member(organization_id, (select auth.uid())));
create policy "service staff can create quotes" on public.quotes for insert to authenticated with check (created_by = (select auth.uid()) and private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::public.member_role[]));
create policy "service staff can update quotes" on public.quotes for update to authenticated using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::public.member_role[])) with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::public.member_role[]));
create policy "members can view quote items" on public.quote_items for select to authenticated using (private.is_active_member(organization_id, (select auth.uid())));
create policy "service staff can manage quote items" on public.quote_items for all to authenticated using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::public.member_role[])) with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::public.member_role[]));
create policy "service staff can manage portal links" on public.quote_portal_links for all to authenticated using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::public.member_role[])) with check (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento']::public.member_role[]));
create policy "finance team can view payments" on public.service_order_payments for select to authenticated using (private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'atendimento', 'financeiro']::public.member_role[]));
create policy "finance team can create payments" on public.service_order_payments for insert to authenticated with check (created_by = (select auth.uid()) and private.has_org_role(organization_id, (select auth.uid()), array['gestor', 'financeiro']::public.member_role[]));
