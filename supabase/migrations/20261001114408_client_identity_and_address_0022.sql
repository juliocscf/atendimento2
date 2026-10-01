begin;

alter table public.clients
  add column if not exists document_type text not null default 'cpf'
    check (document_type in ('cpf', 'cnpj')),
  add column if not exists legal_name text,
  add column if not exists trade_name text;

create unique index if not exists clients_organization_tax_id_uidx
  on public.clients (organization_id, tax_id)
  where tax_id is not null and length(btrim(tax_id)) > 0;

commit;
