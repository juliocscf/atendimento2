create or replace function public.save_client_with_devices(
  p_organization_id uuid,
  p_unit_id uuid,
  p_client_id uuid,
  p_profile jsonb,
  p_devices jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved jsonb;
  item jsonb;
  device public.devices;
  created_devices jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_devices) is distinct from 'array' or jsonb_array_length(p_devices) > 10 then
    raise exception 'Informe até 10 equipamentos.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.unit_memberships
    where user_id = auth.uid() and organization_id = p_organization_id
      and unit_id = p_unit_id and is_active
      and role in ('gestor', 'atendimento')
  ) then
    raise exception 'Sem permissão para esta unidade.' using errcode = '42501';
  end if;

  saved := public.save_client_profile(p_organization_id, p_client_id, p_profile);
  for item in select value from jsonb_array_elements(p_devices) loop
    if jsonb_typeof(item) <> 'object'
      or length(btrim(coalesce(item->>'kind', ''))) < 2
      or length(btrim(coalesce(item->>'brand', ''))) < 2
      or length(btrim(coalesce(item->>'model', ''))) < 2 then
      raise exception 'Informe tipo, marca e modelo de cada equipamento.' using errcode = '22023';
    end if;
    insert into public.devices (
      organization_id, unit_id, client_id, kind, brand, model, serial, notes, created_by
    ) values (
      p_organization_id, p_unit_id, (saved->>'id')::uuid,
      btrim(item->>'kind'), btrim(item->>'brand'), btrim(item->>'model'),
      nullif(btrim(item->>'serial'), ''), nullif(btrim(item->>'notes'), ''), auth.uid()
    ) returning * into device;
    created_devices := created_devices || jsonb_build_array(jsonb_build_object(
      'id', device.id, 'code', device.code, 'kind', device.kind,
      'brand', device.brand, 'model', device.model
    ));
  end loop;
  return saved || jsonb_build_object('devices', created_devices);
end;
$$;
revoke all on function public.save_client_with_devices(uuid, uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_client_with_devices(uuid, uuid, uuid, jsonb, jsonb) to authenticated;
