begin;

alter table public.quotes
  add column approval_method text,
  add column approved_customer_name text,
  add column approval_note text,
  add column approval_evidence_url text;

alter table public.quotes
  add constraint quotes_approval_method_check
    check (approval_method is null or approval_method in ('presencial', 'telefone', 'whatsapp', 'email', 'outro')),
  add constraint quotes_approved_customer_name_check
    check (approved_customer_name is null or length(btrim(approved_customer_name)) between 3 and 120),
  add constraint quotes_approval_note_check
    check (approval_note is null or length(btrim(approval_note)) between 3 and 1000),
  add constraint quotes_approval_evidence_url_check
    check (approval_evidence_url is null or approval_evidence_url ~* '^https?://');

create or replace function public.register_manual_quote_approval(
  p_quote_id uuid,
  p_method text,
  p_customer_name text,
  p_note text default null,
  p_evidence_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  quote_row public.quotes;
  order_row public.service_orders;
  actor_role public.member_role;
  normalized_method text := lower(btrim(coalesce(p_method, '')));
  normalized_name text := btrim(coalesce(p_customer_name, ''));
  normalized_note text := nullif(btrim(coalesce(p_note, '')), '');
  normalized_evidence text := nullif(btrim(coalesce(p_evidence_url, '')), '');
  method_label text;
begin
  if actor is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;

  select * into quote_row
  from public.quotes
  where id = p_quote_id
  for update;

  if quote_row.id is null then
    raise exception 'Orçamento não encontrado.';
  end if;

  select * into order_row
  from public.service_orders
  where organization_id = quote_row.organization_id
    and id = quote_row.service_order_id
  for update;

  select membership.role into actor_role
  from public.unit_memberships membership
  where membership.organization_id = order_row.organization_id
    and membership.unit_id = order_row.unit_id
    and membership.user_id = actor
    and membership.is_active
  limit 1;

  if actor_role is null
     or (actor_role not in ('gestor', 'atendimento') and not (actor_role = 'tecnico' and order_row.assigned_to = actor)) then
    raise exception 'Somente gestores, atendimento ou o técnico responsável podem registrar esta autorização.' using errcode = '42501';
  end if;

  if quote_row.status <> 'sent' then
    raise exception 'Somente um orçamento enviado e ainda pendente pode ser autorizado pela equipe.';
  end if;

  if order_row.status <> 'Aguardando aprovação' then
    raise exception 'A OS precisa estar em Aguardando aprovação.';
  end if;

  if normalized_method not in ('presencial', 'telefone', 'whatsapp', 'email', 'outro') then
    raise exception 'Informe como o cliente autorizou o orçamento.';
  end if;

  if length(normalized_name) < 3 or length(normalized_name) > 120 then
    raise exception 'Informe o nome da pessoa que autorizou.';
  end if;

  if normalized_method in ('telefone', 'outro') and coalesce(length(normalized_note), 0) < 8 then
    raise exception 'Descreva brevemente como a autorização foi confirmada.';
  end if;

  if normalized_note is not null and (length(normalized_note) < 3 or length(normalized_note) > 1000) then
    raise exception 'A observação deve ter entre 3 e 1000 caracteres.';
  end if;

  if normalized_evidence is not null and normalized_evidence !~* '^https?://' then
    raise exception 'O link da evidência precisa começar com http:// ou https://.';
  end if;

  method_label := case normalized_method
    when 'presencial' then 'presencialmente'
    when 'telefone' then 'por telefone'
    when 'whatsapp' then 'por WhatsApp'
    when 'email' then 'por e-mail'
    else 'por outro meio'
  end;

  update public.quotes
  set status = 'approved',
      approved_at = now(),
      approved_by = actor,
      approval_channel = 'manual',
      approval_method = normalized_method,
      approved_customer_name = normalized_name,
      approval_note = normalized_note,
      approval_evidence_url = normalized_evidence
  where id = quote_row.id
  returning * into quote_row;

  insert into public.service_order_events (
    organization_id, service_order_id, event_type, description, actor_id, metadata
  ) values (
    order_row.organization_id,
    order_row.id,
    'note',
    format('Autorização do orçamento v%s registrada pela equipe: %s autorizou %s.', quote_row.version, normalized_name, method_label),
    actor,
    jsonb_strip_nulls(jsonb_build_object(
      'quote_id', quote_row.id,
      'quote_version', quote_row.version,
      'amount_cents', quote_row.total_cents,
      'approval_channel', 'manual',
      'approval_method', normalized_method,
      'approved_customer_name', normalized_name,
      'approval_note', normalized_note,
      'approval_evidence_url', normalized_evidence
    ))
  );

  insert into public.audit_log (
    organization_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    order_row.organization_id,
    actor,
    'quote.manual_approval_registered',
    'quote',
    quote_row.id,
    jsonb_strip_nulls(jsonb_build_object(
      'service_order_id', order_row.id,
      'quote_version', quote_row.version,
      'amount_cents', quote_row.total_cents,
      'approval_method', normalized_method,
      'approved_customer_name', normalized_name,
      'approval_note', normalized_note,
      'approval_evidence_url', normalized_evidence
    ))
  );

  return jsonb_build_object(
    'id', quote_row.id,
    'service_order_id', quote_row.service_order_id,
    'status', quote_row.status,
    'approved_at', quote_row.approved_at,
    'approval_channel', quote_row.approval_channel,
    'approval_method', quote_row.approval_method,
    'approved_customer_name', quote_row.approved_customer_name,
    'order_status', order_row.status
  );
end;
$$;

revoke all on function public.register_manual_quote_approval(uuid, text, text, text, text) from public, anon;
grant execute on function public.register_manual_quote_approval(uuid, text, text, text, text) to authenticated;

commit;
