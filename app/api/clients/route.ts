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
    .from('clients')
    .select('id, full_name, phone, email, tax_id, status, created_at, updated_at')
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (safeQuery) builder = builder.or(`full_name.ilike.%${safeQuery}%,phone.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%`);
  const { data, error } = await builder;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });

  const body = await request.json().catch(() => null) as { fullName?: string; phone?: string; email?: string; taxId?: string; notes?: string } | null;
  const fullName = body?.fullName?.trim() ?? '';
  const phone = body?.phone?.trim() ?? '';
  if (fullName.length < 3 || phone.length < 8) {
    return NextResponse.json({ error: 'Full name and a valid phone are required.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({
      organization_id: membership.organization_id,
      full_name: fullName,
      phone,
      email: body?.email?.trim() || null,
      tax_id: body?.taxId?.trim() || null,
      notes: body?.notes?.trim() || null,
      created_by: userId,
    })
    .select('id, full_name, phone, email, tax_id, status, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}
