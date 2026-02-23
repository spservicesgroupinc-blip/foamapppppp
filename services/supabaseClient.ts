import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://ngcxzdcrvqzgvznepxlo.supabase.co';

// The Supabase JS client requires the legacy JWT anon key (starts with eyJ…),
// NOT the newer sb_publishable_* format.
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nY3h6ZGNydnF6Z3Z6bmVweGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MTU5MjEsImV4cCI6MjA4NzM5MTkyMX0.IQtWwdVbQMiTAa_DvSPFeY1OQelWVHWbA3Nwk3W5guk';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
