import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params;
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  const { data, error } = await supabase.from('appointment_events').select('id, event_type, from_status, to_status, description, actor_id, created_at').eq('appointment_id', appointmentId).eq('organization_id', membership.organization_id).order('created_at', { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
