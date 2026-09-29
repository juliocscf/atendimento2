import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';

export const dynamic = 'force-dynamic';
const statuses = ['draft', 'sent', 'approved', 'rejected', 'expired'] as const;

export async function GET(_request: Request, { params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  const { data, error } = await supabase.from('quotes').select('id, service_order_id, version, status, valid_until, notes, subtotal_cents, discount_cents, total_cents, sent_at, approved_at, approval_channel, created_at, updated_at').eq('id', quoteId).eq('organization_id', membership.organization_id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
  const { data: items, error: itemsError } = await supabase.from('quote_items').select('id, description, quantity, unit_price_cents, total_cents, position').eq('quote_id', quoteId).eq('organization_id', membership.organization_id).order('position', { ascending: true });
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });
  return NextResponse.json({ data: { ...data, items: items ?? [] } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  const body = await request.json().catch(() => null) as { status?: string; approvalChannel?: 'portal' | 'manual' } | null;
  if (!body?.status || !statuses.includes(body.status as typeof statuses[number])) return NextResponse.json({ error: 'A valid quote status is required.' }, { status: 400 });
  const patch = body.status === 'approved' ? { status: body.status, approved_at: new Date().toISOString(), approved_by: userId, approval_channel: body.approvalChannel ?? 'manual' } : body.status === 'sent' ? { status: body.status, sent_at: new Date().toISOString() } : { status: body.status };
  const { data, error } = await supabase.from('quotes').update(patch).eq('id', quoteId).eq('organization_id', membership.organization_id).select('id, service_order_id, version, status, valid_until, notes, subtotal_cents, discount_cents, total_cents, sent_at, approved_at, approval_channel, updated_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
