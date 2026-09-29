import { notFound, redirect } from 'next/navigation';
import { DeviceLabel } from '@/components/device-label';
import { getRequestContext } from '@/lib/supabase/request-context';

export const dynamic = 'force-dynamic';

export default async function DeviceLabelPage({ params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params;
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) redirect(`/login?next=${encodeURIComponent(`/equipamentos/${deviceId}/etiqueta`)}`);
  if (!membership) redirect('/onboarding');
  const { data: device } = await supabase.from('devices').select('id, code, kind, brand, model, serial, client_id').eq('id', deviceId).eq('organization_id', membership.organization_id).maybeSingle();
  if (!device) notFound();
  const { data: client } = await supabase.from('clients').select('full_name').eq('id', device.client_id).eq('organization_id', membership.organization_id).maybeSingle();
  return <DeviceLabel device={device} clientName={client?.full_name ?? 'Cliente não encontrado'} />;
}
