import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';

export const dynamic = 'force-dynamic';
const methods = ['pix', 'cartao', 'dinheiro', 'transferencia', 'outro'] as const;

export async function GET(request: Request) {
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  const orderId = new URL(request.url).searchParams.get('orderId');
  let builder = supabase.from('service_order_payments').select('id, service_order_id, amount_cents, method, received_at, idempotency_key, note, created_at').eq('organization_id', membership.organization_id).order('received_at', { ascending: false }).limit(200);
  if (orderId) builder = builder.eq('service_order_id', orderId);
  const { data, error } = await builder;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  const body = await request.json().catch(() => null) as { serviceOrderId?: string; amountCents?: number; method?: string; idempotencyKey?: string; note?: string } | null;
  const serviceOrderId = body?.serviceOrderId?.trim() ?? '';
  const amountCents = body?.amountCents;
  const idempotencyKey = body?.idempotencyKey?.trim() ?? '';
  if (!serviceOrderId || !Number.isInteger(amountCents) || (amountCents ?? 0) <= 0 || !methods.includes(body?.method as typeof methods[number]) || !idempotencyKey) return NextResponse.json({ error: 'Order, positive amount, payment method and idempotency key are required.' }, { status: 400 });
  const { data: order } = await supabase.from('service_orders').select('id, amount_cents, paid_cents').eq('id', serviceOrderId).eq('organization_id', membership.organization_id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Service order not found.' }, { status: 404 });
  const { data: existing } = await supabase.from('service_order_payments').select('id, service_order_id, amount_cents, method, received_at').eq('organization_id', membership.organization_id).eq('idempotency_key', idempotencyKey).maybeSingle();
  if (existing) return NextResponse.json({ data: existing, idempotent: true });
  if ((order.paid_cents ?? 0) + amountCents > order.amount_cents) return NextResponse.json({ error: 'The payment exceeds the remaining balance.' }, { status: 400 });
  const { data, error } = await supabase.from('service_order_payments').insert({ organization_id: membership.organization_id, service_order_id: serviceOrderId, amount_cents: amountCents, method: body?.method, idempotency_key: idempotencyKey, note: body?.note?.trim() || null, created_by: userId }).select('id, service_order_id, amount_cents, method, received_at, idempotency_key, note, created_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}
