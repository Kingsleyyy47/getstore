import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { createVirtualAccount } from "@/lib/pocketfi";

/**
 * Returns the signed-in customer's dedicated PocketFi virtual account,
 * creating one on first call. Funds sent to this account number are
 * credited automatically via /api/webhooks/pocketfi -- no checkout flow,
 * no admin approval.
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

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("pocketfi_virtual_accounts")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) return NextResponse.json({ account: existing });

  const { data: profile } = await admin.from("profiles").select("full_name, email").eq("id", user.id).single();

  try {
    const created = await createVirtualAccount({
      email: profile?.email ?? user.email!,
      fullName: profile?.full_name ?? user.email!,
      userId: user.id,
    });

    const { data: saved, error: saveErr } = await admin
      .from("pocketfi_virtual_accounts")
      .insert({
        user_id: user.id,
        provider_account_id: created.providerAccountId,
        account_number: created.accountNumber,
        bank_name: created.bankName,
        account_name: created.accountName,
      })
      .select()
      .single();

    if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 });
    return NextResponse.json({ account: saved });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Could not create a virtual account" }, { status: 502 });
  }
}
