import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses Row Level Security entirely.
 *
 * SERVER-ONLY. Never import this into a Client Component or expose
 * SUPABASE_SERVICE_ROLE_KEY to the browser. Every call site that uses this
 * client must independently verify the caller's identity and role (via the
 * regular session-scoped client) BEFORE performing the privileged action —
 * this client itself does not check who's calling.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
