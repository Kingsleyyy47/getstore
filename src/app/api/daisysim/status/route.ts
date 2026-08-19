import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import * as daisysim from "@/lib/daisysim";

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
    .eq("provider", "daisysim")
    .single();

  if (error || !rental) {
    return NextResponse.json({ error: "Rental not found" }, { status: 404 });
  }

  if (rental.status === "done" || rental.status === "cancelled" || rental.status === "expired") {
    return NextResponse.json({ rental });
  }

  let result;
  try {
    result = await daisysim.checkStatus(rental.external_id);
  } catch (e) {
    const message = e instanceof daisysim.DaisySimError ? e.message : "Failed to check status";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (result.status === "Waiting") {
    return NextResponse.json({ rental });
  }

  const admin = createAdminClient();

  if (result.status === "Completed") {
    const { data: updated } = await admin
      .from("rentals")
      .update({
        status: "received",
        code: result.code,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rentalId)
      .select()
      .single();
    return NextResponse.json({ rental: updated ?? rental });
  }

  if (result.status === "Cancelled") {
    const { data: updated } = await admin
      .from("rentals")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", rentalId)
      .select()
      .single();
    return NextResponse.json({ rental: updated ?? rental });
  }

  return NextResponse.json({ rental });
}
