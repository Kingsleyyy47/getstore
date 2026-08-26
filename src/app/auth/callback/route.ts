import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Lands here from Supabase auth email links (password reset, and email
 * confirmation if that's ever turned on) -- Supabase appends a one-time
 * `code` param, which gets exchanged for a real session cookie via PKCE.
 * `next` controls where the user ends up afterward; the "forgot password"
 * flow points this at /reset-password (see forgot-password/actions.ts).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent("That link has expired -- request a new one.")}`, url.origin)
      );
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
