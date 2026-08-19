import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import * as daisysms from "@/lib/daisysms";

/**
 * Requests a second SMS code on a number the customer already rented and
 * already received a code on -- DaisySMS's "getExtraActivation". Creates a
 * new rentals row (its own external_id, price 0 since DaisySMS doesn't
 * itemize a charge for this) so the existing /api/daisysms/status polling
 * endpoint works on it unchanged.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const settings = await getSettings();
  if (!settings.extra_activation_enabled) {
    return NextResponse.json(
      { error: "Getting another code on the same number is currently unavailable" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const rentalId = String(body?.rentalId ?? "").trim();
  if (!rentalId) return NextResponse.json({ error: "rentalId is required" }, { status: 400 });

  // RLS: only the owner can select this row.
  const { data: rental, error: fetchErr } = await supabase
    .from("rentals")
    .select("*")
    .eq("id", rentalId)
    .eq("provider", "daisysms")
    .single();

  if (fetchErr || !rental) {
    return NextResponse.json({ error: "Rental not found" }, { status: 404 });
  }

  if (rental.status !== "received" && rental.status !== "done") {
    return NextResponse.json(
      { error: "You can only request another code after you've already received one on this number" },
      { status: 400 }
    );
  }

  let extra;
  try {
    extra = await daisysms.getExtraActivation(rental.external_id);
  } catch (e) {
    const message = e instanceof daisysms.DaisySMSError ? e.message : "Failed to request another code";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const admin = createAdminClient();
  const { data: newRental, error: insertErr } = await admin
    .from("rentals")
    .insert({
      user_id: user.id,
      provider: "daisysms",
      external_id: extra.id,
      service: rental.service,
      country: rental.country,
      phone: extra.phone,
      price_cents: 0,
      status: "waiting",
    })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ rental: newRental, readyAt: extra.readyAt });
}
