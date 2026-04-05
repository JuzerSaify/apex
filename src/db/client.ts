/**
 * Supabase client singleton for KeepCode CLI.
 *
 * SUPABASE_URL and SUPABASE_ANON_KEY can be overridden by environment variables
 * if you self-host or use a different project.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = process.env['KEEPCODE_SUPABASE_URL']  ?? 'https://zwmsuaklwxdqdgyxpdwr.supabase.co';
const SUPABASE_ANON_KEY = process.env['KEEPCODE_SUPABASE_KEY']  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3bXN1YWtsd3hkcWRneXhwZHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzODg3MTgsImV4cCI6MjA5MDk2NDcxOH0.leZphJnkIICL2n-qCOANrTTO9vB-r6SnpfFpxIhM-4Q';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: 'pkce',
    persistSession: false,  // CLI manages session in its own file
    autoRefreshToken: false,
  },
});

export { SUPABASE_URL };
