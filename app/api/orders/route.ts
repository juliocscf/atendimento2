import { NextResponse } from 'next/server';
import { financialBreakdown, unclassifiedBreakdown } from '@/lib/quote-finance';
import { getRequestContext } from '@/lib/supabase/request-context';
import { createPortalToken, hashPortalToken } from '@/lib/supabase/portal-token';

export const dynamic = 'force-dynamic';

const modes = ['Balcão', 'Remoto', 'Domicílio'] as const;
const priorities = ['Normal', 'Alta', 'Urgente'] as const;
const statuses = ['Recebido', 'Diagnóstico', 'Aguardando aprovação', 'Em execução', 'Em testes', 'Pronto para entrega', 'Concluído', 'Cancelada', 'Anulada'] as const;

export async function GET(request: Request) {
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  const params = new URL(request.url).searchParams;
  const query = params.get('q')?.replace(/[^\p{L}\p{N}@._+\- ]/gu, ' ').trim();
  const status = params.get('status');
  let builder = supabase.from('service_orders').select('id, number, client_id, device_id, unit_id, mode, status, priority, issue, accessories, due_date, amount_cents, paid_cents, assigned_to, created_by, created_at, updated_at, parts_blocked, parts_description, parts_supplier, parts_expected_date, parts_note, parts_blocked_at, parts_received_at, quotes(version, status, total_cents, discount_cents, quote_items(*))').eq('organization_id', membership.organization_id).order('created_at', { ascending: false }).order('id', { ascending: false });
  if (query) builder = builder.or(`number.ilike.%${query}%,issue.ilike.%${query}%,accessories.ilike.%${query}%`);
  if (status && statuses.includes(status as typeof statuses[number])) builder = builder.eq('status', status);
  const data = [];
  for (let offset = 0; ; offset += 500) {
    const { data: batch, error } = await builder.range(offset, offset + 499);
    if (error) return NextResponse.json({ error: 'Não foi possível carregar os registros.' }, { status: 500 });
    data.push(...(batch ?? []));
    if (!batch || batch.length < 500) break;
  }
  return NextResponse.json({ data: data.map(({ quotes, ...order }) => {
    const currentQuote = quotes.filter(quote => ['sent', 'approved'].includes(quote.status)).sort((a, b) => b.version - a.version)[0];
    const displayAmount = currentQuote?.total_cents ?? order.amount_cents;
    const breakdown = currentQuote ? financialBreakdown(currentQuote.quote_items, currentQuote.discount_cents) : null;
    return { ...order, amount_cents: displayAmount, financialBreakdown: breakdown && breakdown.totalCents === displayAmount ? breakdown : unclassifiedBreakdown(displayAmount) };
  }) });
}

export async function POST(request: Request) {
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  const body = await request.json().catch(() => null) as { clientId?: string; deviceId?: string | null; mode?: string; priority?: string; issue?: string; accessories?: string; dueDate?: string | null; amountCents?: number; schedule?: { startAt?: string; durationMinutes?: number; address?: string } } | null;
  const clientId = body?.clientId?.trim() ?? '';
  const deviceId = body?.deviceId?.trim() || null;
  const mode = body?.mode ?? 'Balcão';
  const priority = body?.priority ?? 'Normal';
  const issue = body?.issue?.trim() ?? '';
  const amountCents = Number.isInteger(body?.amountCents) && (body?.amountCents ?? 0) >= 0 ? body?.amountCents ?? 0 : 0;
  const origin = new URL(request.url).origin;
  async function addTracking<T extends { id: string; number: string }>(order: T) {
    const token = createPortalToken();
    const { error: linkError } = await supabase.rpc('replace_service_order_portal_link', { p_order_id: order.id, p_token_hash: hashPortalToken(token) });
    if (linkError) return { order, linkError };
    const trackingUrl = `${origin}/acompanhar/${token}`;
    return { order: { ...order, trackingUrl, receiptUrl: `${origin}/ordens/${order.id}/comprovante?acompanhamento=${encodeURIComponent(token)}` }, linkError: null };
  }
  if (!clientId || !modes.includes(mode as typeof modes[number]) || !priorities.includes(priority as typeof priorities[number]) || issue.length < 8) {
    return NextResponse.json({ error: 'Client, mode, priority and a detailed issue are required.' }, { status: 400 });
  }
  if (deviceId) {
    const { data: device } = await supabase.from('devices').select('id, client_id').eq('id', deviceId).eq('organization_id', membership.organization_id).maybeSingle();
    if (!device || device.client_id !== clientId) return NextResponse.json({ error: 'The selected device does not belong to this client.' }, { status: 400 });
  }
  if (body?.schedule) {
    const { startAt, durationMinutes, address } = body.schedule;
    const start = startAt ? new Date(startAt) : null;
    if (!start || Number.isNaN(start.getTime()) || start.getTime() <= Date.now() || ![15, 30, 45, 60, 90, 120, 180, 240].includes(durationMinutes ?? 0)) {
      return NextResponse.json({ error: 'Escolha uma data futura e uma duração válida para o agendamento.' }, { status: 400 });
    }
    if (mode === 'Domicílio' && !address?.trim()) {
      return NextResponse.json({ error: 'Informe o endereço do atendimento domiciliar.' }, { status: 400 });
    }
    const { data, error } = await supabase.rpc('create_order_with_appointment', {
      p_organization_id: membership.organization_id,
      p_unit_id: membership.unit_id,
      p_client_id: clientId,
      p_device_id: deviceId,
      p_mode: mode,
      p_issue: issue,
      p_start_at: start.toISOString(),
      p_duration_minutes: durationMinutes,
      p_address: address?.trim() || null,
    });
    if (error) return NextResponse.json({ error: error.code === '23P01' ? 'Este horário já está ocupado na sua agenda.' : error.message }, { status: error.code === '23P01' ? 409 : 400 });
    const result = await addTracking(data as { id: string; number: string });
    if (result.linkError) return NextResponse.json({ error: 'A OS foi criada, mas não foi possível preparar o acompanhamento. Abra a OS e tente novamente.' }, { status: 500 });
    return NextResponse.json({ data: result.order }, { status: 201 });
  }
  const { data, error } = await supabase.from('service_orders').insert({
    organization_id: membership.organization_id,
    unit_id: membership.unit_id,
    client_id: clientId,
    device_id: deviceId,
    mode,
    priority,
    issue,
    accessories: body?.accessories?.trim() || null,
    due_date: body?.dueDate || null,
    amount_cents: amountCents,
    created_by: userId,
  }).select('id, number, client_id, device_id, unit_id, mode, status, priority, issue, accessories, due_date, amount_cents, paid_cents, assigned_to, created_by, created_at, updated_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const result = await addTracking(data);
  if (result.linkError) return NextResponse.json({ error: 'A OS foi criada, mas não foi possível preparar o acompanhamento. Abra a OS e tente novamente.' }, { status: 500 });
  return NextResponse.json({ data: result.order }, { status: 201 });
}

