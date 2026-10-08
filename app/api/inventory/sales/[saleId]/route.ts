import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';
import { uuidPattern } from '@/lib/inventory';
export async function GET(_request: Request,{params}:{params:Promise<{saleId:string}>}) {
 const {supabase,userId,membership}=await getRequestContext();const {saleId}=await params;
 if(!userId||!membership)return NextResponse.json({error:'Faça login.'},{status:401});
 if(!uuidPattern.test(saleId))return NextResponse.json({error:'Venda inválida.'},{status:400});
 const {data:sale,error}=await supabase.from('product_sales').select('unit_id').eq('organization_id',membership.organization_id).eq('id',saleId).maybeSingle();
 if(error||!sale)return NextResponse.json({error:'Venda não encontrada.'},{status:404});
 const {data:access}=await supabase.from('unit_memberships').select('unit_id').eq('unit_id',sale.unit_id).eq('user_id',userId).eq('is_active',true).maybeSingle();
 if(!access)return NextResponse.json({error:'Sem acesso à unidade.'},{status:403});
 const [items,payments]=await Promise.all([supabase.from('product_sale_items').select('name,quantity,price_cents,total_cents').eq('organization_id',membership.organization_id).eq('sale_id',saleId),supabase.from('product_sale_payments').select('amount_cents,method,created_at').eq('organization_id',membership.organization_id).eq('sale_id',saleId).order('created_at')]);
 if(items.error||payments.error)return NextResponse.json({error:'Não foi possível consultar a venda.'},{status:500});
 return NextResponse.json({data:{items:items.data,payments:payments.data}});
}
