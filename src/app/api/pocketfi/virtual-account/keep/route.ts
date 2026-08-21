import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { dismissProviderPrompt } from "@/lib/pocketfi-virtual-account";

/**
 * Customer chose "keep my current account" on the Add Funds page's
 * provider-change prompt. Records that they've been asked about this
 * exact admin-set default provider, so the prompt doesn't come back until
 * the admin changes the default to something else again.
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const settings = await getSettings();
  await dismissProviderPrompt(user.id, settings.pocketfi_bank_provider);

  return NextResponse.json({ ok: true });
}
