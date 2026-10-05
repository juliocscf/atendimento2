import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';

export const dynamic = 'force-dynamic';

const methods = ['presencial', 'telefone', 'whatsapp', 'email', 'outro'] as const;

export async function POST(request: Request, { params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });

  const body = await request.json().catch(() => null) as {
    method?: string;
    customerName?: string;
    note?: string;
    evidenceUrl?: string;
  } | null;
  const method = body?.method?.trim().toLowerCase() ?? '';
  const customerName = body?.customerName?.trim() ?? '';
  const note = body?.note?.trim() || null;
  const evidenceUrl = body?.evidenceUrl?.trim() || null;

  if (!methods.includes(method as typeof methods[number])) return NextResponse.json({ error: 'Informe como o cliente autorizou o orçamento.' }, { status: 400 });
  if (customerName.length < 3 || customerName.length > 120) return NextResponse.json({ error: 'Informe o nome da pessoa que autorizou.' }, { status: 400 });
  if (['telefone', 'outro'].includes(method) && (!note || note.length < 8)) return NextResponse.json({ error: 'Descreva brevemente como a autorização foi confirmada.' }, { status: 400 });
  if (note && (note.length < 3 || note.length > 1000)) return NextResponse.json({ error: 'A observação deve ter entre 3 e 1000 caracteres.' }, { status: 400 });
  if (evidenceUrl && !/^https?:\/\//i.test(evidenceUrl)) return NextResponse.json({ error: 'O link da evidência precisa começar com http:// ou https://.' }, { status: 400 });

  const { data, error } = await supabase.rpc('register_manual_quote_approval', {
    p_quote_id: quoteId,
    p_method: method,
    p_customer_name: customerName,
    p_note: note,
    p_evidence_url: evidenceUrl,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : 400 });
  return NextResponse.json({ data });
}
