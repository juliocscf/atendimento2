import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';

const timezones = new Set(['America/Sao_Paulo', 'America/Manaus', 'America/Noronha']);

function manager(role: string) {
  return role === 'gestor';
}

export async function GET() {
  const context = await getRequestContext();
  if (!context) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (!context.membership) return NextResponse.json({ error: 'Nenhuma unidade ativa encontrada.' }, { status: 403 });
  const { supabase, membership, userId } = context;
  const [{ data: organization, error: organizationError }, { data: unit, error: unitError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from('organizations').select('name,timezone,third_party_pickup_enabled').eq('id', membership.organization_id).maybeSingle(),
    supabase.from('units').select('name').eq('id', membership.unit_id).maybeSingle(),
    supabase.from('profiles').select('phone').eq('id', userId).maybeSingle(),
  ]);
  if (organizationError || unitError || profileError) return NextResponse.json({ error: 'Não foi possível carregar as configurações.' }, { status: 500 });
  return NextResponse.json({ data: { organizationName: organization?.name ?? '', unitName: unit?.name ?? '', phone: profile?.phone ?? '', timezone: organization?.timezone ?? 'America/Sao_Paulo', thirdPartyPickupEnabled: organization?.third_party_pickup_enabled ?? false, role: membership.role } });
}

export async function PATCH(request: Request) {
  const context = await getRequestContext();
  if (!context) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (!context.membership) return NextResponse.json({ error: 'Nenhuma unidade ativa encontrada.' }, { status: 403 });
  if (!manager(context.membership.role)) return NextResponse.json({ error: 'Apenas gestores podem alterar as configurações.' }, { status: 403 });
  const body = await request.json() as { organizationName?: string; unitName?: string; phone?: string; timezone?: string; thirdPartyPickupEnabled?: boolean };
  const organizationName = body.organizationName?.trim() ?? '';
  const unitName = body.unitName?.trim() ?? '';
  const phone = body.phone?.trim() ?? '';
  const timezone = body.timezone ?? '';
  const thirdPartyPickupEnabled = body.thirdPartyPickupEnabled;
  if (organizationName.length < 3 || unitName.length < 2 || phone.length < 8 || !timezones.has(timezone) || typeof thirdPartyPickupEnabled !== 'boolean') return NextResponse.json({ error: 'Revise os campos da assistência antes de salvar.' }, { status: 400 });
  const { supabase, membership, userId } = context;
  const [{ error: organizationError }, { error: unitError }, { error: profileError }, { error: securitySettingError }] = await Promise.all([
    supabase.from('organizations').update({ name: organizationName, timezone }).eq('id', membership.organization_id),
    supabase.from('units').update({ name: unitName }).eq('id', membership.unit_id),
    supabase.from('profiles').update({ phone }).eq('id', userId),
    supabase.rpc('set_third_party_pickup_enabled', { p_organization_id: membership.organization_id, p_enabled: thirdPartyPickupEnabled }),
  ]);
  if (organizationError || unitError || profileError || securitySettingError) return NextResponse.json({ error: securitySettingError?.message ?? 'Não foi possível salvar as configurações.' }, { status: 500 });
  return NextResponse.json({ data: { organizationName, unitName, phone, timezone, thirdPartyPickupEnabled } });
}
