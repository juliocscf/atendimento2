import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSafeNextPath } from '@/lib/supabase/safe-redirect';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const destination = getSafeNextPath(url.searchParams.get('next'));

  if (!code) return NextResponse.redirect(new URL('/login?error=auth_callback', url.origin));

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return NextResponse.redirect(new URL('/login?error=auth_callback', url.origin));

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | null)?.sub;
  if (claimsError || !userId) return NextResponse.redirect(new URL('/login?error=auth_callback', url.origin));

  const { data: membership, error: membershipError } = await supabase
    .from('unit_memberships')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (membershipError) return NextResponse.redirect(new URL('/login?error=auth_callback', url.origin));
  if (!membership) return NextResponse.redirect(new URL('/onboarding', url.origin));

  return NextResponse.redirect(new URL(destination, url.origin));
}
