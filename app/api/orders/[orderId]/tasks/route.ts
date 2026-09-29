import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  const { data, error } = await supabase.from('service_order_tasks').select('id, label, completed, completed_by, completed_at, position, created_at, updated_at').eq('organization_id', membership.organization_id).eq('service_order_id', orderId).order('position', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  const body = await request.json().catch(() => null) as { label?: string; position?: number } | null;
  const label = body?.label?.trim() ?? '';
  if (label.length < 2) return NextResponse.json({ error: 'A task label is required.' }, { status: 400 });
  const { data: order } = await supabase.from('service_orders').select('id').eq('id', orderId).eq('organization_id', membership.organization_id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Service order not found.' }, { status: 404 });
  const { data, error } = await supabase.from('service_order_tasks').insert({ organization_id: membership.organization_id, service_order_id: orderId, label, position: Number.isInteger(body?.position) ? body?.position : 0, created_by: userId }).select('id, label, completed, completed_by, completed_at, position, created_at, updated_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}
