import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hashPortalToken } from '@/lib/supabase/portal-token';
import { PortalQuote } from '@/components/portal-quote';

export const dynamic = 'force-dynamic';

export default async function PortalQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_quote_portal_details', { p_token_hash: hashPortalToken(token) });
  if (error || !data) notFound();
  return <PortalQuote token={token} quote={data} />;
}
