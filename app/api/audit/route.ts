import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { supabase, userId, membership } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  if (!membership) return NextResponse.json({ error: 'Complete your organization setup first.' }, { status: 409 });
  if (membership.role !== 'gestor') return NextResponse.json({ error: 'Only organization managers can view audit events.' }, { status: 403 });

  const rawLimit = new URL(request.url).searchParams.get('limit');
  const limit = Math.min(Math.max(Number(rawLimit) || 10, 1), 50);
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, action, entity_type, metadata, created_at')
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data ?? [] });
}
