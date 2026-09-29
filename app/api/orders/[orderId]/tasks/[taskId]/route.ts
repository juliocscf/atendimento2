import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ orderId: string; taskId: string }> }) {
  const { orderId, taskId } = await params;
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  const body = await request.json().catch(() => null) as { completed?: boolean; label?: string } | null;
  const patch: { completed?: boolean; completed_by?: string | null; completed_at?: string | null; label?: string } = {};
  if (typeof body?.completed === 'boolean') { patch.completed = body.completed; patch.completed_by = body.completed ? userId : null; patch.completed_at = body.completed ? new Date().toISOString() : null; }
  if (body?.label?.trim()) patch.label = body.label.trim();
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'No task changes were provided.' }, { status: 400 });
  const { data, error } = await supabase.from('service_order_tasks').update(patch).eq('id', taskId).eq('service_order_id', orderId).eq('organization_id', membership.organization_id).select('id, label, completed, completed_by, completed_at, position, created_at, updated_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
