import { NextResponse } from 'next/server';
import { isValidCpf, onlyDigits } from '@/lib/pickup-authorization';
import { hashPortalToken } from '@/lib/supabase/portal-token';
import { createPublicClient } from '@/lib/supabase/public';

export const dynamic = 'force-dynamic';

type RequestBody = {
  action?: 'request' | 'verify' | 'cancel';
  authorizedName?: string;
  cpf?: string;
  deliveryChannel?: 'whatsapp' | 'email';
  code?: string;
};

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token.length < 32 || token.length > 128) return NextResponse.json({ error: 'Link de acompanhamento inválido.' }, { status: 400 });
  const body = await request.json().catch(() => null) as RequestBody | null;
  if (!body?.action) return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  const supabase = createPublicClient();
  const tokenHash = hashPortalToken(token);

  if (body.action === 'request') {
    const authorizedName = body.authorizedName?.trim() ?? '';
    const cpf = onlyDigits(body.cpf ?? '');
    if (authorizedName.length < 3 || authorizedName.length > 120) return NextResponse.json({ error: 'Informe o nome completo da pessoa autorizada.' }, { status: 400 });
    if (!isValidCpf(cpf)) return NextResponse.json({ error: 'Informe um CPF válido.' }, { status: 400 });
    if (!body.deliveryChannel || !['whatsapp', 'email'].includes(body.deliveryChannel)) return NextResponse.json({ error: 'Selecione um canal de confirmação.' }, { status: 400 });
    const { data, error } = await supabase.rpc('request_pickup_authorization', { p_token_hash: tokenHash, p_authorized_name: authorizedName, p_cpf: cpf, p_delivery_channel: body.deliveryChannel });
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ data });
  }

  if (body.action === 'verify') {
    const code = onlyDigits(body.code ?? '');
    if (code.length !== 6) return NextResponse.json({ error: 'Informe o código de seis dígitos.' }, { status: 400 });
    const { data, error } = await supabase.rpc('verify_pickup_authorization', { p_token_hash: tokenHash, p_code: code });
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ data });
  }

  const { data, error } = await supabase.rpc('cancel_pickup_authorization_from_portal', { p_token_hash: tokenHash });
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ data });
}
