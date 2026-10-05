import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { assertSupabaseConfig, supabasePublishableKey, supabaseUrl } from '@/lib/supabase/env';

export function createPublicClient() {
  assertSupabaseConfig();
  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
