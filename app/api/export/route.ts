import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  if (membership.role !== 'gestor') return NextResponse.json({ error: 'Only organization managers can export operational data.' }, { status: 403 });
  const organizationId = membership.organization_id;
  const [clients, devices, orders, quotes, payments, appointments, quoteItems] = await Promise.all([
    supabase.from('clients').select('*').eq('organization_id', organizationId).limit(10000),
    supabase.from('devices').select('*').eq('organization_id', organizationId).limit(10000),
    supabase.from('service_orders').select('*').eq('organization_id', organizationId).limit(10000),
    supabase.from('quotes').select('*').eq('organization_id', organizationId).limit(10000),
    supabase.from('service_order_payments').select('*').eq('organization_id', organizationId).limit(10000),
    supabase.from('appointments').select('*').eq('organization_id', organizationId).limit(10000),
    supabase.from('quote_items').select('*').eq('organization_id', organizationId).limit(10000),
  ]);
  const errors = [clients, devices, orders, quotes, payments, appointments, quoteItems].filter(result => result.error);
  if (errors.length) return NextResponse.json({ error: errors[0].error?.message ?? 'Export failed.' }, { status: 500 });
  const { error: auditError } = await supabase.from('audit_log').insert({
    organization_id: organizationId,
    actor_id: userId,
    action: 'exported',
    entity_type: 'operational_snapshot',
    metadata: {
      clients: clients.data?.length ?? 0,
      devices: devices.data?.length ?? 0,
      serviceOrders: orders.data?.length ?? 0,
      quotes: quotes.data?.length ?? 0,
      quoteItems: quoteItems.data?.length ?? 0,
      payments: payments.data?.length ?? 0,
      appointments: appointments.data?.length ?? 0,
    },
  });
  if (auditError) return NextResponse.json({ error: 'The export could not be audited safely.' }, { status: 500 });
  const payload = { exportedAt: new Date().toISOString(), organizationId, data: { clients: clients.data ?? [], devices: devices.data ?? [], serviceOrders: orders.data ?? [], quotes: quotes.data ?? [], quoteItems: quoteItems.data ?? [], payments: payments.data ?? [], appointments: appointments.data ?? [] } };
  return new NextResponse(JSON.stringify(payload, null, 2), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="atendimento-backup-${new Date().toISOString().slice(0, 10)}.json"`, 'Cache-Control': 'no-store' } });
}
