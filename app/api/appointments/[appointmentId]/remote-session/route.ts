import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params;
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  const { data, error } = await supabase.from('remote_sessions').select('id, appointment_id, tool_name, authorization_at, started_at, ended_at, summary').eq('appointment_id', appointmentId).eq('organization_id', membership.organization_id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request, { params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params;
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  const body = await request.json().catch(() => null) as { toolName?: string; authorizationAt?: string } | null;
  if (!body?.toolName?.trim()) return NextResponse.json({ error: 'The external tool name is required.' }, { status: 400 });
  const { data: appointment } = await supabase.from('appointments').select('id, mode').eq('id', appointmentId).eq('organization_id', membership.organization_id).maybeSingle();
  if (!appointment) return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 });
  if (appointment.mode !== 'Remoto') return NextResponse.json({ error: 'Remote session data is only available for remote appointments.' }, { status: 400 });
  const { data, error } = await supabase.from('remote_sessions').upsert({ organization_id: membership.organization_id, appointment_id: appointmentId, tool_name: body.toolName.trim(), authorization_at: body.authorizationAt || new Date().toISOString(), created_by: userId }, { onConflict: 'appointment_id' }).select('id, appointment_id, tool_name, authorization_at, started_at, ended_at, summary').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params;
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  const body = await request.json().catch(() => null) as { started?: boolean; ended?: boolean; summary?: string } | null;
  const patch: Record<string, unknown> = {};
  if (body?.started) patch.started_at = new Date().toISOString();
  if (body?.ended) patch.ended_at = new Date().toISOString();
  if (body?.summary !== undefined) patch.summary = body.summary?.trim() || null;
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'A session update is required.' }, { status: 400 });
  const { data, error } = await supabase.from('remote_sessions').update(patch).eq('appointment_id', appointmentId).eq('organization_id', membership.organization_id).select('id, appointment_id, tool_name, authorization_at, started_at, ended_at, summary').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (body?.started || body?.ended) {
    await supabase.from('appointments').update({ status: body.ended ? 'completed' : 'confirmed', updated_by: userId }).eq('id', appointmentId).eq('organization_id', membership.organization_id);
  }
  return NextResponse.json({ data });
}
