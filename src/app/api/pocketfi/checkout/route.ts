import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { initializePayment } from "@/lib/pocketfi";

/**
 * Starts a PocketFi hosted-checkout top-up: creates a pending
 * topup_requests row (method "pocketfi") tagged with our own reference,
 * then asks PocketFi for a checkout URL to redirect the customer to. The
 * wallet is credited later by /api/webhooks/pocketfi once PocketFi
 * confirms the payment -- this route never touches the wallet.
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

  const body = await req.json().catch(() => null);
  const amountNaira = Number(body?.amount);
  if (!Number.isFinite(amountNaira) || amountNaira <= 0) {
    return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
  }

  const amount_cents = Math.round(amountNaira * 100);
  const ourReference = `getstore_${randomUUID()}`;

  const { data: topup, error: insertErr } = await admin
    .from("topup_requests")
    .insert({
      user_id: user.id,
      amount_cents,
      method: "pocketfi",
      status: "pending",
      provider_reference: ourReference,
    })
    .select()
    .single();

  if (insertErr || !topup) {
    return NextResponse.json({ error: insertErr?.message ?? "Could not start top-up" }, { status: 500 });
  }

  try {
    const origin = new URL(req.url).origin;
    const { checkoutUrl } = await initializePayment({
      amountNaira,
      email: user.email!,
      reference: ourReference,
      callbackUrl: `${origin}/dashboard/topup?success=1`,
      metadata: { topup_id: topup.id, user_id: user.id },
    });

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
