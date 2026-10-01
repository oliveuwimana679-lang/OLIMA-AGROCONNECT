import { createClient } from '@supabase/supabase-js';
import { setAuthTokenGetter } from '@workspace/api-client-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

try {
  const parsedUrl = new URL(supabaseUrl);
  if (parsedUrl.protocol !== 'https:' && parsedUrl.hostname !== 'localhost') {
    throw new Error();
  }
} catch {
  throw new Error('VITE_SUPABASE_URL must be a valid HTTPS Supabase project URL.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);

setAuthTokenGetter(async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.access_token ?? null;
});