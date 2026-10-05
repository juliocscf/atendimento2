begin;

alter table public.service_orders
add column if not exists third_party_pickup_blocked boolean not null default false;

create table public.service_order_pickup_authorizations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  service_order_id uuid not null,
  status text not null default 'requested'
    check (status in ('requested', 'confirmed', 'cancelled', 'expired', 'collected')),
  authorized_name text not null check (length(btrim(authorized_name)) between 3 and 120),
  cpf_hash text not null check (cpf_hash ~ '^[0-9a-f]{64}$'),
  cpf_last4 char(4) not null check (cpf_last4 ~ '^[0-9]{4}$'),
  delivery_channel text not null check (delivery_channel in ('whatsapp', 'email')),
  contact_mask text not null,
  verification_attempts smallint not null default 0 check (verification_attempts between 0 and 3),
  code_expires_at timestamptz not null,
  confirmed_at timestamptz,
  expires_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  collected_at timestamptz,
  collected_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, service_order_id)
    references public.service_orders(organization_id, id)
    on delete cascade
);

create unique index service_order_pickup_authorizations_active_idx
on public.service_order_pickup_authorizations (organization_id, service_order_id)
where status in ('requested', 'confirmed');

create index service_order_pickup_authorizations_order_idx
on public.service_order_pickup_authorizations (organization_id, service_order_id, requested_at desc);

create table private.pickup_authorization_codes (
  authorization_id uuid primary key references public.service_order_pickup_authorizations(id) on delete cascade,
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  verification_code char(6) not null check (verification_code ~ '^[0-9]{6}$'),
  created_at timestamptz not null default now()
);

revoke all on table private.pickup_authorization_codes from public, anon, authenticated;

alter table public.service_order_pickup_authorizations enable row level security;
revoke all on table public.service_order_pickup_authorizations from public, anon, authenticated;
grant select on table public.service_order_pickup_authorizations to authenticated;

create policy "members can view pickup authorizations"
on public.service_order_pickup_authorizations for select to authenticated
using (private.is_active_member(organization_id, (select auth.uid())));

create trigger service_order_pickup_authorizations_set_updated_at
before update on public.service_order_pickup_authorizations
for each row execute function public.set_updated_at();

create or replace function private.is_valid_cpf(p_value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  digits text := regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g');
  total integer := 0;
  first_digit integer;
  second_digit integer;
  position integer;
begin
  if length(digits) <> 11 or digits ~ '^([0-9])\1{10}$' then
    return false;
  end if;
  for position in 1..9 loop
    total := total + substring(digits from position for 1)::integer * (11 - position);
  end loop;
  first_digit := case when (total * 10) % 11 = 10 then 0 else (total * 10) % 11 end;
  if first_digit <> substring(digits from 10 for 1)::integer then
    return false;
  end if;
  total := 0;
  for position in 1..10 loop
    total := total + substring(digits from position for 1)::integer * (12 - position);
  end loop;
  second_digit := case when (total * 10) % 11 = 10 then 0 else (total * 10) % 11 end;
  return second_digit = substring(digits from 11 for 1)::integer;
end;
$$;

revoke all on function private.is_valid_cpf(text) from public, anon, authenticated;

create or replace function private.request_pickup_authorization(
  p_token_hash text,
  p_authorized_name text,
  p_cpf text,
  p_delivery_channel text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  link_row public.service_order_portal_links;
  order_row public.service_orders;
  client_row public.clients;
  authorization_row public.service_order_pickup_authorizations;
  active_row public.service_order_pickup_authorizations;
  cpf_digits text := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
  channel text := lower(btrim(coalesce(p_delivery_channel, '')));
  contact_mask text;
  verification_code text;
begin
  select link.* into link_row
  from public.service_order_portal_links link
  where link.token_hash = nullif(btrim(p_token_hash), '')
    and link.revoked_at is null
    and (link.expires_at is null or link.expires_at > now())
  limit 1;

  if link_row.id is null then
    raise exception 'Este link de acompanhamento é inválido ou expirou.';
  end if;

  select orders.* into order_row
  from public.service_orders orders
  join public.organizations organization on organization.id = orders.organization_id
  where orders.organization_id = link_row.organization_id
    and orders.id = link_row.service_order_id
    and organization.third_party_pickup_enabled
  for update of orders;

  if order_row.id is null or order_row.status <> 'Pronto para entrega' then
    raise exception 'A autorização está indisponível para esta ordem de serviço.';
  end if;
  if order_row.third_party_pickup_blocked then
    raise exception 'A retirada por terceiros está bloqueada nesta ordem de serviço.';
  end if;
  if length(btrim(coalesce(p_authorized_name, ''))) not between 3 and 120 then
    raise exception 'Informe o nome completo da pessoa autorizada.';
  end if;
  if not private.is_valid_cpf(cpf_digits) then
    raise exception 'Informe um CPF válido.';
  end if;
  if channel not in ('whatsapp', 'email') then
    raise exception 'Selecione um canal de confirmação válido.';
  end if;

  select client.* into client_row
  from public.clients client
  where client.organization_id = order_row.organization_id
    and client.id = order_row.client_id;

  if channel = 'email' then
    if client_row.email is null or position('@' in client_row.email) < 2 then
      raise exception 'O cliente não possui e-mail cadastrado.';
    end if;
    contact_mask := left(split_part(client_row.email, '@', 1), 2) || '***@' || split_part(client_row.email, '@', 2);
  else
    if length(regexp_replace(client_row.phone, '[^0-9]', '', 'g')) < 10 then
      raise exception 'O cliente não possui telefone válido cadastrado.';
    end if;
    contact_mask := '(**) *****-' || right(regexp_replace(client_row.phone, '[^0-9]', '', 'g'), 4);
  end if;

  select authz.* into active_row
  from public.service_order_pickup_authorizations authz
  where authz.organization_id = order_row.organization_id
    and authz.service_order_id = order_row.id
    and authz.status in ('requested', 'confirmed')
  limit 1
  for update;

  if active_row.status = 'confirmed' then
    raise exception 'Já existe uma autorização confirmada para esta ordem.';
  end if;
  if active_row.status = 'requested' and active_row.requested_at > now() - interval '60 seconds' then
    raise exception 'Aguarde um minuto antes de solicitar outro código.';
  end if;
  if active_row.id is not null then
    delete from private.pickup_authorization_codes where authorization_id = active_row.id;
    update public.service_order_pickup_authorizations
    set status = 'cancelled', cancelled_at = now(), cancellation_reason = 'Substituída por uma nova solicitação.'
    where id = active_row.id;
  end if;

  verification_code := lpad((((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text), 6, '0');

  insert into public.service_order_pickup_authorizations (
    organization_id, service_order_id, authorized_name, cpf_hash, cpf_last4,
    delivery_channel, contact_mask, code_expires_at
  ) values (
    order_row.organization_id, order_row.id, btrim(p_authorized_name),
    encode(digest(cpf_digits, 'sha256'), 'hex'), right(cpf_digits, 4),
    channel, contact_mask, now() + interval '10 minutes'
  ) returning * into authorization_row;

  insert into private.pickup_authorization_codes (authorization_id, code_hash, verification_code)
  values (authorization_row.id, encode(digest(verification_code, 'sha256'), 'hex'), verification_code);

  insert into public.service_order_events (
    organization_id, service_order_id, event_type, description, metadata
  ) values (
    order_row.organization_id, order_row.id, 'note',
    'Solicitação de autorização de retirada criada pelo cliente.',
    jsonb_build_object('pickup_authorization_id', authorization_row.id, 'delivery_channel', channel)
  );

  return jsonb_build_object(
    'id', authorization_row.id,
    'status', authorization_row.status,
    'authorized_name', authorization_row.authorized_name,
    'cpf_last4', authorization_row.cpf_last4,
    'delivery_channel', authorization_row.delivery_channel,
    'contact_mask', authorization_row.contact_mask,
    'code_expires_at', authorization_row.code_expires_at,
    'verification_attempts', authorization_row.verification_attempts
  );
end;
$$;

create or replace function private.verify_pickup_authorization(p_token_hash text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  link_row public.service_order_portal_links;
  authorization_row public.service_order_pickup_authorizations;
  code_row private.pickup_authorization_codes;
  next_attempts integer;
begin
  select link.* into link_row
  from public.service_order_portal_links link
  where link.token_hash = nullif(btrim(p_token_hash), '')
    and link.revoked_at is null
    and (link.expires_at is null or link.expires_at > now())
  limit 1;
  if link_row.id is null then raise exception 'Este link de acompanhamento é inválido ou expirou.'; end if;
  if coalesce(p_code, '') !~ '^[0-9]{6}$' then raise exception 'Informe o código de seis dígitos.'; end if;

  select authz.* into authorization_row
  from public.service_order_pickup_authorizations authz
  where authz.organization_id = link_row.organization_id
    and authz.service_order_id = link_row.service_order_id
    and authz.status = 'requested'
  limit 1 for update;
  if authorization_row.id is null then raise exception 'Não há autorização aguardando confirmação.'; end if;

  if authorization_row.code_expires_at <= now() then
    update public.service_order_pickup_authorizations
    set status = 'expired', cancellation_reason = 'Código de confirmação expirado.'
    where id = authorization_row.id;
    delete from private.pickup_authorization_codes where authorization_id = authorization_row.id;
    return jsonb_build_object('verified', false, 'expired', true, 'attempts_remaining', 0);
  end if;

  select code.* into code_row from private.pickup_authorization_codes code
  where code.authorization_id = authorization_row.id;
  if code_row.authorization_id is null then raise exception 'O código de confirmação não está mais disponível.'; end if;

  if code_row.code_hash <> encode(digest(p_code, 'sha256'), 'hex') then
    next_attempts := authorization_row.verification_attempts + 1;
    update public.service_order_pickup_authorizations
    set verification_attempts = next_attempts,
        status = case when next_attempts >= 3 then 'cancelled' else status end,
        cancelled_at = case when next_attempts >= 3 then now() else cancelled_at end,
        cancellation_reason = case when next_attempts >= 3 then 'Limite de tentativas excedido.' else cancellation_reason end
    where id = authorization_row.id;
    if next_attempts >= 3 then
      delete from private.pickup_authorization_codes where authorization_id = authorization_row.id;
    end if;
    return jsonb_build_object('verified', false, 'expired', false, 'attempts_remaining', greatest(3 - next_attempts, 0));
  end if;

  update public.service_order_pickup_authorizations
  set status = 'confirmed', confirmed_at = now(), expires_at = now() + interval '7 days'
  where id = authorization_row.id
  returning * into authorization_row;
  delete from private.pickup_authorization_codes where authorization_id = authorization_row.id;

  insert into public.service_order_events (organization_id, service_order_id, event_type, description, metadata)
  values (authorization_row.organization_id, authorization_row.service_order_id, 'note',
    'Autorização de retirada por terceiro confirmada pelo cliente.',
    jsonb_build_object('pickup_authorization_id', authorization_row.id));

  return jsonb_build_object(
    'verified', true,
    'id', authorization_row.id,
    'status', authorization_row.status,
    'authorized_name', authorization_row.authorized_name,
    'cpf_last4', authorization_row.cpf_last4,
    'confirmed_at', authorization_row.confirmed_at,
    'expires_at', authorization_row.expires_at
  );
end;
$$;

create or replace function private.cancel_pickup_authorization_from_portal(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_row public.service_order_portal_links;
  authorization_row public.service_order_pickup_authorizations;
begin
  select link.* into link_row from public.service_order_portal_links link
  where link.token_hash = nullif(btrim(p_token_hash), '') and link.revoked_at is null
    and (link.expires_at is null or link.expires_at > now()) limit 1;
  if link_row.id is null then raise exception 'Este link de acompanhamento é inválido ou expirou.'; end if;
  select authz.* into authorization_row
  from public.service_order_pickup_authorizations authz
  where authz.organization_id = link_row.organization_id
    and authz.service_order_id = link_row.service_order_id
    and authz.status in ('requested', 'confirmed')
  limit 1 for update;
  if authorization_row.id is null then return false; end if;
  delete from private.pickup_authorization_codes where authorization_id = authorization_row.id;
  update public.service_order_pickup_authorizations
  set status = 'cancelled', cancelled_at = now(), cancellation_reason = 'Cancelada pelo cliente.'
  where id = authorization_row.id;
  insert into public.service_order_events (organization_id, service_order_id, event_type, description, metadata)
  values (authorization_row.organization_id, authorization_row.service_order_id, 'note',
    'Autorização de retirada por terceiro cancelada pelo cliente.',
    jsonb_build_object('pickup_authorization_id', authorization_row.id));
  return true;
end;
$$;

revoke all on function private.request_pickup_authorization(text, text, text, text) from public, authenticated;
revoke all on function private.verify_pickup_authorization(text, text) from public, authenticated;
revoke all on function private.cancel_pickup_authorization_from_portal(text) from public, authenticated;
grant execute on function private.request_pickup_authorization(text, text, text, text) to anon;
grant execute on function private.verify_pickup_authorization(text, text) to anon;
grant execute on function private.cancel_pickup_authorization_from_portal(text) to anon;

create or replace function public.request_pickup_authorization(p_token_hash text, p_authorized_name text, p_cpf text, p_delivery_channel text)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.request_pickup_authorization(p_token_hash, p_authorized_name, p_cpf, p_delivery_channel);
$$;
create or replace function public.verify_pickup_authorization(p_token_hash text, p_code text)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.verify_pickup_authorization(p_token_hash, p_code);
$$;
create or replace function public.cancel_pickup_authorization_from_portal(p_token_hash text)
returns boolean language sql security invoker set search_path = '' as $$
  select private.cancel_pickup_authorization_from_portal(p_token_hash);
$$;

revoke all on function public.request_pickup_authorization(text, text, text, text) from public, authenticated;
revoke all on function public.verify_pickup_authorization(text, text) from public, authenticated;
revoke all on function public.cancel_pickup_authorization_from_portal(text) from public, authenticated;
grant execute on function public.request_pickup_authorization(text, text, text, text) to anon;
grant execute on function public.verify_pickup_authorization(text, text) to anon;
grant execute on function public.cancel_pickup_authorization_from_portal(text) to anon;

create or replace function private.get_pickup_authorization_for_staff(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  order_row public.service_orders;
  authorization_row public.service_order_pickup_authorizations;
  verification_code text;
  feature_enabled boolean;
begin
  select orders.* into order_row from public.service_orders orders where orders.id = p_order_id;
  if order_row.id is null then raise exception 'Ordem de serviço não encontrada.'; end if;
  if not private.has_org_role(order_row.organization_id, actor, array['gestor', 'atendimento', 'tecnico']::public.member_role[]) then
    raise exception 'Você não tem permissão para consultar esta autorização.';
  end if;
  select organization.third_party_pickup_enabled into feature_enabled
  from public.organizations organization where organization.id = order_row.organization_id;
  select authz.* into authorization_row
  from public.service_order_pickup_authorizations authz
  where authz.organization_id = order_row.organization_id
    and authz.service_order_id = order_row.id
  order by authz.requested_at desc limit 1;
  if authorization_row.status = 'requested' and authorization_row.code_expires_at > now()
     and private.has_org_role(order_row.organization_id, actor, array['gestor', 'atendimento']::public.member_role[]) then
    select code.verification_code into verification_code from private.pickup_authorization_codes code
    where code.authorization_id = authorization_row.id;
  end if;
  return jsonb_build_object(
    'feature_enabled', coalesce(feature_enabled, false),
    'order_blocked', order_row.third_party_pickup_blocked,
    'order_status', order_row.status,
    'can_manage', private.has_org_role(order_row.organization_id, actor, array['gestor', 'atendimento']::public.member_role[]),
    'is_manager', private.has_org_role(order_row.organization_id, actor, array['gestor']::public.member_role[]),
    'authorization', case when authorization_row.id is null then null else jsonb_build_object(
      'id', authorization_row.id, 'status', authorization_row.status,
      'authorized_name', authorization_row.authorized_name, 'cpf_last4', authorization_row.cpf_last4,
      'delivery_channel', authorization_row.delivery_channel, 'contact_mask', authorization_row.contact_mask,
      'verification_attempts', authorization_row.verification_attempts,
      'verification_code', verification_code, 'code_expires_at', authorization_row.code_expires_at,
      'confirmed_at', authorization_row.confirmed_at, 'expires_at', authorization_row.expires_at,
      'cancelled_at', authorization_row.cancelled_at, 'cancellation_reason', authorization_row.cancellation_reason,
      'collected_at', authorization_row.collected_at
    ) end
  );
end;
$$;

create or replace function public.get_pickup_authorization_for_staff(p_order_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.get_pickup_authorization_for_staff(p_order_id);
$$;

create or replace function private.set_service_order_pickup_blocked(p_order_id uuid, p_blocked boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); order_row public.service_orders;
begin
  select orders.* into order_row from public.service_orders orders where orders.id = p_order_id for update;
  if order_row.id is null then raise exception 'Ordem de serviço não encontrada.'; end if;
  if not private.has_org_role(order_row.organization_id, actor, array['gestor']::public.member_role[]) then
    raise exception 'Apenas gestores podem alterar o bloqueio desta ordem.';
  end if;
  if p_blocked and not order_row.third_party_pickup_blocked then
    delete from private.pickup_authorization_codes where authorization_id in (
      select id from public.service_order_pickup_authorizations
      where organization_id = order_row.organization_id and service_order_id = order_row.id
        and status in ('requested', 'confirmed')
    );
    update public.service_order_pickup_authorizations
    set status = 'cancelled', cancelled_at = now(), cancellation_reason = 'Recurso bloqueado nesta ordem pela assistência.'
    where organization_id = order_row.organization_id and service_order_id = order_row.id
      and status in ('requested', 'confirmed');
  end if;
  update public.service_orders set third_party_pickup_blocked = p_blocked where id = order_row.id;
  if order_row.third_party_pickup_blocked is distinct from p_blocked then
    insert into public.service_order_events (organization_id, service_order_id, event_type, description, actor_id, metadata)
    values (order_row.organization_id, order_row.id, 'note',
      case when p_blocked then 'Retirada por terceiros bloqueada nesta OS.' else 'Retirada por terceiros liberada nesta OS.' end,
      actor, jsonb_build_object('third_party_pickup_blocked', p_blocked));
  end if;
  return jsonb_build_object('order_blocked', p_blocked);
end;
$$;

create or replace function private.cancel_pickup_authorization_for_staff(p_order_id uuid, p_reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); order_row public.service_orders; authorization_row public.service_order_pickup_authorizations;
begin
  select orders.* into order_row from public.service_orders orders where orders.id = p_order_id;
  if order_row.id is null then raise exception 'Ordem de serviço não encontrada.'; end if;
  if not private.has_org_role(order_row.organization_id, actor, array['gestor', 'atendimento']::public.member_role[]) then
    raise exception 'Você não tem permissão para cancelar esta autorização.';
  end if;
  select authz.* into authorization_row from public.service_order_pickup_authorizations authz
  where authz.organization_id = order_row.organization_id and authz.service_order_id = order_row.id
    and authz.status in ('requested', 'confirmed') limit 1 for update;
  if authorization_row.id is null then return false; end if;
  delete from private.pickup_authorization_codes where authorization_id = authorization_row.id;
  update public.service_order_pickup_authorizations set status = 'cancelled', cancelled_at = now(),
    cancellation_reason = coalesce(nullif(btrim(p_reason), ''), 'Cancelada pela assistência.') where id = authorization_row.id;
  insert into public.service_order_events (organization_id, service_order_id, event_type, description, actor_id, metadata)
  values (order_row.organization_id, order_row.id, 'note', 'Autorização de retirada cancelada pela assistência.', actor,
    jsonb_build_object('pickup_authorization_id', authorization_row.id));
  return true;
end;
$$;

create or replace function private.collect_pickup_authorization(p_order_id uuid, p_cpf text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, extensions as $$
declare actor uuid := (select auth.uid()); order_row public.service_orders; authorization_row public.service_order_pickup_authorizations;
  cpf_digits text := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g'); feature_enabled boolean;
begin
  select orders.* into order_row from public.service_orders orders where orders.id = p_order_id for update;
  if order_row.id is null then raise exception 'Ordem de serviço não encontrada.'; end if;
  if not private.has_org_role(order_row.organization_id, actor, array['gestor', 'atendimento']::public.member_role[]) then
    raise exception 'Você não tem permissão para registrar a retirada.';
  end if;
  select organization.third_party_pickup_enabled into feature_enabled from public.organizations organization where organization.id = order_row.organization_id;
  if not feature_enabled or order_row.third_party_pickup_blocked or order_row.status <> 'Pronto para entrega' then
    raise exception 'A retirada por terceiros está indisponível para esta ordem.';
  end if;
  select authz.* into authorization_row from public.service_order_pickup_authorizations authz
  where authz.organization_id = order_row.organization_id and authz.service_order_id = order_row.id
    and authz.status = 'confirmed' limit 1 for update;
  if authorization_row.id is null then raise exception 'Não há autorização confirmada para esta ordem.'; end if;
  if authorization_row.expires_at <= now() then
    update public.service_order_pickup_authorizations set status = 'expired', cancellation_reason = 'Autorização expirada.' where id = authorization_row.id;
    raise exception 'A autorização expirou.';
  end if;
  if authorization_row.cpf_hash <> encode(digest(cpf_digits, 'sha256'), 'hex') then
    raise exception 'O CPF apresentado não corresponde à autorização.';
  end if;
  update public.service_order_pickup_authorizations set status = 'collected', collected_at = now(), collected_by = actor
  where id = authorization_row.id returning * into authorization_row;
  update public.service_orders set status = 'Concluído' where id = order_row.id;
  insert into public.service_order_events (organization_id, service_order_id, event_type, description, actor_id, metadata)
  values (order_row.organization_id, order_row.id, 'note', 'Equipamento retirado pela pessoa autorizada.', actor,
    jsonb_build_object('pickup_authorization_id', authorization_row.id, 'authorized_name', authorization_row.authorized_name));
  insert into public.service_order_events (organization_id, service_order_id, event_type, from_status, to_status, description, actor_id, metadata)
  values (order_row.organization_id, order_row.id, 'status_changed', order_row.status, 'Concluído', 'Atendimento concluído após retirada autorizada.', actor,
    jsonb_build_object('from', order_row.status, 'to', 'Concluído', 'pickup_authorization_id', authorization_row.id));
  return jsonb_build_object('status', authorization_row.status, 'collected_at', authorization_row.collected_at,
    'authorized_name', authorization_row.authorized_name, 'order_status', 'Concluído');
end;
$$;

revoke all on function private.get_pickup_authorization_for_staff(uuid) from public, anon;
revoke all on function private.set_service_order_pickup_blocked(uuid, boolean) from public, anon;
revoke all on function private.cancel_pickup_authorization_for_staff(uuid, text) from public, anon;
revoke all on function private.collect_pickup_authorization(uuid, text) from public, anon;
grant execute on function private.get_pickup_authorization_for_staff(uuid) to authenticated;
grant execute on function private.set_service_order_pickup_blocked(uuid, boolean) to authenticated;
grant execute on function private.cancel_pickup_authorization_for_staff(uuid, text) to authenticated;
grant execute on function private.collect_pickup_authorization(uuid, text) to authenticated;

create or replace function public.set_service_order_pickup_blocked(p_order_id uuid, p_blocked boolean)
returns jsonb language sql security invoker set search_path = '' as $$ select private.set_service_order_pickup_blocked(p_order_id, p_blocked); $$;
create or replace function public.cancel_pickup_authorization_for_staff(p_order_id uuid, p_reason text)
returns boolean language sql security invoker set search_path = '' as $$ select private.cancel_pickup_authorization_for_staff(p_order_id, p_reason); $$;
create or replace function public.collect_pickup_authorization(p_order_id uuid, p_cpf text)
returns jsonb language sql security invoker set search_path = '' as $$ select private.collect_pickup_authorization(p_order_id, p_cpf); $$;

revoke all on function public.get_pickup_authorization_for_staff(uuid) from public, anon;
revoke all on function public.set_service_order_pickup_blocked(uuid, boolean) from public, anon;
revoke all on function public.cancel_pickup_authorization_for_staff(uuid, text) from public, anon;
revoke all on function public.collect_pickup_authorization(uuid, text) from public, anon;
grant execute on function public.get_pickup_authorization_for_staff(uuid) to authenticated;
grant execute on function public.set_service_order_pickup_blocked(uuid, boolean) to authenticated;
grant execute on function public.cancel_pickup_authorization_for_staff(uuid, text) to authenticated;
grant execute on function public.collect_pickup_authorization(uuid, text) to authenticated;

alter function private.get_service_order_portal_details(text)
rename to get_service_order_portal_details_base;
revoke all on function private.get_service_order_portal_details_base(text) from public, anon, authenticated;

create or replace function private.get_service_order_portal_details(p_token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare base_payload jsonb; link_row public.service_order_portal_links; pickup_payload jsonb; pickup_available boolean;
begin
  base_payload := private.get_service_order_portal_details_base(p_token_hash);
  if base_payload is null then return null; end if;
  select link.* into link_row from public.service_order_portal_links link
  where link.token_hash = nullif(btrim(p_token_hash), '') and link.revoked_at is null
    and (link.expires_at is null or link.expires_at > now()) limit 1;
  select organization.third_party_pickup_enabled and not orders.third_party_pickup_blocked and orders.status = 'Pronto para entrega',
    (select jsonb_build_object(
      'id', authz.id, 'status', authz.status, 'authorized_name', authz.authorized_name,
      'cpf_last4', authz.cpf_last4, 'delivery_channel', authz.delivery_channel,
      'contact_mask', authz.contact_mask, 'verification_attempts', authz.verification_attempts,
      'code_expires_at', authz.code_expires_at, 'confirmed_at', authz.confirmed_at,
      'expires_at', authz.expires_at, 'cancelled_at', authz.cancelled_at,
      'cancellation_reason', authz.cancellation_reason, 'collected_at', authz.collected_at
    ) from public.service_order_pickup_authorizations authz
      where authz.organization_id = orders.organization_id and authz.service_order_id = orders.id
      order by authz.requested_at desc limit 1)
  into pickup_available, pickup_payload
  from public.service_orders orders join public.organizations organization on organization.id = orders.organization_id
  where orders.organization_id = link_row.organization_id and orders.id = link_row.service_order_id;
  return base_payload || jsonb_build_object('third_party_pickup_available', coalesce(pickup_available, false),
    'pickup_authorization', pickup_payload);
end;
$$;

revoke all on function private.get_service_order_portal_details(text) from public, authenticated;
grant execute on function private.get_service_order_portal_details(text) to anon;

create or replace function private.set_third_party_pickup_enabled(p_organization_id uuid, p_enabled boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); previous_value boolean;
begin
  if actor is null then raise exception 'Authentication is required.'; end if;
  if not private.is_active_manager(p_organization_id, actor) then raise exception 'Apenas gestores podem alterar esta configuração.'; end if;
  select organization.third_party_pickup_enabled into previous_value from public.organizations organization
  where organization.id = p_organization_id for update;
  if not found then raise exception 'Organização não encontrada.'; end if;
  if not p_enabled and previous_value then
    insert into public.service_order_events (organization_id, service_order_id, event_type, description, actor_id, metadata)
    select authz.organization_id, authz.service_order_id, 'note',
      'Autorização de retirada cancelada porque o recurso foi desativado.', actor,
      jsonb_build_object('pickup_authorization_id', authz.id)
    from public.service_order_pickup_authorizations authz
    where authz.organization_id = p_organization_id and authz.status in ('requested', 'confirmed');
    delete from private.pickup_authorization_codes where authorization_id in (
      select id from public.service_order_pickup_authorizations
      where organization_id = p_organization_id and status in ('requested', 'confirmed')
    );
    update public.service_order_pickup_authorizations set status = 'cancelled', cancelled_at = now(),
      cancellation_reason = 'Recurso desativado pela assistência.'
    where organization_id = p_organization_id and status in ('requested', 'confirmed');
  end if;
  update public.organizations set third_party_pickup_enabled = p_enabled where id = p_organization_id;
  if previous_value is distinct from p_enabled then
    insert into public.audit_log (organization_id, actor_id, action, entity_type, entity_id, metadata)
    values (p_organization_id, actor, case when p_enabled then 'third_party_pickup_enabled' else 'third_party_pickup_disabled' end,
      'organization_setting', p_organization_id,
      jsonb_build_object('setting', 'third_party_pickup_enabled', 'previous_value', previous_value, 'new_value', p_enabled));
  end if;
  return jsonb_build_object('third_party_pickup_enabled', p_enabled, 'changed', previous_value is distinct from p_enabled);
end;
$$;

commit;
