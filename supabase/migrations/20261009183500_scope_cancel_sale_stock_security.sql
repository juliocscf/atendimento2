-- Keep the stock-security fix limited to direct-sale cancellation.
create or replace function private.cancel_product_sale(org uuid, branch uuid, request uuid, data jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
 actor uuid := auth.uid();
 member public.member_role;
 operation public.stock_operations;
 sale public.product_sales;
 item jsonb;
 v_product_id uuid;
 v_quantity numeric;
 reason text := btrim(coalesce(data->>'reason',''));
begin
 if actor is null then raise exception 'Faça login para continuar.'; end if;
 select um.role into member from public.unit_memberships um
  where um.organization_id=org and um.unit_id=branch and um.user_id=actor and um.is_active;
 if member is null or member not in ('gestor','atendimento') then
  raise exception 'Somente gestão ou atendimento pode cancelar vendas.';
 end if;
 perform 1 from public.units u where u.id=branch and u.organization_id=org and u.is_active for update;
 if not found then raise exception 'Unidade inativa.'; end if;
 if request is null then raise exception 'Identificador da operação obrigatório.'; end if;
 if length(reason)<5 then raise exception 'Informe o motivo do cancelamento.'; end if;
 select so.* into operation from public.stock_operations so
  where so.organization_id=org and so.request_id=request;
 if operation.id is not null then
  if operation.unit_id<>branch or operation.action<>'cancel_sale' or operation.payload<>data then
   raise exception 'Identificador reutilizado com dados diferentes.';
  end if;
  return operation.result;
 end if;
 insert into public.stock_operations(organization_id,unit_id,request_id,action,payload,actor_id)
  values(org,branch,request,'cancel_sale',data,actor) returning * into operation;
 select ps.* into sale from public.product_sales ps
  where ps.organization_id=org and ps.unit_id=branch and ps.id=(data->>'sale_id')::uuid for update;
 if sale.id is null or sale.status<>'confirmed' then
  raise exception 'Venda não encontrada ou já cancelada.';
 end if;
 for item in select to_jsonb(i) from public.product_sale_items i
  where i.organization_id=org and i.sale_id=sale.id loop
  v_product_id := (item->>'product_id')::uuid;
  v_quantity := (item->>'quantity')::numeric;
  insert into public.stock_balances(organization_id,unit_id,product_id)
   values(org,branch,v_product_id) on conflict do nothing;
  update public.stock_balances sb set quantity=sb.quantity+v_quantity
   where sb.organization_id=org and sb.unit_id=branch and sb.product_id=v_product_id
    and sb.quantity+v_quantity>=0 and sb.reserved<=sb.quantity+v_quantity;
  if not found then raise exception 'Não foi possível devolver a peça ao estoque.'; end if;
  insert into public.stock_movements(organization_id,unit_id,product_id,quantity_delta,reserved_delta,kind,reason,source_id,actor_id)
   values(org,branch,v_product_id,v_quantity,0,'return','Cancelamento de venda: '||reason,sale.id,actor);
 end loop;
 if sale.paid_cents>0 then
  insert into public.product_sale_payments(organization_id,sale_id,amount_cents,method,actor_id)
   values(org,sale.id,-sale.paid_cents,'outro',actor);
 end if;
 update public.product_sales set status='cancelled',paid_cents=0,note=left(note||E'\nCancelamento: '||reason,2000)
  where id=sale.id;
 update public.stock_operations set result=jsonb_build_object('id',sale.id) where id=operation.id;
 return jsonb_build_object('id',sale.id);
end
$$;
revoke all on function private.cancel_product_sale(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
notify pgrst, 'reload schema';
