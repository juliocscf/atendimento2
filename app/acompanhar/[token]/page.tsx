import { notFound } from 'next/navigation';
import { ServiceOrderPortal } from '@/components/service-order-portal';
import type { ServiceOrderPortalData } from '@/lib/service-order-portal';
import { hashPortalToken } from '@/lib/supabase/portal-token';
import { createPublicClient } from '@/lib/supabase/public';

export const dynamic = 'force-dynamic';

export default async function ServiceOrderTrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token.length < 32 || token.length > 128) notFound();
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc('get_service_order_portal_details', { p_token_hash: hashPortalToken(token) });
  if (error || !data) notFound();
  return <ServiceOrderPortal token={token} initialData={data as ServiceOrderPortalData} />;
}
