import { createClient } from '@/lib/supabase/server';

export async function getRequestContext() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as { sub?: string } | null;
  const userId = claims?.sub;

  if (!userId) {
    return { supabase, userId: null, membership: null };
  }

  const { data: membership } = await supabase
    .from('unit_memberships')
    .select('organization_id, unit_id, role')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return { supabase, userId, membership };
}
