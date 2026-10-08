import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';
import { parseNfe, prepareReceipt } from '@/lib/nfe-import';
import { uuidPattern } from '@/lib/inventory';
export const dynamic='force-dynamic';
export async function POST(request: Request) {
 const {supabase,userId,membership}=await getRequestContext();
 if(!userId) return NextResponse.json({error:'Faça login para importar.'},{status:401});
 if(!membership) return NextResponse.json({error:'Configure sua organização.'},{status:409});
 try {
  const text=await request.text(); if(Buffer.byteLength(text)>2_500_000) return NextResponse.json({error:'Arquivo maior que o limite de 2 MB.'},{status:413});
  const body=JSON.parse(text);
  if(typeof body.unitId!=='string'||!uuidPattern.test(body.unitId)) throw new Error('Selecione a unidade.');
  const {data:member}=await supabase.from('unit_memberships').select('role').eq('organization_id',membership.organization_id).eq('unit_id',body.unitId).eq('user_id',userId).eq('is_active',true).maybeSingle();
  if(!member||!['gestor','atendimento'].includes(member.role)) return NextResponse.json({error:'Sem permissão para importar nesta unidade.'},{status:403});
  const invoice=parseNfe(body.xml);
  if(body.confirm===true){
   if(typeof body.requestId!=='string'||!uuidPattern.test(body.requestId)||body.recipientConfirmed!==true) throw new Error('Confirme o destinatário e os itens antes de importar.');
   const receipt=prepareReceipt(invoice,body.selections);
   const {data,error}=await supabase.rpc('inventory_command',{p_organization_id:membership.organization_id,p_unit_id:body.unitId,p_request_id:body.requestId,p_action:'purchase',p_data:receipt});
   if(error) throw new Error(error.code==='23505'?'Esta nota já foi importada.':error.code==='P0001'?error.message:'Confira os produtos e as conversões da nota.');
   return NextResponse.json({data});
  }
  const [previous,mappings]=await Promise.all([
   supabase.from('stock_purchases').select('id').eq('organization_id',membership.organization_id).eq('invoice_key',invoice.invoice_key).maybeSingle(),
   supabase.from('supplier_product_links').select('supplier_code,product_id,factor').eq('organization_id',membership.organization_id).eq('supplier_tax_id',invoice.supplier_tax_id).in('supplier_code',invoice.items.map(i=>i.supplier_code))
  ]);
  if(previous.error||mappings.error) throw new Error('Não foi possível conferir notas e produtos existentes.');
  if(previous.data) throw new Error('Esta nota já foi importada.');
  return NextResponse.json({data:invoice,mappings:mappings.data});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'XML inválido.'},{status:400});}
}
