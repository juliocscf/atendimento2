begin;

create or replace function public.send_quote_for_approval(p_quote_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  quote_row public.quotes;
  order_row public.service_orders;
begin
  if actor is null then raise exception 'Authentication is required.' using errcode='28000'; end if;
  select * into quote_row from public.quotes where id=p_quote_id for update;
  if quote_row.id is null then raise exception 'Quote not found.'; end if;
  select * into order_row from public.service_orders where organization_id=quote_row.organization_id and id=quote_row.service_order_id for update;
  if not private.has_org_role(order_row.organization_id,actor,array['gestor','atendimento','tecnico']::public.member_role[]) then raise exception 'You do not have permission.' using errcode='42501'; end if;
  if quote_row.status <> 'draft' then raise exception 'Somente um orçamento em rascunho pode ser enviado.'; end if;
  if order_row.status <> 'Diagnóstico' then raise exception 'A OS precisa estar em diagnóstico para enviar o orçamento.'; end if;
  if not exists(select 1 from public.quote_items where organization_id=quote_row.organization_id and quote_id=quote_row.id) then raise exception 'Inclua ao menos um item no orçamento.'; end if;
  update public.quotes set status='sent',sent_at=now() where id=quote_row.id returning * into quote_row;
  update public.service_orders set status='Aguardando aprovação' where id=order_row.id;
  insert into public.service_order_events(organization_id,service_order_id,event_type,from_status,to_status,description,actor_id,metadata)
  values(order_row.organization_id,order_row.id,'status_changed',order_row.status,'Aguardando aprovação','Orçamento enviado. Aguardando aprovação do cliente.',actor,jsonb_build_object('quote_id',quote_row.id,'quote_version',quote_row.version));
  return jsonb_build_object('id',quote_row.id,'service_order_id',quote_row.service_order_id,'version',quote_row.version,'status',quote_row.status,'sent_at',quote_row.sent_at,'total_cents',quote_row.total_cents,'order_status','Aguardando aprovação');
end;
$$;

revoke all on function public.send_quote_for_approval(uuid) from public, anon;
grant execute on function public.send_quote_for_approval(uuid) to authenticated;

with corrected as (
  update public.service_orders orders
  set status='Aguardando aprovação'
  where orders.status='Diagnóstico'
    and exists (
      select 1 from public.quotes quote
      where quote.organization_id=orders.organization_id
        and quote.service_order_id=orders.id
        and quote.status='sent'
        and exists (select 1 from public.quote_items item where item.organization_id=quote.organization_id and item.quote_id=quote.id)
    )
  returning orders.organization_id,orders.id
)
insert into public.service_order_events(organization_id,service_order_id,event_type,from_status,to_status,description,metadata)
select organization_id,id,'status_changed','Diagnóstico','Aguardando aprovação','Fluxo corrigido: orçamento já enviado e aguardando aprovação do cliente.',jsonb_build_object('source','quote_status_reconciliation')
from corrected;

commit;
