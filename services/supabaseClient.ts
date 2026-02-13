import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wkvugxqxwdsrlvexhten.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrdnVneHF4d2Rzcmx2ZXhodGVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4ODgwOTUsImV4cCI6MjA4NjQ2NDA5NX0.EQBduhuO2IHi5YTIW6MsDx9DWsaMg5U1jRpiwPxI5wo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
