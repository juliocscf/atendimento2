import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';

export const dynamic = 'force-dynamic';

const statuses = ['Recebido', 'Diagnóstico', 'Aguardando aprovação', 'Em execução', 'Em testes', 'Pronto para entrega', 'Concluído', 'Anulada'] as const;

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  const { data, error } = await supabase.from('service_orders').select('id, number, client_id, device_id, unit_id, mode, status, priority, issue, accessories, due_date, amount_cents, paid_cents, assigned_to, created_by, created_at, updated_at, parts_blocked, parts_description, parts_supplier, parts_expected_date, parts_note, parts_blocked_at, parts_received_at').eq('id', orderId).eq('organization_id', membership.organization_id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Service order not found.' }, { status: 404 });
  const [{ data: events, error: eventsError }, { data: tasks, error: tasksError }] = await Promise.all([
    supabase.from('service_order_events').select('id, event_type, from_status, to_status, description, metadata, actor_id, created_at').eq('service_order_id', orderId).eq('organization_id', membership.organization_id).order('created_at', { ascending: true }),
    supabase.from('service_order_tasks').select('id, label, completed, completed_by, completed_at, position, created_at, updated_at').eq('service_order_id', orderId).eq('organization_id', membership.organization_id).order('position', { ascending: true }),
  ]);
  if (eventsError || tasksError) return NextResponse.json({ error: eventsError?.message ?? tasksError?.message }, { status: 500 });
  return NextResponse.json({ data: { ...data, events: events ?? [], tasks: tasks ?? [] } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  const body = await request.json().catch(() => null) as { status?: string; note?: string; action?: string; issue?: string; priority?: string; dueDate?: string | null; accessories?: string; deviceId?: string | null; partsDescription?: string; partsSupplier?: string; partsExpectedDate?: string | null; partsNote?: string } | null;
  if (body?.action === 'cancel') {
    if ((body.note?.trim().length ?? 0) < 5) return NextResponse.json({ error: 'Informe o motivo do cancelamento (mínimo de 5 caracteres).' }, { status: 400 });
    const { data, error } = await supabase.rpc('cancel_service_order', { p_order_id: orderId, p_reason: body.note!.trim() });
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ data });
  }
  if (body?.action === 'annul') {
    if ((body.note?.trim().length ?? 0) < 5) return NextResponse.json({ error: 'Informe o motivo da anulação (mínimo de 5 caracteres).' }, { status: 400 });
    const { data, error } = await supabase.rpc('annul_completed_service_order', { p_order_id: orderId, p_reason: body.note!.trim() });
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ data });
  }
  if (body?.action === 'return') {
    const { data, error } = await supabase.rpc('return_service_order', { p_order_id: orderId, p_reason: body.note?.trim() ?? '' });
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ data });
  }
  if (body?.action === 'edit') {
    if (!body.issue || !body.priority || (body.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate))) return NextResponse.json({ error: 'Dados da OS inválidos.' }, { status: 400 });
    const { data, error } = await supabase.rpc('edit_service_order', { p_order_id: orderId, p_issue: body.issue, p_priority: body.priority, p_due_date: body.dueDate || null, p_accessories: body.accessories ?? '', p_device_id: body.deviceId || null });
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ data });
  }
  if (body?.action === 'parts_block' || body?.action === 'parts_resume') {
    const { data: current, error: currentError } = await supabase.from('service_orders').select('id, organization_id, status').eq('id', orderId).eq('organization_id', membership.organization_id).maybeSingle();
    if (currentError || !current) return NextResponse.json({ error: currentError?.message ?? 'Service order not found.' }, { status: 404 });
    if (current.status !== 'Em execução') return NextResponse.json({ error: 'O bloqueio por peça só pode ser registrado durante a execução.' }, { status: 400 });
    const patch = body.action === 'parts_block'
      ? { parts_blocked: true, parts_description: body.partsDescription?.trim() || null, parts_supplier: body.partsSupplier?.trim() || null, parts_expected_date: body.partsExpectedDate || null, parts_note: body.partsNote?.trim() || null, parts_blocked_at: new Date().toISOString(), parts_received_at: null }
      : { parts_blocked: false, parts_received_at: new Date().toISOString() };
    const { data, error } = await supabase.from('service_orders').update(patch).eq('id', orderId).eq('organization_id', membership.organization_id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await supabase.from('service_order_events').insert({ organization_id: membership.organization_id, service_order_id: orderId, event_type: 'parts_block', description: body.action === 'parts_block' ? `Execução pausada: aguardando peça${body.partsDescription ? ` (${body.partsDescription})` : ''}.` : 'Peça recebida. Execução retomada.', actor_id: userId, metadata: { action: body.action } });
    return NextResponse.json({ data });
  }
  if (!body?.status || !statuses.includes(body.status as typeof statuses[number])) return NextResponse.json({ error: 'A valid target status is required.' }, { status: 400 });
  const { data, error } = await supabase.rpc('advance_service_order', { p_order_id: orderId, p_status: body.status, p_note: body.note?.trim() || null });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
