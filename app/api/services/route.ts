import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';
import { serviceInput } from '@/lib/service-catalog';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Faça login para consultar serviços.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Configure sua organização.' }, { status: 409 });
  let query = supabase.from('service_catalog').select('id, code, name, description, category, default_price_cents, is_active').eq('organization_id', membership.organization_id).order('code');
  if (new URL(request.url).searchParams.get('active') === 'true') query = query.eq('is_active', true);
  const data = [];
  for (let offset = 0; ; offset += 500) {
    const result = await query.range(offset, offset + 499);
    if (result.error) return NextResponse.json({ error: 'Não foi possível consultar o catálogo.' }, { status: 500 });
    data.push(...(result.data ?? []));
    if (!result.data || result.data.length < 500) break;
  }
  return NextResponse.json({ data, canManage: ['gestor', 'atendimento'].includes(membership.role) });
}
async function save(request: Request, editing: boolean) {
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Faça login para salvar serviços.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Configure sua organização.' }, { status: 409 });
  if (!['gestor', 'atendimento'].includes(membership.role)) return NextResponse.json({ error: 'Seu perfil pode consultar, mas não alterar o catálogo.' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const values = serviceInput(body);
  if (!values || (editing && (typeof body?.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id)))) return NextResponse.json({ error: 'Confira código, nome e preço. O código aceita letras, números, hífen e sublinhado.' }, { status: 400 });
  const result = editing
    ? await supabase.from('service_catalog').update(values).eq('id', body.id).eq('organization_id', membership.organization_id).select('*').maybeSingle()
    : await supabase.from('service_catalog').insert({ ...values, organization_id: membership.organization_id }).select('*').single();
  if (result.error) return NextResponse.json({ error: result.error.code === '23505' ? 'Já existe um serviço com este código.' : 'Não foi possível salvar o serviço.' }, { status: 400 });
  if (!result.data) return NextResponse.json({ error: 'Serviço não encontrado.' }, { status: 404 });
  return NextResponse.json({ data: result.data }, { status: editing ? 200 : 201 });
}
export async function POST(request: Request) { return save(request, false); }
export async function PATCH(request: Request) { return save(request, true); }
