import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import * as daisysms from "@/lib/daisysms";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const rentalId = body?.rentalId;
  if (!rentalId) return NextResponse.json({ error: "rentalId is required" }, { status: 400 });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: rental, error } = await supabase
    .from("rentals")
    .select("*")
    .eq("id", rentalId)
    .eq("provider", "daisysms")
    .single();

  if (error || !rental) return NextResponse.json({ error: "Rental not found" }, { status: 404 });

  if (rental.status !== "waiting") {
    return NextResponse.json({ error: "Only rentals still waiting for a code can be cancelled" }, { status: 400 });
  }

  try {
    await daisysms.cancelRental(rental.external_id);
  } catch (e) {
    const message = e instanceof daisysms.DaisySMSError ? e.message : "Failed to cancel rental";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const admin = createAdminClient();

  const { data: wallet } = await admin
    .from("wallets")
    .select("balance_cents")
    .eq("user_id", rental.user_id)
    .single();

  const balanceCents = wallet?.balance_cents ?? 0;
  const refundedCents = rental.price_cents;
  const newBalanceCents = balanceCents + refundedCents;

  await admin
    .from("wallets")
    .update({ balance_cents: newBalanceCents, updated_at: new Date().toISOString() })
    .eq("user_id", rental.user_id);

  await admin.from("wallet_transactions").insert({
    user_id: rental.user_id,
    type: "refund",
    amount_cents: refundedCents,
    balance_after_cents: newBalanceCents,
    description: `Refund for cancelled ${rental.service} rental +${rental.phone}`,
    related_rental_id: rental.id,
  });

  const { data: updated } = await admin
    .from("rentals")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", rentalId)
    .select()
    .single();

  return NextResponse.json({ rental: updated ?? rental });
}
