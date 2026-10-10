import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';
import { uuidPattern } from '@/lib/inventory';
import { isNotaasConfigured } from '@/lib/notaas';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: 'Documento fiscal inválido.' }, { status: 400 });
  const type = new URL(request.url).searchParams.get('type');
  if (!['danfe', 'xml'].includes(type ?? '')) return NextResponse.json({ error: 'Tipo de documento inválido.' }, { status: 400 });
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId || !membership) return NextResponse.json({ error: 'Faça login para continuar.' }, { status: 401 });
  const { data: document } = await supabase.from('fiscal_documents').select('unit_id, status, provider_invoice_id, number').eq('organization_id', membership.organization_id).eq('id', id).maybeSingle();
  if (!document) return NextResponse.json({ error: 'Documento fiscal não encontrado.' }, { status: 404 });
  const { data: member } = await supabase.from('unit_memberships').select('role').eq('organization_id', membership.organization_id).eq('unit_id', document.unit_id).eq('user_id', userId).eq('is_active', true).maybeSingle();
  if (!member) return NextResponse.json({ error: 'Unidade não autorizada.' }, { status: 403 });
  if (!isNotaasConfigured() || !document.provider_invoice_id || !['issued', 'cancelled'].includes(document.status)) return NextResponse.json({ error: 'Documento ainda não está disponível.' }, { status: 409 });
  const baseUrl = (process.env.NOTAAS_BASE_URL?.trim() || 'https://platform.notaas.com.br/api/v1').replace(/\/$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${baseUrl}/nfe/invoices/${encodeURIComponent(document.provider_invoice_id)}/${type}`, { cache: 'no-store', signal: controller.signal, headers: { 'x-api-key': process.env.NOTAAS_API_KEY!.trim() } });
    if (!response.ok || !response.body) return NextResponse.json({ error: 'Não foi possível baixar o documento no Notaas.' }, { status: response.status || 502 });
    const extension = type === 'danfe' ? 'pdf' : 'xml';
    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || (type === 'danfe' ? 'application/pdf' : 'application/xml'),
        'Content-Disposition': `inline; filename="${type}-${document.number || id.slice(0, 8)}.${extension}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'O Notaas demorou para responder. Tente novamente.' }, { status: 504 });
  } finally {
    clearTimeout(timer);
  }
}
