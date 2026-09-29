import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (membership) return NextResponse.json({ error: 'This user already belongs to an organization.' }, { status: 409 });

  const body = await request.json().catch(() => null) as { organizationName?: string; unitName?: string; slug?: string } | null;
  const organizationName = body?.organizationName?.trim() ?? '';
  const unitName = body?.unitName?.trim() ?? '';
  if (organizationName.length < 3 || unitName.length < 2) {
    return NextResponse.json({ error: 'Organization and unit names are required.' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('create_initial_organization', {
    p_name: organizationName,
    p_unit_name: unitName,
    p_slug: body?.slug?.trim() || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}
