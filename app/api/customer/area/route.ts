import { NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/request-context';
export const dynamic = 'force-dynamic';
export async function GET() {
  const { supabase, userId } = await getRequestContext();
  if (!userId) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 });
  const { data, error } = await supabase.rpc('customer_area_claim');
  if (error) return NextResponse.json({ error: 'Não foi possível carregar sua área.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Nenhum cadastro de cliente foi encontrado para este acesso.' }, { status: 404 });
  return NextResponse.json({ data });
}
