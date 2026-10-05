import { NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';
import { hashPortalToken } from '@/lib/supabase/portal-token';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token.length < 32 || token.length > 128) return NextResponse.json({ error: 'Link de acompanhamento inválido.' }, { status: 400 });
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc('approve_quote_from_service_order_portal', { p_token_hash: hashPortalToken(token) });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
