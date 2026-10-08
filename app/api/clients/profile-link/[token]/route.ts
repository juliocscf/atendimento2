import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hashPortalToken } from '@/lib/supabase/portal-token';
import { isValidBrazilianDocument, onlyDigits, type BrazilianDocumentType } from '@/lib/brazil-documents';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{40,128}$/.test(token)) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Dados de cadastro inválidos.' }, { status: 400 });

  const documentType: BrazilianDocumentType = body.documentType === 'cnpj' ? 'cnpj' : 'cpf';
  const profile = {
    fullName: typeof body.fullName === 'string' ? body.fullName : '',
    phone: typeof body.phone === 'string' ? body.phone : '',
    email: typeof body.email === 'string' ? body.email : '',
    taxId: typeof body.taxId === 'string' ? body.taxId : '',
    documentType,
    legalName: typeof body.legalName === 'string' ? body.legalName : '',
    tradeName: typeof body.tradeName === 'string' ? body.tradeName : '',
    notes: typeof body.notes === 'string' ? body.notes : '',
    address: body.address && typeof body.address === 'object' && !Array.isArray(body.address)
      ? Object.fromEntries(Object.entries(body.address).map(([key, value]) => [key, typeof value === 'string' ? value : '']))
      : {},
  };
  const taxId = onlyDigits(profile.taxId);
  if (taxId && !isValidBrazilianDocument(profile.documentType, taxId)) return NextResponse.json({ error: `${profile.documentType === 'cnpj' ? 'CNPJ' : 'CPF'} inválido.` }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('save_client_profile_link', {
    p_token_hash: hashPortalToken(token),
    p_profile: profile,
  });
  if (error) {
    const status = error.code === 'P0001' ? 410 : error.code === '23505' ? 409 : 400;
    const message = error.code === 'P0001'
      ? 'Este link não está mais disponível.'
      : error.code === '23505'
        ? 'Já existe um cliente com este documento.'
        : error.code === '22023'
          ? error.message
          : 'Não foi possível salvar o cadastro.';
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ data }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
