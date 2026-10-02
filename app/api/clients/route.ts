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
    .select('id, full_name, phone, email, tax_id, document_type, legal_name, trade_name, notes, status, created_at, updated_at')
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (safeQuery) builder = builder.or(`full_name.ilike.%${safeQuery}%,phone.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%`);
  const data = [];
  for (let offset = 0; ; offset += 500) {
    const { data: batch, error } = await builder.range(offset, offset + 499);
    if (error) return NextResponse.json({ error: 'Não foi possível carregar os registros.' }, { status: 500 });
    data.push(...(batch ?? []));
    if (!batch || batch.length < 500) break;
  }
  const clientIds = (data ?? []).map(client => client.id);
  const addressByClient = new Map();
  for (let offset = 0; offset < clientIds.length; offset += 100) {
    const { data: addresses, error } = await supabase.from('client_addresses').select('client_id, street, number, complement, neighborhood, city, state, postal_code').eq('organization_id', membership.organization_id).eq('is_primary', true).in('client_id', clientIds.slice(offset, offset + 100));
    if (error) return NextResponse.json({ error: 'Não foi possível carregar os endereços.' }, { status: 500 });
    for (const address of addresses ?? []) addressByClient.set(address.client_id, address);
  }
  return NextResponse.json({ data: (data ?? []).map(client => ({ ...client, address: addressByClient.get(client.id) ?? null })) });
}

type ProfileBody = { id?: string; fullName?: string; phone?: string; email?: string; taxId?: string; documentType?: BrazilianDocumentType; legalName?: string; tradeName?: string; notes?: string; address?: Record<string, string>; devices?: Array<{ kind: string; brand: string; model: string; serial?: string; notes?: string }> };

async function save(request: Request, editing: boolean) {
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Autenticação necessária.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Conclua a configuração da organização.' }, { status: 409 });
  if (!['gestor', 'atendimento'].includes(membership.role)) return NextResponse.json({ error: 'Sem permissão para editar clientes.' }, { status: 403 });
  const body = await request.json().catch(() => null) as ProfileBody | null;
  if (!body || ['fullName', 'phone', 'email', 'taxId', 'documentType', 'legalName', 'tradeName', 'notes'].some(key => body[key as keyof ProfileBody] !== undefined && typeof body[key as keyof ProfileBody] !== 'string')) return NextResponse.json({ error: 'Dados de cadastro inválidos.' }, { status: 400 });
  if (editing && (typeof body.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id))) return NextResponse.json({ error: 'Cliente inválido.' }, { status: 400 });
  const documentType = body.documentType === 'cnpj' ? 'cnpj' : 'cpf';
  const taxId = onlyDigits(body.taxId ?? '');
  const fullName = body.fullName?.trim() ?? '';
  const phone = body.phone?.trim() ?? '';
  let legacyDocument = false;
  if (editing) {
    const { data: existing, error } = await supabase.from('clients').select('tax_id').eq('id', body.id!).eq('organization_id', membership.organization_id).maybeSingle();
    if (error) return NextResponse.json({ error: 'Não foi possível consultar o cadastro.' }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 });
    legacyDocument = !existing.tax_id && !taxId;
  }
  if (fullName.length < 3 || onlyDigits(phone).length < 8 || (!legacyDocument && !isValidBrazilianDocument(documentType, taxId))) return NextResponse.json({ error: 'Informe nome, telefone e documento válidos.' }, { status: 400 });
  const email = body.email?.trim() ?? '';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 });
  if (body.address && (typeof body.address !== 'object' || Array.isArray(body.address) || Object.values(body.address).some(value => typeof value !== 'string'))) return NextResponse.json({ error: 'Endereço inválido.' }, { status: 400 });
  const address = { ...body.address, postalCode: onlyDigits(body.address?.postalCode ?? '') };
  if (address.postalCode && address.postalCode.length !== 8) return NextResponse.json({ error: 'Informe um CEP com 8 dígitos.' }, { status: 400 });
  if (body.address?.state && !/^[A-Z]{2}$/.test(body.address.state)) return NextResponse.json({ error: 'Informe uma UF válida.' }, { status: 400 });
  const devices = body.devices ?? [];
  if (!Array.isArray(devices) || devices.length > 10 || devices.some(device => !device || typeof device !== 'object' || ['kind', 'brand', 'model'].some(key => typeof device[key as keyof typeof device] !== 'string' || (device[key as keyof typeof device]?.trim().length ?? 0) < 2) || ['serial', 'notes'].some(key => device[key as keyof typeof device] !== undefined && typeof device[key as keyof typeof device] !== 'string'))) {
    return NextResponse.json({ error: 'Informe tipo, marca e modelo de cada equipamento (até 10).' }, { status: 400 });
  }
  const profile = { ...body, fullName, phone, email, documentType, taxId, address };
  const { data, error } = devices.length
    ? await supabase.rpc('save_client_with_devices', { p_organization_id: membership.organization_id, p_unit_id: membership.unit_id, p_client_id: editing ? body.id : null, p_profile: profile, p_devices: devices.map(device => ({ kind: device.kind.trim(), brand: device.brand.trim(), model: device.model.trim(), serial: device.serial?.trim() ?? '', notes: device.notes?.trim() ?? '' })) })
    : await supabase.rpc('save_client_profile', { p_organization_id: membership.organization_id, p_client_id: editing ? body.id : null, p_profile: profile });
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'Já existe um cliente com este documento.' : error.code === '42501' ? 'Sem permissão para salvar este cadastro.' : error.code === '22023' ? 'Confira os dados dos equipamentos.' : 'Não foi possível salvar o cliente e seus equipamentos. Nenhuma alteração foi gravada.' }, { status: error.code === '23505' ? 409 : error.code === '42501' ? 403 : 400 });
  return NextResponse.json({ data }, { status: editing ? 200 : 201 });
}

export async function POST(request: Request) { return save(request, false); }
export async function PATCH(request: Request) { return save(request, true); }
