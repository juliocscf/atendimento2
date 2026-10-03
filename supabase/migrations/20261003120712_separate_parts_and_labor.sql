-- Preserve history: do not infer whether old descriptions refer to parts or labor.
alter table public.quote_items
  add column item_type text not null default 'unclassified'
    check (item_type in ('part', 'labor', 'unclassified')),
  add column unit_cost_cents integer
    check (unit_cost_cents >= 0),
  add constraint quote_items_cost_only_for_parts
    check (item_type = 'part' or unit_cost_cents is null);

comment on column public.quote_items.item_type is 'Internal classification of parts and labor; historical items remain unclassified.';
comment on column public.quote_items.unit_cost_cents is 'Internal purchase cost per unit. NULL means unknown; never include in customer portal payloads.';
-- Existing organization-scoped RLS still applies. The customer portal projects
-- explicit selling-price fields and does not expose this new purchase-cost column.
