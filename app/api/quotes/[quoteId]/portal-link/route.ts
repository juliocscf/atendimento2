import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';
import { createPortalToken, hashPortalToken } from '@/lib/supabase/portal-token';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  const body = await request.json().catch(() => null) as { expiresInDays?: number } | null;
  const expiresInDays = Math.min(Math.max(Math.trunc(body?.expiresInDays ?? 7), 1), 30);
  const { data: quote } = await supabase.from('quotes').select('id, status').eq('id', quoteId).eq('organization_id', membership.organization_id).maybeSingle();
  if (!quote) return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
  if (quote.status !== 'sent') return NextResponse.json({ error: 'Only quotes sent for approval can receive a portal link.' }, { status: 400 });
  const token = createPortalToken();
  const { error } = await supabase.from('quote_portal_links').insert({ organization_id: membership.organization_id, quote_id: quoteId, token_hash: hashPortalToken(token), expires_at: new Date(Date.now() + expiresInDays * 86400000).toISOString(), created_by: userId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const origin = new URL(request.url).origin;
  return NextResponse.json({ data: { url: `${origin}/portal/orcamento/${token}`, expiresInDays } }, { status: 201 });
}
