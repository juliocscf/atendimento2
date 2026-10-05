begin;

create temporary table portal_test_order on commit drop as
select orders.organization_id, orders.id as service_order_id, membership.user_id
from public.service_orders orders
join public.unit_memberships membership
  on membership.organization_id = orders.organization_id
 and membership.is_active
 and membership.role in ('gestor', 'atendimento')
order by orders.created_at, membership.created_at
limit 1;

do $$
begin
  if not exists (select 1 from portal_test_order) then
    raise exception 'O teste exige pelo menos uma ordem de serviço.';
  end if;
  if has_table_privilege('anon', 'public.service_order_portal_links', 'SELECT') then
    raise exception 'A role anon não pode consultar a tabela de links diretamente.';
  end if;
  if not has_function_privilege('anon', 'public.get_service_order_portal_details(text)', 'EXECUTE') then
    raise exception 'A role anon precisa executar a consulta pública controlada.';
  end if;
  if has_function_privilege('authenticated', 'public.get_service_order_portal_details(text)', 'EXECUTE') then
    raise exception 'A consulta pública deve ser executada pelo cliente público sem sessão.';
  end if;
end;
$$;

update public.service_order_portal_links link
set revoked_at = now()
from portal_test_order target
where link.organization_id = target.organization_id
  and link.service_order_id = target.service_order_id
  and link.revoked_at is null;

insert into public.service_order_portal_links (
  organization_id,
  service_order_id,
  token_hash,
  created_by
)
select organization_id, service_order_id, repeat('a', 64), null
from portal_test_order;

set local role anon;

with payload as (
  select public.get_service_order_portal_details(repeat('a', 64)) as value
)
select 1 / ((
  value is not null
  and value ? 'order_number'
  and value ? 'events'
  and value ? 'balance_cents'
  and not value ? 'serial'
  and not value ? 'actor_id'
  and not value ? 'metadata'
)::integer) as valid_payload
from payload;

select 1 / ((public.get_service_order_portal_details(repeat('b', 64)) is null)::integer) as invalid_token_blocked;

reset role;

update public.service_order_portal_links
set expires_at = now() - interval '1 minute'
where token_hash = repeat('a', 64);

set local role anon;

select 1 / ((public.get_service_order_portal_details(repeat('a', 64)) is null)::integer) as expired_token_blocked;

reset role;

select set_config('request.jwt.claim.sub', (select user_id::text from portal_test_order), true);
select set_config('portal.test_order_id', (select service_order_id::text from portal_test_order), true);

set local role authenticated;

select 1 / ((public.replace_service_order_portal_link(
  current_setting('portal.test_order_id')::uuid,
  repeat('c', 64)
) is not null)::integer) as first_link_created;

select 1 / ((
  select count(*) = 1
  from public.service_order_portal_links
  where service_order_id = current_setting('portal.test_order_id')::uuid
    and token_hash = repeat('c', 64)
    and revoked_at is null
)::integer) as first_link_active;

select 1 / ((public.replace_service_order_portal_link(
  current_setting('portal.test_order_id')::uuid,
  repeat('d', 64)
) is not null)::integer) as replacement_created;

select 1 / ((
  select count(*) = 1
  from public.service_order_portal_links
  where service_order_id = current_setting('portal.test_order_id')::uuid
    and token_hash = repeat('d', 64)
    and revoked_at is null
)::integer) as only_replacement_active;

select 1 / ((public.revoke_service_order_portal_link(
  current_setting('portal.test_order_id')::uuid
))::integer) as active_link_revoked;

select 1 / ((
  select count(*) = 0
  from public.service_order_portal_links
  where service_order_id = current_setting('portal.test_order_id')::uuid
    and revoked_at is null
)::integer) as no_active_link_remaining;

reset role;
rollback;
