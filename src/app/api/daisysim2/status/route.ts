import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import * as daisysim2 from "@/lib/daisysim2";
import { refundRental } from "@/lib/rentals";
import { normalizeUsPhone } from "@/lib/types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rentalId = searchParams.get("id");
  if (!rentalId) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: rental, error } = await supabase
    .from("rentals")
    .select("*")
    .eq("id", rentalId)
    .eq("provider", "daisysim2")
    .single();

  if (error || !rental) {
    return NextResponse.json({ error: "Rental not found" }, { status: 404 });
  }

  if (rental.status === "done" || rental.status === "cancelled" || rental.status === "expired") {
    return NextResponse.json({ rental });
  }

  let result;
  try {
    result = await daisysim2.checkStatus(rental.external_id);
  } catch (e) {
    const message = e instanceof daisysim2.DaisySim2Error ? e.message : "Failed to check status";
    return NextResponse.json({ rental, warning: `Could not verify this rental with Getatext: ${message}` });
  }

  // A provider dashboard may show a different active rental on the same
  // account. Only compare numbers when Getatext confirms this rental's ID.
  if (result.activation_id !== rental.external_id) {
    return NextResponse.json({ rental, warning: "Getatext returned a different rental ID. Please contact support." });
  }

  const providerPhone = String(result.phone_number ?? "").trim();
  const normalizedProviderPhone = normalizeUsPhone(providerPhone);
  const storedPhone = normalizeUsPhone(rental.phone);
  const correctedPhone = normalizedProviderPhone && normalizedProviderPhone !== storedPhone
    ? providerPhone
    : null;
  const admin = createAdminClient();

  if (result.status === "Waiting") {
    if (correctedPhone) {
      const { data: updated, error: updateError } = await admin
        .from("rentals")
        .update({ phone: correctedPhone })
        .eq("id", rentalId)
        .eq("external_id", rental.external_id)
        .select()
        .single();
      if (updateError) return NextResponse.json({ error: "Could not sync the provider number" }, { status: 500 });
      return NextResponse.json({ rental: updated });
    }
    return NextResponse.json({ rental });
  }

  if (result.status === "Completed") {
    const { data: updated } = await admin
      .from("rentals")
      .update({
        status: "received",
        code: result.code,
        ...(correctedPhone ? { phone: correctedPhone } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", rentalId)
      .select()
      .single();
    return NextResponse.json({ rental: updated ?? rental });
  }

  if (result.status === "Cancelled") {
    // DaisySim (US Only) itself cancelled this rental (not the customer) --
    // reflect that immediately and refund right away, same as a
    // customer-initiated cancel. The "status" = "waiting" guard makes this
    // atomic against a concurrent customer /cancel call, so it's never
    // refunded twice.
    const { data: updated } = await admin
      .from("rentals")
      .update({
        status: "cancelled",
        ...(correctedPhone ? { phone: correctedPhone } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", rentalId)
      .eq("status", "waiting")
      .select()
      .single();
    if (updated) {
      await refundRental(admin, updated, `Refund -- DaisySim cancelled ${rental.service} rental +${rental.phone}`);
    }
    return NextResponse.json({ rental: updated ?? rental });
  }

  return NextResponse.json({ rental });
}
