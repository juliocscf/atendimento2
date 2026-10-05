import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';
export async function POST(request: Request) {
  const { supabase, userId } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  const body = await request.json().catch(() => null) as { channel?: string; newContact?: string } | null;
  if (!body || !['phone','email'].includes(body.channel ?? '') || typeof body.newContact !== 'string' || body.newContact.trim().length < 5) return NextResponse.json({ error: 'Informe um contato válido.' }, { status: 400 });
  const { data: area } = await supabase.rpc('customer_area_claim');
  if (!area?.organization_id) return NextResponse.json({ error: 'Cadastro não encontrado.' }, { status: 404 });
  const { error } = await supabase.from('customer_contact_requests').insert({ customer_user_id: userId, organization_id: area.organization_id, client_id: area.client_id, channel: body.channel, new_contact: body.newContact.trim() });
  if (error) return NextResponse.json({ error: 'Não foi possível solicitar a alteração.' }, { status: 400 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
