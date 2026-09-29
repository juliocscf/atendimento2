import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hashPortalToken } from '@/lib/supabase/portal-token';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 32) return NextResponse.json({ error: 'Invalid approval link.' }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('approve_quote_portal', { p_token_hash: hashPortalToken(token) });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
