import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';

export const dynamic = 'force-dynamic';
const modes = ['Balcão', 'Remoto', 'Domicílio'] as const;

export async function GET(request: Request) {
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  const params = new URL(request.url).searchParams;
  let query = supabase.from('appointments').select('id, service_order_id, client_id, assigned_to, mode, status, title, start_at, end_at, address, remote_tool, travel_fee_cents, notes, checked_in_at, checked_out_at').eq('organization_id', membership.organization_id).order('start_at', { ascending: true }).limit(200);
  const from = params.get('from');
  const to = params.get('to');
  if (from) query = query.gte('start_at', from);
  if (to) query = query.lt('start_at', to);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  const body = await request.json().catch(() => null) as { serviceOrderId?: string; mode?: string; title?: string; startAt?: string; endAt?: string; durationMinutes?: number; address?: string; remoteTool?: string; travelFeeCents?: number; notes?: string } | null;
  const serviceOrderId = body?.serviceOrderId?.trim() ?? '';
  const title = body?.title?.trim() ?? '';
  const startAt = body?.startAt ? new Date(body.startAt) : null;
  const endAt = body?.endAt ? new Date(body.endAt) : body?.durationMinutes && startAt ? new Date(startAt.getTime() + body.durationMinutes * 60000) : null;
  if (!serviceOrderId || !modes.includes(body?.mode as typeof modes[number]) || title.length < 2 || !startAt || Number.isNaN(startAt.getTime()) || !endAt || Number.isNaN(endAt.getTime()) || endAt <= startAt) return NextResponse.json({ error: 'Order, mode, title and a valid time range are required.' }, { status: 400 });
  const { data: order } = await supabase.from('service_orders').select('id, client_id').eq('id', serviceOrderId).eq('organization_id', membership.organization_id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Service order not found.' }, { status: 404 });
  const { data, error } = await supabase.from('appointments').insert({ organization_id: membership.organization_id, unit_id: membership.unit_id, service_order_id: serviceOrderId, client_id: order.client_id, assigned_to: userId, mode: body?.mode, status: 'scheduled', title, start_at: startAt.toISOString(), end_at: endAt.toISOString(), address: body?.address?.trim() || null, remote_tool: body?.remoteTool?.trim() || null, travel_fee_cents: Number.isInteger(body?.travelFeeCents) ? Math.max(0, body?.travelFeeCents ?? 0) : 0, notes: body?.notes?.trim() || null, created_by: userId, updated_by: userId }).select('id, service_order_id, client_id, assigned_to, mode, status, title, start_at, end_at, address, remote_tool, travel_fee_cents, notes').single();
  if (error) return NextResponse.json({ error: error.code === '23P01' ? 'There is already an appointment for this technician in the selected period.' : error.message }, { status: error.code === '23P01' ? 409 : 400 });
  return NextResponse.json({ data }, { status: 201 });
}
