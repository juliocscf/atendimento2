import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';

export async function POST(_: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { supabase, userId } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  const { orderId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ error: 'Ordem inválida.' }, { status: 400 });
  const { data, error } = await supabase.rpc('customer_approve_quote', { p_order_id: orderId });
  if (error) return NextResponse.json({ error: 'Não foi possível aprovar este orçamento.' }, { status: error.code === '42501' ? 403 : 400 });
  return NextResponse.json({ data });
}
