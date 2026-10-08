alter table public.quote_items
  add column if not exists product_id uuid;

do $$
begin
  alter table public.quote_items
    add constraint quote_items_product_fk
    foreign key (organization_id, product_id)
    references public.products(organization_id, id);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.quote_items
    add constraint quote_items_product_is_part
    check (product_id is null or item_type = 'part');
exception when duplicate_object then null;
end $$;

create index if not exists quote_items_product_idx
  on public.quote_items (organization_id, product_id)
  where product_id is not null;

comment on column public.quote_items.product_id is
  'Optional link to the registered product; description, price and cost remain snapshots for the quote.';
