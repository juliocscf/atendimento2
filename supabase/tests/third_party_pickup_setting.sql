begin;

create temporary table third_party_pickup_test_context on commit drop as
select membership.organization_id, membership.user_id
from public.unit_memberships membership
where membership.is_active
  and membership.role = 'gestor'
order by membership.created_at
limit 1;

do $$
begin
  if not exists (select 1 from third_party_pickup_test_context) then
    raise exception 'O teste exige pelo menos um gestor ativo.';
  end if;
  if has_function_privilege('anon', 'public.set_third_party_pickup_enabled(uuid,boolean)', 'EXECUTE') then
    raise exception 'A role anon não pode alterar a configuração de retirada.';
  end if;
  if not has_function_privilege('authenticated', 'public.set_third_party_pickup_enabled(uuid,boolean)', 'EXECUTE') then
    raise exception 'A role authenticated precisa acessar a função protegida.';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', (select user_id::text from third_party_pickup_test_context), true);
select set_config('pickup.test_organization_id', (select organization_id::text from third_party_pickup_test_context), true);
select set_config('pickup.test_user_id', (select user_id::text from third_party_pickup_test_context), true);

set local role authenticated;

select 1 / (((public.set_third_party_pickup_enabled(
  current_setting('pickup.test_organization_id')::uuid,
  true
)->>'third_party_pickup_enabled')::boolean)::integer) as setting_enabled;

select 1 / ((
  select third_party_pickup_enabled
  from public.organizations
  where id = current_setting('pickup.test_organization_id')::uuid
)::integer) as persisted_for_organization;

select 1 / ((exists (
  select 1
  from public.audit_log
  where organization_id = current_setting('pickup.test_organization_id')::uuid
    and actor_id = current_setting('pickup.test_user_id')::uuid
    and action = 'third_party_pickup_enabled'
    and metadata->>'setting' = 'third_party_pickup_enabled'
))::integer) as activation_audited;

select 1 / ((not (public.set_third_party_pickup_enabled(
  current_setting('pickup.test_organization_id')::uuid,
  false
)->>'third_party_pickup_enabled')::boolean)::integer) as setting_disabled;

reset role;
rollback;
