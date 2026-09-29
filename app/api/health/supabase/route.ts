import { NextResponse } from 'next/server';
import { hasSupabaseConfig } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      { service: 'supabase', configured: false, reachable: false, message: 'Supabase environment variables are missing.' },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from('organizations').select('id').limit(1);

  return NextResponse.json(
    {
      service: 'supabase',
      configured: true,
      reachable: !error,
      readOnlyProbe: true,
      rowsVisible: data?.length ?? 0,
      error: error?.message ?? null,
    },
    { status: error ? 503 : 200 },
  );
}
