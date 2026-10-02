create or replace function public.return_service_order(p_order_id uuid, p_reason text)
returns public.service_orders language plpgsql security invoker set search_path = '' as $$
declare
  current_order public.service_orders;
  previous_status public.service_order_status;
  latest_quote public.quotes;
  new_quote_id uuid;
  actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'Authentication is required'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'Informe o motivo da volta (mínimo de 5 caracteres).'; end if;
  select * into current_order from public.service_orders where id = p_order_id for update;
  if current_order.id is null then raise exception 'Service order not found'; end if;
  if not private.has_org_role(current_order.organization_id, actor, array['gestor', 'atendimento', 'tecnico']::public.member_role[]) then
    raise exception 'Sem permissão para alterar esta OS.';
  end if;
  previous_status := case current_order.status
    when 'Diagnóstico' then 'Recebido'::public.service_order_status
    when 'Aguardando aprovação' then 'Diagnóstico'::public.service_order_status
    when 'Em execução' then 'Aguardando aprovação'::public.service_order_status
    when 'Em testes' then 'Em execução'::public.service_order_status
    when 'Pronto para entrega' then 'Em testes'::public.service_order_status
    when 'Concluído' then case when current_order.mode = 'Balcão' then 'Pronto para entrega'::public.service_order_status else 'Em testes'::public.service_order_status end
    else null
  end;
  if previous_status is null then raise exception 'Esta OS já está na primeira etapa.'; end if;

  if current_order.status = 'Aguardando aprovação' then
    select * into latest_quote from public.quotes where organization_id = current_order.organization_id and service_order_id = current_order.id order by version desc limit 1 for update;
    if latest_quote.id is not null and latest_quote.status in ('sent', 'approved') then
      if not private.has_org_role(current_order.organization_id, actor, array['gestor', 'atendimento']::public.member_role[]) then
        raise exception 'Somente gestão ou atendimento pode refazer uma proposta enviada.';
      end if;
      if current_order.paid_cents > 0 then raise exception 'Há pagamentos nesta OS. Ajuste o financeiro antes de refazer a proposta.'; end if;
      update public.quote_portal_links set revoked_at = now() where organization_id = current_order.organization_id and quote_id = latest_quote.id and revoked_at is null;
      if latest_quote.status = 'sent' then
        update public.quotes set status = 'expired' where id = latest_quote.id;
      end if;
      insert into public.quotes (organization_id, service_order_id, version, status, valid_until, notes, subtotal_cents, discount_cents, total_cents, created_by)
      values (current_order.organization_id, current_order.id, latest_quote.version + 1, 'draft', latest_quote.valid_until, latest_quote.notes, latest_quote.subtotal_cents, latest_quote.discount_cents, latest_quote.total_cents, actor)
      returning id into new_quote_id;
      insert into public.quote_items (organization_id, quote_id, description, quantity, unit_price_cents, total_cents, position)
      select organization_id, new_quote_id, description, quantity, unit_price_cents, total_cents, position
      from public.quote_items where organization_id = current_order.organization_id and quote_id = latest_quote.id;
    end if;
  end if;

  update public.service_orders set status = previous_status,
    amount_cents = case when new_quote_id is not null then 0 else amount_cents end
  where id = p_order_id;
  insert into public.service_order_events (organization_id, service_order_id, event_type, from_status, to_status, description, actor_id, metadata)
  values (current_order.organization_id, current_order.id, 'status_changed', current_order.status, previous_status,
    format('Etapa retornada para %s. Motivo: %s', previous_status, btrim(p_reason)), actor,
    jsonb_build_object('direction', 'backward', 'reason', btrim(p_reason), 'new_quote_id', new_quote_id));
  select * into current_order from public.service_orders where id = p_order_id;
  return current_order;
end;
$$;
revoke all on function public.return_service_order(uuid, text) from public, anon;
grant execute on function public.return_service_order(uuid, text) to authenticated;

create or replace function public.edit_service_order(p_order_id uuid, p_issue text, p_priority text, p_due_date date, p_accessories text, p_device_id uuid)
returns public.service_orders language plpgsql security invoker set search_path = '' as $$
declare
  current_order public.service_orders;
  actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'Authentication is required'; end if;
  select * into current_order from public.service_orders where id = p_order_id for update;
  if current_order.id is null then raise exception 'Service order not found'; end if;
  if not private.has_org_role(current_order.organization_id, actor, array['gestor', 'atendimento', 'tecnico']::public.member_role[]) then raise exception 'Sem permissão para editar esta OS.'; end if;
  if current_order.status not in ('Recebido', 'Diagnóstico') then raise exception 'Volte à etapa de diagnóstico para editar a solicitação.'; end if;
  if length(btrim(coalesce(p_issue, ''))) < 8 then raise exception 'Descreva o problema em pelo menos 8 caracteres.'; end if;
  if p_priority not in ('Normal', 'Alta', 'Urgente') then raise exception 'Prioridade inválida.'; end if;
  if p_device_id is not null and not exists (select 1 from public.devices where id = p_device_id and organization_id = current_order.organization_id and client_id = current_order.client_id) then raise exception 'O equipamento deve pertencer ao cliente desta OS.'; end if;
  if exists (select 1 from public.quotes where organization_id = current_order.organization_id and service_order_id = current_order.id and status in ('sent', 'approved') and version = (select max(version) from public.quotes where organization_id = current_order.organization_id and service_order_id = current_order.id)) then raise exception 'Volte à etapa de diagnóstico para gerar uma nova versão da proposta.'; end if;
  update public.service_orders set issue = btrim(p_issue), priority = p_priority, due_date = p_due_date, accessories = nullif(btrim(p_accessories), ''), device_id = p_device_id where id = p_order_id;
  insert into public.service_order_events (organization_id, service_order_id, event_type, description, actor_id, metadata)
  values (current_order.organization_id, current_order.id, 'note', 'Dados da solicitação editados.', actor,
    jsonb_build_object('old_issue', current_order.issue, 'new_issue', btrim(p_issue), 'old_device_id', current_order.device_id, 'new_device_id', p_device_id));
  select * into current_order from public.service_orders where id = p_order_id;
  return current_order;
end;
$$;
revoke all on function public.edit_service_order(uuid, text, text, date, text, uuid) from public, anon;
grant execute on function public.edit_service_order(uuid, text, text, date, text, uuid) to authenticated;
