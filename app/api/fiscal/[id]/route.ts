import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';
import { uuidPattern } from '@/lib/inventory';
import { fiscalStatus, isNotaasConfigured, notaasRequest, providerError, safeProviderResponse } from '@/lib/notaas';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: 'Documento fiscal inválido.' }, { status: 400 });
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Faça login para continuar.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Configure sua organização.' }, { status: 409 });
  const { data: document } = await supabase.from('fiscal_documents').select('*').eq('organization_id', membership.organization_id).eq('id', id).maybeSingle();
  if (!document) return NextResponse.json({ error: 'Documento fiscal não encontrado.' }, { status: 404 });
  const { data: member } = await supabase.from('unit_memberships').select('role').eq('organization_id', membership.organization_id).eq('unit_id', document.unit_id).eq('user_id', userId).eq('is_active', true).maybeSingle();
  if (!member) return NextResponse.json({ error: 'Unidade não autorizada.' }, { status: 403 });
  if (!isNotaasConfigured()) return NextResponse.json({ error: 'Configure NOTAAS_API_KEY no ambiente do servidor.' }, { status: 503 });
  if (!document.provider_invoice_id) return NextResponse.json({ error: document.error_message || 'A emissão ainda não possui identificador no Notaas.' }, { status: 409 });
  let body: Record<string, unknown> = {};
  try { body = await request.json() as Record<string, unknown>; } catch { /* refresh does not need a body */ }

  if (body.action === 'cancel') {
    if (!['gestor', 'atendimento'].includes(member.role)) return NextResponse.json({ error: 'Seu perfil não pode cancelar uma nota fiscal.' }, { status: 403 });
    if (document.status !== 'issued') return NextResponse.json({ error: 'Somente uma nota autorizada pode ser cancelada.' }, { status: 409 });
    const reason = String(body.reason ?? '').trim();
    if (reason.length < 15 || reason.length > 255) return NextResponse.json({ error: 'Informe um motivo entre 15 e 255 caracteres.' }, { status: 400 });
    const result = await notaasRequest('/nfe/cancelar', { method: 'POST', body: JSON.stringify({ invoiceId: document.provider_invoice_id, motivo: reason }) });
    if (!result.ok) return NextResponse.json({ error: providerError(result.data, `Notaas recusou o cancelamento (${result.status}).`) }, { status: 422 });
    await supabase.from('fiscal_documents').update({ status: 'cancel_pending', provider_response: safeProviderResponse(result.data), error_message: null, updated_at: new Date().toISOString() }).eq('id', id);
    return NextResponse.json({ data: { status: 'cancel_pending' } }, { status: 202 });
  }

  if (body.action && body.action !== 'refresh') return NextResponse.json({ error: 'Ação fiscal inválida.' }, { status: 400 });
  const result = await notaasRequest(`/nfe/invoices/${encodeURIComponent(document.provider_invoice_id)}/status`);
  if (!result.ok) return NextResponse.json({ error: providerError(result.data, `Não foi possível consultar o Notaas (${result.status}).`) }, { status: 502 });
  const status = fiscalStatus(result.data);
  const errorMessage = status === 'error' ? providerError(result.data, 'Documento rejeitado.') : null;
  const update = {
    status,
    access_key: String(result.data.chaveAcesso ?? result.data.accessKey ?? '') || null,
    number: String(result.data.numero ?? result.data.nNf ?? '') || null,
    series: String(result.data.serie ?? '') || null,
    protocol: String(result.data.protocolo ?? result.data.nProt ?? '') || null,
    error_message: errorMessage,
    provider_response: safeProviderResponse(result.data),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('fiscal_documents').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: 'O status foi consultado, mas não pôde ser salvo.' }, { status: 500 });
  return NextResponse.json({ data: update });
}
