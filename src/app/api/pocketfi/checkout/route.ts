import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { initializePayment, splitName } from "@/lib/pocketfi";

/**
 * Starts a PocketFi hosted-checkout top-up: creates a pending
 * topup_requests row (method "pocketfi"), asks PocketFi for a checkout URL,
 * then tags the row with PocketFi's own payment_id (there's no field for
 * passing OUR reference on this endpoint per PocketFi's docs, so their
 * payment_id is the correlator -- see /api/webhooks/pocketfi's comments on
 * how that's matched). The wallet is credited later by that webhook once
 * PocketFi confirms the payment -- this route never touches the wallet.
 *
 * NOT currently linked from any page (the "Pay with card or bank" UI card
 * was removed in favor of virtual accounts only -- see PocketfiTopup.tsx),
 * kept working in case it's wired back up later.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const settings = await getSettings();
  if (!settings.pocketfi_enabled) {
    return NextResponse.json({ error: "Card/bank top-ups are not available right now" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .single();

  // PocketFi requires a phone number; unlike the virtual-account flow this
  // route has no inline "ask for it" UI (it's currently unused -- see
  // comment above), so just point the customer at the flow that collects
  // one rather than guessing.
  if (!profile?.phone) {
    return NextResponse.json(
      { error: "Add a phone number first via the Bank transfer option, then try again." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  const amountNaira = Number(body?.amount);
  if (!Number.isFinite(amountNaira) || amountNaira <= 0) {
    return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
  }

  const amount_cents = Math.round(amountNaira * 100);

  const { data: topup, error: insertErr } = await admin
    .from("topup_requests")
    .insert({
      user_id: user.id,
      amount_cents,
      method: "pocketfi",
      status: "pending",
    })
    .select()
    .single();

  if (insertErr || !topup) {
    return NextResponse.json({ error: insertErr?.message ?? "Could not start top-up" }, { status: 500 });
  }

  try {
    const origin = new URL(req.url).origin;
    const { firstName, lastName } = splitName(profile.full_name, user.email!.split("@")[0]);
    const { checkoutUrl, paymentId } = await initializePayment({
      amountNaira,
      email: user.email!,
      firstName,
      lastName,
      phone: profile.phone,
      redirectLink: `${origin}/dashboard/topup?success=1`,
    });

    await admin.from("topup_requests").update({ provider_reference: paymentId }).eq("id", topup.id);

    return NextResponse.json({ checkoutUrl });
  } catch (err: any) {
    // Roll the pending row back to rejected so it doesn't sit as a
    // dangling "pending" request the customer never actually paid for.
    await admin
      .from("topup_requests")
      .update({ status: "rejected" })
      .eq("id", topup.id);

    return NextResponse.json({ error: err?.message ?? "Could not reach PocketFi" }, { status: 502 });
  }
}
