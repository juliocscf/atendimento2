import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';

export const dynamic = 'force-dynamic';
const statuses = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params;
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  const body = await request.json().catch(() => null) as { status?: string; startAt?: string; endAt?: string; notes?: string; checkedIn?: boolean; checkedOut?: boolean } | null;
  const patch: Record<string, unknown> = { updated_by: userId };
  if (body?.status && statuses.includes(body.status as typeof statuses[number])) patch.status = body.status;
  if (body?.startAt) patch.start_at = new Date(body.startAt).toISOString();
  if (body?.endAt) patch.end_at = new Date(body.endAt).toISOString();
  if (body?.notes !== undefined) patch.notes = body.notes?.trim() || null;
  if (body?.checkedIn) patch.checked_in_at = new Date().toISOString();
  if (body?.checkedOut) patch.checked_out_at = new Date().toISOString();
  const { data, error } = await supabase.from('appointments').update(patch).eq('id', appointmentId).eq('organization_id', membership.organization_id).select('id, service_order_id, client_id, assigned_to, mode, status, title, start_at, end_at, address, remote_tool, travel_fee_cents, notes, checked_in_at, checked_out_at').single();
  if (error) return NextResponse.json({ error: error.code === '23P01' ? 'There is already an appointment for this technician in the selected period.' : error.message }, { status: error.code === '23P01' ? 409 : 400 });
  return NextResponse.json({ data });
}
