alter table public.product_sales drop constraint if exists product_sales_status_check;
alter table public.product_sales add constraint product_sales_status_check check (status in ('confirmed','returned','cancelled'));

-- Cancellation is a distinct, auditable operation. It restores stock and records
-- a negative payment entry when the sale had already received money.
create or replace function private.cancel_product_sale(org uuid, branch uuid, request uuid, data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid := auth.uid();
 member public.member_role;
 operation public.stock_operations;
 sale public.product_sales;
 item jsonb;
 source uuid := gen_random_uuid();
 reason text := btrim(coalesce(data->>'reason',''));
begin
 if actor is null then raise exception 'Faça login para continuar.'; end if;
 select role into member from public.unit_memberships
  where organization_id=org and unit_id=branch and user_id=actor and is_active;
 if member is null or member not in ('gestor','atendimento') then
  raise exception 'Somente gestão ou atendimento pode cancelar vendas.';
 end if;
 perform 1 from public.units where id=branch and organization_id=org and is_active for update;
 if not found then raise exception 'Unidade inativa.'; end if;
 if request is null then raise exception 'Identificador da operação obrigatório.'; end if;
 if length(reason)<5 then raise exception 'Informe o motivo do cancelamento.'; end if;
 select * into operation from public.stock_operations where organization_id=org and request_id=request;
 if operation.id is not null then
  if operation.unit_id<>branch or operation.action<>'cancel_sale' or operation.payload<>data then
   raise exception 'Identificador reutilizado com dados diferentes.';
  end if;
  return operation.result;
 end if;
 insert into public.stock_operations(organization_id,unit_id,request_id,action,payload,actor_id)
  values(org,branch,request,'cancel_sale',data,actor) returning * into operation;
 select * into sale from public.product_sales
  where organization_id=org and unit_id=branch and id=(data->>'sale_id')::uuid for update;
 if sale.id is null or sale.status<>'confirmed' then raise exception 'Venda não encontrada ou já cancelada.'; end if;
 for item in select to_jsonb(i) from public.product_sale_items i where organization_id=org and sale_id=sale.id loop
  perform private.move_stock(org,branch,(item->>'product_id')::uuid,(item->>'quantity')::numeric,0,'return','Cancelamento de venda: '||reason,sale.id);
 end loop;
 if sale.paid_cents>0 then
  insert into public.product_sale_payments(organization_id,sale_id,amount_cents,method,actor_id)
   values(org,sale.id,-sale.paid_cents,'outro',actor);
 end if;
 update public.product_sales set status='cancelled',paid_cents=0,note=left(note||E'\nCancelamento: '||reason,2000) where id=sale.id;
 update public.stock_operations set result=jsonb_build_object('id',sale.id) where id=operation.id;
 return jsonb_build_object('id',sale.id);
end $$;

revoke all on function private.cancel_product_sale(uuid,uuid,uuid,jsonb) from public,anon,authenticated;

create or replace function public.cancel_product_sale(p_organization_id uuid,p_unit_id uuid,p_request_id uuid,p_data jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select private.cancel_product_sale(p_organization_id,p_unit_id,p_request_id,p_data);
$$;
revoke all on function public.cancel_product_sale(uuid,uuid,uuid,jsonb) from public,anon;
grant execute on function public.cancel_product_sale(uuid,uuid,uuid,jsonb) to authenticated;
