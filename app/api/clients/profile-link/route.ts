import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getRequestContext } from '@/lib/supabase/request-context';
import { hashPortalToken } from '@/lib/supabase/portal-token';

export const dynamic = 'force-dynamic';

type Body = { clientId?: unknown; expiresInMinutes?: unknown };

export async function POST(request: Request) {
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Autenticação necessária.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Conclua a configuração da organização.' }, { status: 409 });
  if (!['gestor', 'atendimento'].includes(membership.role)) return NextResponse.json({ error: 'Sem permissão para gerar links de cadastro.' }, { status: 403 });

  const body = await request.json().catch(() => null) as Body | null;
  const clientId = typeof body?.clientId === 'string' && body.clientId.length > 0 ? body.clientId : null;
  if (clientId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) {
    return NextResponse.json({ error: 'Cliente inválido.' }, { status: 400 });
  }

  const requestedMinutes = typeof body?.expiresInMinutes === 'number' ? body.expiresInMinutes : 60;
  const expiresInMinutes = Math.min(1440, Math.max(15, Math.round(requestedMinutes)));
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60_000);
  const purpose = clientId ? 'update' : 'register';
  const { data, error } = await supabase.rpc('create_client_profile_link', {
    p_organization_id: membership.organization_id,
    p_unit_id: membership.unit_id,
    p_client_id: clientId,
    p_purpose: purpose,
    p_token_hash: hashPortalToken(token),
    p_expires_at: expiresAt.toISOString(),
  });

  if (error) {
    const status = error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : 400;
    return NextResponse.json({ error: error.message || 'Não foi possível gerar o link.' }, { status });
  }

  const url = new URL(`/cadastro/${token}`, request.url);
  return NextResponse.json({ data: { ...data, url: url.toString() } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
