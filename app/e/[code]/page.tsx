import { notFound, redirect } from 'next/navigation';
import { getRequestContext } from '@/lib/supabase/request-context';

export const dynamic = 'force-dynamic';

export default async function ShortEquipmentLabelPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { supabase, userId, membership } = await getRequestContext();
  const next = `/e/${encodeURIComponent(code)}`;
  if (!userId) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!membership) redirect('/onboarding');
  const { data: device } = await supabase.from('devices').select('id').eq('organization_id', membership.organization_id).ilike('code', code).maybeSingle();
  if (!device) notFound();
  redirect(`/equipamentos/${device.id}/etiqueta`);
}
