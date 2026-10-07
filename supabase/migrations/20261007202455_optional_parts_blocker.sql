alter table public.service_orders
  add column if not exists parts_blocked boolean not null default false,
  add column if not exists parts_description text,
  add column if not exists parts_supplier text,
  add column if not exists parts_expected_date date,
  add column if not exists parts_note text,
  add column if not exists parts_blocked_at timestamptz,
  add column if not exists parts_received_at timestamptz;
