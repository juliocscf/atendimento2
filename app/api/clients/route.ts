import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';
import { isValidBrazilianDocument, onlyDigits, type BrazilianDocumentType } from '@/lib/brazil-documents';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });

  const query = new URL(request.url).searchParams.get('q')?.trim();
  const safeQuery = query?.replace(/[^\p{L}\p{N}@._+\- ]/gu, ' ').trim();
  let builder = supabase
    .from('clients')
    .select('id, full_name, phone, email, tax_id, document_type, legal_name, trade_name, status, created_at, updated_at')
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (safeQuery) builder = builder.or(`full_name.ilike.%${safeQuery}%,phone.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%`);
  const { data, error } = await builder;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const clientIds = (data ?? []).map(client => client.id);
  const { data: addresses } = clientIds.length ? await supabase.from('client_addresses').select('client_id, street, number, complement, neighborhood, city, state, postal_code').eq('organization_id', membership.organization_id).eq('is_primary', true).in('client_id', clientIds) : { data: [] };
  const addressByClient = new Map((addresses ?? []).map(address => [address.client_id, address]));
  return NextResponse.json({ data: (data ?? []).map(client => ({ ...client, address: addressByClient.get(client.id) ?? null })) });
}

export async function POST(request: Request) {
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });

  const body = await request.json().catch(() => null) as { fullName?: string; phone?: string; email?: string; taxId?: string; documentType?: BrazilianDocumentType; legalName?: string; tradeName?: string; notes?: string; address?: { postalCode?: string; street?: string; number?: string; complement?: string; neighborhood?: string; city?: string; state?: string } } | null;
  const documentType = body?.documentType === 'cnpj' ? 'cnpj' : 'cpf';
  const taxId = onlyDigits(body?.taxId ?? '');
  const fullName = body?.fullName?.trim() || body?.tradeName?.trim() || body?.legalName?.trim() || '';
  const phone = body?.phone?.trim() ?? '';
  if (fullName.length < 3 || phone.length < 8 || !isValidBrazilianDocument(documentType, taxId)) {
    return NextResponse.json({ error: `Informe nome, telefone e um ${documentType.toUpperCase()} válido.` }, { status: 400 });
  }

  const { data: existing } = await supabase.from('clients').select('id').eq('organization_id', membership.organization_id).eq('tax_id', taxId).maybeSingle();
  if (existing) return NextResponse.json({ error: 'Já existe um cliente com este documento.' }, { status: 409 });

  const { data, error } = await supabase
    .from('clients')
    .insert({
      organization_id: membership.organization_id,
      full_name: fullName,
      phone,
      email: body?.email?.trim() || null,
      tax_id: taxId,
      document_type: documentType,
      legal_name: body?.legalName?.trim() || null,
      trade_name: body?.tradeName?.trim() || null,
      notes: body?.notes?.trim() || null,
      created_by: userId,
    })
    .select('id, full_name, phone, email, tax_id, document_type, legal_name, trade_name, status, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const address = body?.address;
  const hasAddress = Boolean(address && Object.values(address).some(value => value?.trim()));
  if (hasAddress) {
    const { error: addressError } = await supabase.from('client_addresses').insert({
      organization_id: membership.organization_id,
      client_id: data.id,
      label: 'Principal',
      street: address?.street?.trim() || 'Não informado',
      number: address?.number?.trim() || null,
      complement: address?.complement?.trim() || null,
      neighborhood: address?.neighborhood?.trim() || null,
      city: address?.city?.trim() || null,
      state: address?.state?.trim() || null,
      postal_code: onlyDigits(address?.postalCode ?? '') || null,
      is_primary: true,
    });
    if (addressError) return NextResponse.json({ error: 'Cliente criado, mas não foi possível salvar o endereço.' }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
