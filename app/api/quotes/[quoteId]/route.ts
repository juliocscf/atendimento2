import { NextResponse } from 'next/server';
import { financialBreakdown } from '@/lib/quote-finance';
import { getRequestContext } from '@/lib/supabase/request-context';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  const { data, error } = await supabase.from('quotes').select('id, service_order_id, version, status, valid_until, notes, subtotal_cents, discount_cents, total_cents, sent_at, approved_at, approval_channel, created_at, updated_at').eq('id', quoteId).eq('organization_id', membership.organization_id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
  const { data: items, error: itemsError } = await supabase.from('quote_items').select('*').eq('quote_id', quoteId).eq('organization_id', membership.organization_id).order('position', { ascending: true });
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });
  return NextResponse.json({ data: { ...data, items: items ?? [], financialBreakdown: financialBreakdown(items ?? [], data.discount_cents) } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  const body = await request.json().catch(() => null) as { status?: string } | null;
  if (body?.status !== 'sent') return NextResponse.json({ error: 'A aprovação deve ser registrada pelo cliente no link da proposta.' }, { status: 400 });
  const { data, error } = await supabase.from('quotes').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', quoteId).eq('organization_id', membership.organization_id).eq('status', 'draft').select('id, service_order_id, version, status, valid_until, notes, subtotal_cents, discount_cents, total_cents, sent_at, approved_at, approval_channel, updated_at').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Somente um orçamento em rascunho pode ser colocado em aprovação.' }, { status: 409 });
  return NextResponse.json({ data });
}
