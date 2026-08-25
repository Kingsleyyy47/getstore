import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import * as daisysms from "@/lib/daisysms";
import { refundRental } from "@/lib/rentals";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rentalId = searchParams.get("id");
  if (!rentalId) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // RLS: only the owner, or an admin, can select this row.
  const { data: rental, error } = await supabase
    .from("rentals")
    .select("*")
    .eq("id", rentalId)
    .eq("provider", "daisysms")
    .single();

  if (error || !rental) {
    return NextResponse.json({ error: "Rental not found" }, { status: 404 });
  }

  if (rental.status === "done" || rental.status === "cancelled" || rental.status === "expired") {
    return NextResponse.json({ rental });
  }

  let result;
  try {
    result = await daisysms.getStatus(rental.external_id, true);
  } catch (e) {
    const message = e instanceof daisysms.DaisySMSError ? e.message : "Failed to check status";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (result.status === "STATUS_WAIT_CODE") {
    return NextResponse.json({ rental });
  }

  const admin = createAdminClient();

  if (result.status === "STATUS_OK") {
    const { data: updated } = await admin
      .from("rentals")
      .update({
        status: "received",
        code: result.code,
        full_text: result.fullText ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rentalId)
      .select()
      .single();
    return NextResponse.json({ rental: updated ?? rental });
  }

  if (result.status === "STATUS_CANCEL") {
    // DaisySMS itself cancelled this rental (not the customer) -- reflect
    // that immediately and refund right away, same as a customer-initiated
    // cancel. The "status" = "waiting" guard makes this atomic against a
    // concurrent customer /cancel call, so it's never refunded twice.
    const { data: updated } = await admin
      .from("rentals")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", rentalId)
      .eq("status", "waiting")
      .select()
      .single();
    if (updated) {
      await refundRental(admin, updated, `Refund -- DaisySMS cancelled ${rental.service} rental +${rental.phone}`);
    }
    return NextResponse.json({ rental: updated ?? rental });
  }

  return NextResponse.json({ rental });
}
