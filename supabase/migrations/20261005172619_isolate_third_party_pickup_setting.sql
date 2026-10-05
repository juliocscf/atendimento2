begin;

create or replace function private.set_third_party_pickup_enabled(
  p_organization_id uuid,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  previous_value boolean;
begin
  if actor is null then
    raise exception 'Authentication is required.';
  end if;

  if not private.is_active_manager(p_organization_id, actor) then
    raise exception 'Apenas gestores podem alterar esta configuração.';
  end if;

  select organization.third_party_pickup_enabled
  into previous_value
  from public.organizations organization
  where organization.id = p_organization_id
  for update;

  if not found then
    raise exception 'Organização não encontrada.';
  end if;

  update public.organizations
  set third_party_pickup_enabled = p_enabled
  where id = p_organization_id;

  if previous_value is distinct from p_enabled then
    insert into public.audit_log (
      organization_id,
      actor_id,
      action,
      entity_type,
      entity_id,
      metadata
    ) values (
      p_organization_id,
      actor,
      case when p_enabled then 'third_party_pickup_enabled' else 'third_party_pickup_disabled' end,
      'organization_setting',
      p_organization_id,
      jsonb_build_object(
        'setting', 'third_party_pickup_enabled',
        'previous_value', previous_value,
        'new_value', p_enabled
      )
    );
  end if;

  return jsonb_build_object(
    'third_party_pickup_enabled', p_enabled,
    'changed', previous_value is distinct from p_enabled
  );
end;
$$;

revoke all on function private.set_third_party_pickup_enabled(uuid, boolean) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.set_third_party_pickup_enabled(uuid, boolean) to authenticated;

create or replace function public.set_third_party_pickup_enabled(
  p_organization_id uuid,
  p_enabled boolean
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.set_third_party_pickup_enabled(p_organization_id, p_enabled);
$$;

revoke all on function public.set_third_party_pickup_enabled(uuid, boolean) from public, anon;
grant execute on function public.set_third_party_pickup_enabled(uuid, boolean) to authenticated;

commit;
