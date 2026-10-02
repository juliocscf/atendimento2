create or replace function public.save_client_profile(p_organization_id uuid, p_client_id uuid, p_profile jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved public.clients;
  address_id uuid;
  address_data jsonb := coalesce(p_profile->'address', '{}'::jsonb);
begin
  if auth.uid() is null or not private.has_org_role(p_organization_id, auth.uid(), array['gestor', 'atendimento']::public.member_role[]) then
    raise exception 'Sem permissão para salvar clientes.' using errcode = '42501';
  end if;
  if p_client_id is null then
    insert into public.clients (organization_id, full_name, phone, email, tax_id, document_type, legal_name, trade_name, notes, created_by)
    values (p_organization_id, btrim(p_profile->>'fullName'), btrim(p_profile->>'phone'), nullif(btrim(p_profile->>'email'), ''), nullif(p_profile->>'taxId', ''), p_profile->>'documentType', nullif(btrim(p_profile->>'legalName'), ''), nullif(btrim(p_profile->>'tradeName'), ''), nullif(btrim(p_profile->>'notes'), ''), auth.uid())
    returning * into saved;
  else
    select * into saved from public.clients where id = p_client_id and organization_id = p_organization_id for update;
    if not found then raise exception 'Cliente não encontrado.' using errcode = 'P0002'; end if;
    update public.clients set full_name = btrim(p_profile->>'fullName'), phone = btrim(p_profile->>'phone'), email = nullif(btrim(p_profile->>'email'), ''), tax_id = nullif(p_profile->>'taxId', ''), document_type = p_profile->>'documentType', legal_name = nullif(btrim(p_profile->>'legalName'), ''), trade_name = nullif(btrim(p_profile->>'tradeName'), ''), notes = nullif(btrim(p_profile->>'notes'), '')
    where id = p_client_id and organization_id = p_organization_id returning * into saved;
    if not found then raise exception 'Sem permissão para editar este cliente.' using errcode = '42501'; end if;
  end if;
  select id into address_id from public.client_addresses where client_id = saved.id and organization_id = p_organization_id and is_primary order by created_at limit 1;
  if address_id is not null then
    update public.client_addresses set street = coalesce(nullif(btrim(address_data->>'street'), ''), 'Não informado'), number = nullif(btrim(address_data->>'number'), ''), complement = nullif(btrim(address_data->>'complement'), ''), neighborhood = nullif(btrim(address_data->>'neighborhood'), ''), city = nullif(btrim(address_data->>'city'), ''), state = nullif(btrim(address_data->>'state'), ''), postal_code = nullif(address_data->>'postalCode', '') where id = address_id;
  elsif exists (select 1 from jsonb_each_text(address_data) where length(btrim(value)) > 0) then
    insert into public.client_addresses (organization_id, client_id, label, is_primary, street, number, complement, neighborhood, city, state, postal_code)
    values (p_organization_id, saved.id, 'Principal', true, coalesce(nullif(btrim(address_data->>'street'), ''), 'Não informado'), nullif(btrim(address_data->>'number'), ''), nullif(btrim(address_data->>'complement'), ''), nullif(btrim(address_data->>'neighborhood'), ''), nullif(btrim(address_data->>'city'), ''), nullif(btrim(address_data->>'state'), ''), nullif(address_data->>'postalCode', ''));
  end if;
  return jsonb_build_object('id', saved.id, 'full_name', saved.full_name);
end;
$$;
revoke all on function public.save_client_profile(uuid, uuid, jsonb) from public, anon;
grant execute on function public.save_client_profile(uuid, uuid, jsonb) to authenticated;
