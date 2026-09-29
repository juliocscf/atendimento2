import { createBrowserClient } from '@supabase/ssr';
import { assertSupabaseConfig, supabasePublishableKey, supabaseUrl } from '@/lib/supabase/env';

export function createClient() {
  assertSupabaseConfig();
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
