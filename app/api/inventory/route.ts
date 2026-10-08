import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';
import { uuidPattern } from '@/lib/inventory';
export const dynamic='force-dynamic';
export async function GET(request: Request) {
 const {supabase,userId,membership}=await getRequestContext();
 if(!userId) return NextResponse.json({error:'Faça login para consultar o estoque.'},{status:401});
 if(!membership) return NextResponse.json({error:'Configure sua organização.'},{status:409});
 const {data:memberships,error:membersError}=await supabase.from('unit_memberships').select('unit_id, role').eq('organization_id',membership.organization_id).eq('user_id',userId).eq('is_active',true);
 if(membersError) return NextResponse.json({error:'Não foi possível consultar suas unidades.'},{status:500});
 const unitId=new URL(request.url).searchParams.get('unitId')||membership.unit_id;
 const member=memberships?.find(m=>m.unit_id===unitId);
 if(!member) return NextResponse.json({error:'Unidade não autorizada.'},{status:403});
 async function rows(table: string, unit=false, limit?: number) {
  const all: Record<string,unknown>[]=[];
  for(let offset=0;;offset+=500){
   let query=supabase.from(table).select('*').eq('organization_id',membership!.organization_id);
   if(unit) query=query.eq('unit_id',unitId);
   query=query.order(table==='stock_balances'?'product_id':'id');
   if(limit) query=supabase.from(table).select('*').eq('organization_id',membership!.organization_id).eq('unit_id',unitId).order('created_at',{ascending:false});
   const result=await query.range(offset,offset+(limit??500)-1);
   if(result.error) throw new Error(`Não foi possível consultar ${table}.`);
   all.push(...result.data);
   if(limit||result.data.length<500) return all;
  }
 }
 try {
  const [products,balances,sales,movements,purchases,parts,clients,units]=await Promise.all([rows('products'),rows('stock_balances',true),rows('product_sales',true),rows('stock_movements',true,100),rows('stock_purchases',true,100),rows('order_stock_items',true),rows('clients'),rows('units')]);
  const confirmed=sales.filter(s=>s.status==='confirmed');
  const summary={total:confirmed.reduce((n,s)=>n+Number(s.total_cents),0),received:confirmed.reduce((n,s)=>n+Number(s.paid_cents),0),pending:confirmed.reduce((n,s)=>n+Number(s.total_cents)-Number(s.paid_cents),0)};
  return NextResponse.json({data:{products:products.sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR')),balances,sales:sales.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))),movements,purchases,parts,clients:clients.map(c=>({id:c.id,name:c.full_name})),units:units.filter(u=>u.is_active&&memberships?.some(m=>m.unit_id===u.id)).map(u=>({id:u.id,name:u.name,role:memberships?.find(m=>m.unit_id===u.id)?.role})),unitId,role:member.role,summary}});
 } catch(error) {return NextResponse.json({error:error instanceof Error?error.message:'Falha na consulta.'},{status:500});}
}
export async function POST(request: Request) {
 const {supabase,userId,membership}=await getRequestContext();
 if(!userId) return NextResponse.json({error:'Faça login para continuar.'},{status:401});
 if(!membership) return NextResponse.json({error:'Configure sua organização.'},{status:409});
 const text=await request.text();
 if(text.length>200000) return NextResponse.json({error:'Operação muito grande.'},{status:413});
 let body; try{body=JSON.parse(text);}catch{return NextResponse.json({error:'Dados inválidos.'},{status:400});}
 const actions=['product','adjust','sale','payment','return_sale','reserve','consume','release','restock'];
 if(!body||!actions.includes(body.action)||typeof body.unitId!=='string'||!uuidPattern.test(body.unitId)||typeof body.requestId!=='string'||!uuidPattern.test(body.requestId)||!body.data||typeof body.data!=='object'||Array.isArray(body.data)) return NextResponse.json({error:'Operação inválida.'},{status:400});
 const {data,error}=await supabase.rpc('inventory_command',{p_organization_id:membership.organization_id,p_unit_id:body.unitId,p_request_id:body.requestId,p_action:body.action,p_data:body.data});
 if(error) return NextResponse.json({error:error.code==='23505'?'Código ou operação já cadastrado.':error.code==='23514'||error.code==='22P02'||error.code==='22003'||error.code==='23502'?'Confira os campos, valores e quantidades.':error.code==='23503'?'Produto, cliente ou unidade inválido.':error.code==='P0001'?error.message:'Não foi possível concluir a operação.'},{status:400});
 return NextResponse.json({data});
}
