import { redirect } from 'next/navigation';
import { DeviceLabelSheet } from '@/components/device-label-sheet';
import { getRequestContext } from '@/lib/supabase/request-context';

export const dynamic = 'force-dynamic';

export default async function DeviceLabelsPage() {
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) redirect('/login?next=/equipamentos/etiquetas');
  if (!membership) redirect('/onboarding');
  const { data } = await supabase.from('devices').select('id, code, kind, brand, model, serial').eq('organization_id', membership.organization_id).eq('status', 'active').order('created_at', { ascending: false }).limit(30);
  return <DeviceLabelSheet devices={data ?? []} />;
}
