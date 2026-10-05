import { NextResponse } from 'next/server';
import { isValidCpf, onlyDigits } from '@/lib/pickup-authorization';
import { getRequestContext } from '@/lib/supabase/request-context';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Nenhuma unidade ativa encontrada.' }, { status: 403 });
  const { data, error } = await supabase.rpc('get_pickup_authorization_for_staff', { p_order_id: orderId });
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Nenhuma unidade ativa encontrada.' }, { status: 403 });
  const body = await request.json().catch(() => null) as { action?: 'block' | 'cancel' | 'collect'; blocked?: boolean; reason?: string; cpf?: string } | null;
  if (body?.action === 'block' && typeof body.blocked === 'boolean') {
    const { data, error } = await supabase.rpc('set_service_order_pickup_blocked', { p_order_id: orderId, p_blocked: body.blocked });
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ data });
  }
  if (body?.action === 'cancel') {
    const { data, error } = await supabase.rpc('cancel_pickup_authorization_for_staff', { p_order_id: orderId, p_reason: body.reason?.trim() || 'Cancelada pela assistência.' });
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ data });
  }
  if (body?.action === 'collect') {
    const cpf = onlyDigits(body.cpf ?? '');
    if (!isValidCpf(cpf)) return NextResponse.json({ error: 'Informe o CPF apresentado na retirada.' }, { status: 400 });
    const { data, error } = await supabase.rpc('collect_pickup_authorization', { p_order_id: orderId, p_cpf: cpf });
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ data });
  }
  return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
}
