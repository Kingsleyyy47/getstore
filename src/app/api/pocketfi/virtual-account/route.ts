import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { getOrCreatePrimaryAccount } from "@/lib/pocketfi-virtual-account";

/**
 * Returns the signed-in customer's primary PocketFi virtual account,
 * creating one on first call. Funds sent to this account number are
 * credited automatically via /api/webhooks/pocketfi -- no checkout flow,
 * no admin approval.
 *
 * Also flags `promptNewProvider` when the admin has switched the site-wide
 * default bank provider (Admin -> Settings) since this account was issued
 * and the customer hasn't already said "keep my current one" for that
 * exact change -- the frontend then offers a choice: keep the existing
 * account (POST .../keep) or get a new one on the new provider
 * (POST .../switch). See src/lib/pocketfi-virtual-account.ts for the
 * mechanics -- switching never deletes the old account, so it keeps
 * working if money ever lands on it anyway.
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const settings = await getSettings();
  if (!settings.pocketfi_enabled) {
    return NextResponse.json({ error: "Bank transfer top-ups are not available right now" }, { status: 403 });
  }

  try {
    const { account, promptNewProvider } = await getOrCreatePrimaryAccount(
      user.id,
      user.email!,
      settings.pocketfi_bank_provider
    );
    return NextResponse.json({ account, promptNewProvider });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Could not create a virtual account" }, { status: 502 });
  }
}
