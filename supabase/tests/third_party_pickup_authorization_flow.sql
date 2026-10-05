begin;

create temporary table pickup_flow_context on commit drop as
select orders.organization_id, orders.id as service_order_id, membership.user_id
from public.service_orders orders
join public.unit_memberships membership
  on membership.organization_id = orders.organization_id
 and membership.is_active
 and membership.role = 'gestor'
order by orders.created_at, membership.created_at
limit 1;

do $$
begin
  if not exists (select 1 from pickup_flow_context) then
    raise exception 'O teste exige uma ordem de serviço e um gestor ativo.';
  end if;
  if has_table_privilege('anon', 'public.service_order_pickup_authorizations', 'SELECT') then
    raise exception 'A role anon não pode consultar a tabela de autorizações.';
  end if;
  if not has_function_privilege('anon', 'public.request_pickup_authorization(text,text,text,text)', 'EXECUTE') then
    raise exception 'A role anon precisa acessar somente a função pública controlada.';
  end if;
  if has_function_privilege('anon', 'public.collect_pickup_authorization(uuid,text)', 'EXECUTE') then
    raise exception 'A role anon não pode registrar a retirada.';
  end if;
end;
$$;

select set_config('pickup.test.organization_id', (select organization_id::text from pickup_flow_context), true);
select set_config('pickup.test.order_id', (select service_order_id::text from pickup_flow_context), true);
select set_config('pickup.test.manager_id', (select user_id::text from pickup_flow_context), true);

update public.organizations set third_party_pickup_enabled = true
where id = current_setting('pickup.test.organization_id')::uuid;
update public.service_orders set status = 'Pronto para entrega', third_party_pickup_blocked = false
where id = current_setting('pickup.test.order_id')::uuid;
delete from private.pickup_authorization_codes where authorization_id in (
  select id from public.service_order_pickup_authorizations
  where service_order_id = current_setting('pickup.test.order_id')::uuid
);
update public.service_order_pickup_authorizations set status = 'cancelled', cancelled_at = now()
where service_order_id = current_setting('pickup.test.order_id')::uuid and status in ('requested', 'confirmed');
update public.service_order_portal_links set revoked_at = now()
where service_order_id = current_setting('pickup.test.order_id')::uuid and revoked_at is null;
insert into public.service_order_portal_links (organization_id, service_order_id, token_hash)
values (current_setting('pickup.test.organization_id')::uuid, current_setting('pickup.test.order_id')::uuid, repeat('e', 64));

set local role anon;

select 1 / (((public.request_pickup_authorization(
  repeat('e', 64), 'Pessoa Autorizada', '52998224725', 'whatsapp'
)->>'status') = 'requested')::integer) as request_created;

reset role;

select set_config('pickup.test.code', (
  select code.verification_code
  from private.pickup_authorization_codes code
  join public.service_order_pickup_authorizations authz on authz.id = code.authorization_id
  where authz.service_order_id = current_setting('pickup.test.order_id')::uuid
    and authz.status = 'requested'
), true);

set local role anon;

select 1 / ((not (public.verify_pickup_authorization(repeat('e', 64), '000000')->>'verified')::boolean)::integer) as incorrect_code_rejected;

select 1 / (((public.verify_pickup_authorization(
  repeat('e', 64), current_setting('pickup.test.code')
)->>'verified')::boolean)::integer) as correct_code_confirmed;

reset role;

select set_config('request.jwt.claim.sub', current_setting('pickup.test.manager_id'), true);
set local role authenticated;

select 1 / (((public.get_pickup_authorization_for_staff(
  current_setting('pickup.test.order_id')::uuid
)->'authorization'->>'status') = 'confirmed')::integer) as staff_sees_confirmation;

select 1 / (((public.collect_pickup_authorization(
  current_setting('pickup.test.order_id')::uuid, '52998224725'
)->>'status') = 'collected')::integer) as collection_registered;

select 1 / (((
  select status = 'Concluído'
  from public.service_orders
  where id = current_setting('pickup.test.order_id')::uuid
))::integer) as order_completed;

reset role;
rollback;
