import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';
import { createPortalToken, hashPortalToken } from '@/lib/supabase/portal-token';

export const dynamic = 'force-dynamic';

const managementRoles = new Set(['gestor', 'atendimento']);

async function getContext(orderId: string) {
  const context = await getRequestContext();
  if (!context.userId) return { context, response: NextResponse.json({ error: 'Authentication is required.' }, { status: 401 }) };
  if (!context.membership) return { context, response: NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 }) };
  const { data: order, error } = await context.supabase
    .from('service_orders')
    .select('id, number, status')
    .eq('id', orderId)
    .eq('organization_id', context.membership.organization_id)
    .maybeSingle();
  if (error) return { context, response: NextResponse.json({ error: error.message }, { status: 500 }) };
  if (!order) return { context, response: NextResponse.json({ error: 'Service order not found.' }, { status: 404 }) };
  return { context, order, response: null };
}

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const result = await getContext(orderId);
  if (result.response) return result.response;
  const { context } = result;
  const { data, error } = await context.supabase
    .from('service_order_portal_links')
    .select('id, created_at, expires_at, revoked_at, last_accessed_at')
    .eq('organization_id', context.membership!.organization_id)
    .eq('service_order_id', orderId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const active = Boolean(data && (!data.expires_at || new Date(data.expires_at).getTime() > Date.now()));
  return NextResponse.json({ data: data ? { ...data, active } : null });
}

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const result = await getContext(orderId);
  if (result.response) return result.response;
  const { context, order } = result;
  if (!managementRoles.has(context.membership!.role)) return NextResponse.json({ error: 'Você não tem permissão para gerar este link.' }, { status: 403 });

  const token = createPortalToken();
  const { data, error } = await context.supabase.rpc('replace_service_order_portal_link', {
    p_order_id: orderId,
    p_token_hash: hashPortalToken(token),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const origin = new URL(request.url).origin;
  return NextResponse.json({
    data: {
      ...data,
      orderNumber: order!.number,
      url: `${origin}/acompanhar/${token}`,
    },
  }, { status: 201 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const result = await getContext(orderId);
  if (result.response) return result.response;
  const { context } = result;
  if (!managementRoles.has(context.membership!.role)) return NextResponse.json({ error: 'Você não tem permissão para cancelar este link.' }, { status: 403 });
  const { error } = await context.supabase.rpc('revoke_service_order_portal_link', { p_order_id: orderId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: { revoked: true } });
}
