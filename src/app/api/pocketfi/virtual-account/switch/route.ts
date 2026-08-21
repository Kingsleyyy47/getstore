import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { switchPrimaryAccount } from "@/lib/pocketfi-virtual-account";

/**
 * Customer chose "switch to the new provider" on the Add Funds page's
 * provider-change prompt. Issues a brand new primary virtual account under
 * the admin's current default bank provider; the old account is kept
 * (just no longer primary) so it still credits fine if a transfer ever
 * lands there out of habit.
 */
export async function POST() {
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
    const account = await switchPrimaryAccount(user.id, user.email!, settings.pocketfi_bank_provider);
    return NextResponse.json({ account });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Could not switch providers" }, { status: 502 });
  }
}
