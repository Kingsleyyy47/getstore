"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Supabase client for use in Client Components. Uses the public anon key,
 * so it's subject to Row Level Security — safe to use in the browser. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
