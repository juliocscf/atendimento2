import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  const serviceOrderId = new URL(request.url).searchParams.get('serviceOrderId');
  let query = supabase.from('quotes').select('id, service_order_id, version, status, valid_until, notes, subtotal_cents, discount_cents, total_cents, sent_at, approved_at, approval_channel, created_at, updated_at').eq('organization_id', membership.organization_id);
  if (serviceOrderId) query = query.eq('service_order_id', serviceOrderId);
  const { data, error } = await query.order(serviceOrderId ? 'version' : 'updated_at', { ascending: false }).limit(serviceOrderId ? 10 : 100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  const body = await request.json().catch(() => null) as { serviceOrderId?: string; validUntil?: string | null; discountCents?: number; notes?: string; items?: Array<{ description?: string; quantity?: number; unitPriceCents?: number }> } | null;
  const serviceOrderId = body?.serviceOrderId?.trim() ?? '';
  const items = body?.items ?? [];
  if (!serviceOrderId || !items.length || items.some(item => !item.description?.trim() || !(item.quantity && item.quantity > 0) || !Number.isInteger(item.unitPriceCents) || (item.unitPriceCents ?? 0) < 0)) return NextResponse.json({ error: 'Service order and at least one valid quote item are required.' }, { status: 400 });
  const { data: order } = await supabase.from('service_orders').select('id').eq('id', serviceOrderId).eq('organization_id', membership.organization_id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Service order not found.' }, { status: 404 });
  const { data: previous } = await supabase.from('quotes').select('version').eq('service_order_id', serviceOrderId).eq('organization_id', membership.organization_id).order('version', { ascending: false }).limit(1).maybeSingle();
  const version = (previous?.version ?? 0) + 1;
  const calculatedItems = items.map((item, position) => ({ description: item.description!.trim(), quantity: item.quantity!, unit_price_cents: item.unitPriceCents!, total_cents: Math.round(item.quantity! * item.unitPriceCents!), position }));
  const subtotalCents = calculatedItems.reduce((sum, item) => sum + item.total_cents, 0);
  const discountCents = Number.isInteger(body?.discountCents) ? Math.min(Math.max(body?.discountCents ?? 0, 0), subtotalCents) : 0;
  const { data: quote, error: quoteError } = await supabase.from('quotes').insert({ organization_id: membership.organization_id, service_order_id: serviceOrderId, version, valid_until: body?.validUntil || null, notes: body?.notes?.trim() || null, subtotal_cents: subtotalCents, discount_cents: discountCents, total_cents: subtotalCents - discountCents, created_by: userId }).select('id, service_order_id, version, status, valid_until, notes, subtotal_cents, discount_cents, total_cents, created_at').single();
  if (quoteError) return NextResponse.json({ error: quoteError.message }, { status: 400 });
  const { error: itemsError } = await supabase.from('quote_items').insert(calculatedItems.map(item => ({ ...item, organization_id: membership.organization_id, quote_id: quote.id })));
  if (itemsError) { await supabase.from('quotes').delete().eq('id', quote.id).eq('organization_id', membership.organization_id); return NextResponse.json({ error: itemsError.message }, { status: 400 }); }
  return NextResponse.json({ data: quote }, { status: 201 });
}
