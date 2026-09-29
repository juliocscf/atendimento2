export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabasePublishableKey && !supabasePublishableKey.endsWith('replace_me'));
}

export function assertSupabaseConfig() {
  if (!hasSupabaseConfig()) {
    throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  }
}
