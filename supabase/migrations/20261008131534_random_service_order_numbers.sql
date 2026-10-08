create table if not exists private.service_order_number_reservations (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_year integer not null check (order_year between 2000 and 9999),
  suffix integer not null check (suffix between 0 and 99999),
  created_at timestamptz not null default now(),
  primary key (organization_id, order_year, suffix)
);

insert into private.service_order_number_reservations (organization_id, order_year, suffix)
select
  organization_id,
  split_part(number, '-', 2)::integer,
  split_part(number, '-', 3)::integer
from public.service_orders
where number ~ '^OS-[0-9]{4}-[0-9]{5}$'
on conflict (organization_id, order_year, suffix) do nothing;

create or replace function private.next_service_order_number(target_organization_id uuid)
returns text
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  current_year integer := extract(year from timezone('America/Sao_Paulo', now()))::integer;
  candidate_suffix integer;
  candidate_number text;
begin
  if target_organization_id is null then
    raise exception 'Organization is required';
  end if;

  for attempt in 1..100 loop
    candidate_suffix := floor(random() * 100000)::integer;
    candidate_number := format('OS-%s-%s', current_year, lpad(candidate_suffix::text, 5, '0'));

    if exists (
      select 1
      from public.service_orders
      where organization_id = target_organization_id
        and number = candidate_number
    ) then
      continue;
    end if;

    begin
      insert into private.service_order_number_reservations (organization_id, order_year, suffix)
      values (target_organization_id, current_year, candidate_suffix);
      return candidate_number;
    exception when unique_violation then
      -- Outra transação reservou o mesmo sufixo; tente novamente.
    end;
  end loop;

  raise exception using
    errcode = 'unique_violation',
    message = 'Não foi possível gerar um número único para a ordem de serviço.';
end;
$$;

revoke all on table private.service_order_number_reservations from public, anon, authenticated;
revoke all on function private.next_service_order_number(uuid) from public;
grant execute on function private.next_service_order_number(uuid) to authenticated;
