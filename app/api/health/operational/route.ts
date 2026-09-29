import { NextResponse } from 'next/server';
import { hasSupabaseConfig } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const checks = ['organizations', 'service_orders', 'quotes', 'service_order_payments', 'appointments', 'remote_sessions', 'appointment_events'] as const;

export async function GET() {
  if (!hasSupabaseConfig()) return NextResponse.json({ service: 'operational', configured: false, reachable: false, checks: [] }, { status: 503 });
  const supabase = await createClient();
  const results = await Promise.all(checks.map(async table => {
    const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
    return { table, reachable: !error, visibleRows: count ?? 0, error: error?.message ?? null };
  }));
  const reachable = results.every(result => result.reachable);
  return NextResponse.json({ service: 'operational', configured: true, reachable, readOnlyProbe: true, checks: results }, { status: reachable ? 200 : 503 });
}
