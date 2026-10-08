begin;

create table public.client_profile_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid not null,
  client_id uuid,
  purpose text not null check (purpose in ('register', 'update')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, unit_id, id),
  foreign key (organization_id, unit_id) references public.units(organization_id, id) on delete cascade,
  foreign key (organization_id, client_id) references public.clients(organization_id, id) on delete cascade,
  check ((purpose = 'register' and client_id is null) or (purpose = 'update' and client_id is not null))
);

create index client_profile_links_target_idx
  on public.client_profile_links (organization_id, purpose, client_id, created_at desc);

alter table public.client_profile_links enable row level security;
revoke all on table public.client_profile_links from public, anon, authenticated;

create or replace function private.create_client_profile_link(
  p_organization_id uuid,
  p_unit_id uuid,
  p_client_id uuid,
  p_purpose text,
  p_token_hash text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  link_row public.client_profile_links;
begin
  if actor is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if not private.has_org_role(p_organization_id, actor, array['gestor', 'atendimento']::public.member_role[]) then
    raise exception 'Sem permissão para gerar links de cadastro.' using errcode = '42501';
  end if;
  if p_purpose not in ('register', 'update') then
    raise exception 'Finalidade de link inválida.' using errcode = '22023';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Token inválido.' using errcode = '22023';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '24 hours' then
    raise exception 'O prazo do link deve estar entre agora e 24 horas.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.units
    where id = p_unit_id and organization_id = p_organization_id and is_active
  ) then
    raise exception 'Unidade inválida.' using errcode = '22023';
  end if;
  if p_purpose = 'update' and not exists (
    select 1 from public.clients
    where id = p_client_id and organization_id = p_organization_id
  ) then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;

  update public.client_profile_links
  set revoked_at = now()
  where organization_id = p_organization_id
    and purpose = p_purpose
    and client_id is not distinct from p_client_id
    and used_at is null
    and revoked_at is null;

  insert into public.client_profile_links (
    organization_id, unit_id, client_id, purpose, token_hash, expires_at, created_by
  ) values (
    p_organization_id, p_unit_id, p_client_id, p_purpose, p_token_hash, p_expires_at, actor
  ) returning * into link_row;

  insert into public.audit_log (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    p_organization_id, actor, 'created', 'client_profile_link', link_row.id,
    jsonb_build_object('purpose', p_purpose, 'client_id', p_client_id, 'expires_at', p_expires_at)
  );

  return jsonb_build_object('id', link_row.id, 'expires_at', link_row.expires_at, 'purpose', link_row.purpose);
end;
$$;

revoke all on function private.create_client_profile_link(uuid, uuid, uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function private.create_client_profile_link(uuid, uuid, uuid, text, text, timestamptz) to authenticated;

create or replace function public.create_client_profile_link(
  p_organization_id uuid,
  p_unit_id uuid,
  p_client_id uuid,
  p_purpose text,
  p_token_hash text,
  p_expires_at timestamptz
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.create_client_profile_link(p_organization_id, p_unit_id, p_client_id, p_purpose, p_token_hash, p_expires_at);
$$;

revoke all on function public.create_client_profile_link(uuid, uuid, uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.create_client_profile_link(uuid, uuid, uuid, text, text, timestamptz) to authenticated;

create or replace function private.get_client_profile_link(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  link_row public.client_profile_links;
  organization_name text;
  client_data jsonb;
  address_data jsonb;
begin
  select * into link_row
  from public.client_profile_links
  where token_hash = p_token_hash
  for update;

  if not found or link_row.used_at is not null or link_row.revoked_at is not null or link_row.expires_at <= now() then
    raise exception 'Link inválido ou expirado.' using errcode = 'P0001';
  end if;

  select name into organization_name from public.organizations where id = link_row.organization_id;
  update public.client_profile_links set last_accessed_at = now() where id = link_row.id;

  if link_row.client_id is not null then
    select jsonb_build_object(
      'full_name', client.full_name,
      'phone', client.phone,
      'email', client.email,
      'tax_id', client.tax_id,
      'document_type', client.document_type,
      'legal_name', client.legal_name,
      'trade_name', client.trade_name,
      'notes', client.notes
    ) into client_data
    from public.clients client
    where client.id = link_row.client_id and client.organization_id = link_row.organization_id;

    select jsonb_build_object(
      'postal_code', address.postal_code,
      'street', address.street,
      'number', address.number,
      'complement', address.complement,
      'neighborhood', address.neighborhood,
      'city', address.city,
      'state', address.state
    ) into address_data
    from public.client_addresses address
    where address.client_id = link_row.client_id
      and address.organization_id = link_row.organization_id
      and address.is_primary
    order by address.created_at
    limit 1;
  end if;

  return jsonb_build_object(
    'purpose', link_row.purpose,
    'organization_name', organization_name,
    'expires_at', link_row.expires_at,
    'client', client_data,
    'address', address_data
  );
end;
$$;

revoke all on function private.get_client_profile_link(text) from public, anon, authenticated;
grant execute on function private.get_client_profile_link(text) to anon, authenticated;

create or replace function public.get_client_profile_link(p_token_hash text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.get_client_profile_link(p_token_hash);
$$;

revoke all on function public.get_client_profile_link(text) from public, anon, authenticated;
grant execute on function public.get_client_profile_link(text) to anon, authenticated;

create or replace function private.save_client_profile_link(p_token_hash text, p_profile jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  link_row public.client_profile_links;
  saved public.clients;
  address_id uuid;
  address_data jsonb := coalesce(p_profile->'address', '{}'::jsonb);
  v_full_name text := btrim(coalesce(p_profile->>'fullName', ''));
  v_phone text := btrim(coalesce(p_profile->>'phone', ''));
  v_email text := nullif(btrim(coalesce(p_profile->>'email', '')), '');
  v_tax_id text := nullif(regexp_replace(coalesce(p_profile->>'taxId', ''), '[^0-9]', '', 'g'), '');
  v_document_type text := case when p_profile->>'documentType' = 'cnpj' then 'cnpj' else 'cpf' end;
begin
  select * into link_row
  from public.client_profile_links
  where token_hash = p_token_hash
  for update;

  if not found or link_row.used_at is not null or link_row.revoked_at is not null or link_row.expires_at <= now() then
    raise exception 'Link inválido ou expirado.' using errcode = 'P0001';
  end if;
  if length(v_full_name) < 3 or length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 8 then
    raise exception 'Informe nome e telefone válidos.' using errcode = '22023';
  end if;
  if v_email is not null and v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Informe um e-mail válido.' using errcode = '22023';
  end if;
  if link_row.purpose = 'register' and v_tax_id is null then
    raise exception 'Informe CPF ou CNPJ.' using errcode = '22023';
  end if;

  if link_row.client_id is null then
    insert into public.clients (
      organization_id, full_name, phone, email, tax_id, document_type,
      legal_name, trade_name, notes
    ) values (
      link_row.organization_id, v_full_name, v_phone, v_email, v_tax_id, v_document_type,
      nullif(btrim(coalesce(p_profile->>'legalName', '')), ''),
      nullif(btrim(coalesce(p_profile->>'tradeName', '')), ''),
      nullif(btrim(coalesce(p_profile->>'notes', '')), '')
    ) returning * into saved;
  else
    update public.clients
    set full_name = v_full_name,
        phone = v_phone,
        email = v_email,
        tax_id = v_tax_id,
        document_type = v_document_type,
        legal_name = nullif(btrim(coalesce(p_profile->>'legalName', '')), ''),
        trade_name = nullif(btrim(coalesce(p_profile->>'tradeName', '')), ''),
        notes = nullif(btrim(coalesce(p_profile->>'notes', '')), '')
    where id = link_row.client_id and organization_id = link_row.organization_id
    returning * into saved;
    if not found then
      raise exception 'Cliente não encontrado.' using errcode = 'P0002';
    end if;
  end if;

  select id into address_id
  from public.client_addresses
  where client_id = saved.id and organization_id = link_row.organization_id and is_primary
  order by created_at
  limit 1;

  if address_id is not null then
    update public.client_addresses
    set street = coalesce(nullif(btrim(address_data->>'street'), ''), 'Não informado'),
        number = nullif(btrim(address_data->>'number'), ''),
        complement = nullif(btrim(address_data->>'complement'), ''),
        neighborhood = nullif(btrim(address_data->>'neighborhood'), ''),
        city = nullif(btrim(address_data->>'city'), ''),
        state = nullif(btrim(address_data->>'state'), ''),
        postal_code = nullif(regexp_replace(coalesce(address_data->>'postalCode', ''), '[^0-9]', '', 'g'), '')
    where id = address_id;
  elsif exists (select 1 from jsonb_each_text(address_data) where length(btrim(value)) > 0) then
    insert into public.client_addresses (
      organization_id, client_id, label, is_primary, street, number,
      complement, neighborhood, city, state, postal_code
    ) values (
      link_row.organization_id, saved.id, 'Principal', true,
      coalesce(nullif(btrim(address_data->>'street'), ''), 'Não informado'),
      nullif(btrim(address_data->>'number'), ''),
      nullif(btrim(address_data->>'complement'), ''),
      nullif(btrim(address_data->>'neighborhood'), ''),
      nullif(btrim(address_data->>'city'), ''),
      nullif(btrim(address_data->>'state'), ''),
      nullif(regexp_replace(coalesce(address_data->>'postalCode', ''), '[^0-9]', '', 'g'), '')
    );
  end if;

  update public.client_profile_links set used_at = now() where id = link_row.id;
  insert into public.audit_log (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    link_row.organization_id, null, 'updated', 'client', saved.id,
    jsonb_build_object('source', 'client_profile_link', 'purpose', link_row.purpose, 'link_id', link_row.id)
  );

  return jsonb_build_object('id', saved.id, 'full_name', saved.full_name, 'purpose', link_row.purpose);
exception
  when unique_violation then
    raise exception 'Já existe um cliente com este documento.' using errcode = '23505';
end;
$$;

revoke all on function private.save_client_profile_link(text, jsonb) from public, anon, authenticated;
grant execute on function private.save_client_profile_link(text, jsonb) to anon, authenticated;

create or replace function public.save_client_profile_link(p_token_hash text, p_profile jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.save_client_profile_link(p_token_hash, p_profile);
$$;

revoke all on function public.save_client_profile_link(text, jsonb) from public, anon, authenticated;
grant execute on function public.save_client_profile_link(text, jsonb) to anon, authenticated;

commit;
