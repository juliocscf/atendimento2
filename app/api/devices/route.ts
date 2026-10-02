import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });

  const query = new URL(request.url).searchParams.get('q')?.trim();
  const safeQuery = query?.replace(/[^\p{L}\p{N}@._+\- ]/gu, ' ').trim();
  let builder = supabase
    .from('devices')
    .select('id, client_id, unit_id, code, kind, brand, model, serial, configuration, notes, status, created_at, updated_at')
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (safeQuery) builder = builder.or(`code.ilike.%${safeQuery}%,brand.ilike.%${safeQuery}%,model.ilike.%${safeQuery}%,serial.ilike.%${safeQuery}%`);
  const data = [];
  for (let offset = 0; ; offset += 500) {
    const { data: batch, error } = await builder.range(offset, offset + 499);
    if (error) return NextResponse.json({ error: 'Não foi possível carregar os registros.' }, { status: 500 });
    data.push(...(batch ?? []));
    if (!batch || batch.length < 500) break;
  }
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });

  const body = await request.json().catch(() => null) as { clientId?: string; unitId?: string; kind?: string; brand?: string; model?: string; serial?: string; configuration?: Record<string, unknown>; notes?: string } | null;
  const kind = body?.kind?.trim() ?? '';
  const brand = body?.brand?.trim() ?? '';
  const model = body?.model?.trim() ?? '';
  if (!body?.clientId || kind.length < 2 || brand.length < 2 || model.length < 2) {
    return NextResponse.json({ error: 'Client, type, brand and model are required.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('devices')
    .insert({
      organization_id: membership.organization_id,
      client_id: body.clientId,
      unit_id: body.unitId || membership.unit_id,
      kind,
      brand,
      model,
      serial: body.serial?.trim() || null,
      configuration: body.configuration ?? {},
      notes: body.notes?.trim() || null,
      created_by: userId,
    })
    .select('id, client_id, unit_id, code, kind, brand, model, serial, configuration, notes, status, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}
