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

  try {
    await daisysms.setStatusDone(rental.external_id);
  } catch (e) {
    const message = e instanceof daisysms.DaisySMSError ? e.message : "Failed to mark as done";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const admin = createAdminClient();
  const { data: updated } = await admin
    .from("rentals")
    .update({ status: "done", updated_at: new Date().toISOString() })
    .eq("id", rentalId)
    .select()
    .single();

  return NextResponse.json({ rental: updated ?? rental });
}
