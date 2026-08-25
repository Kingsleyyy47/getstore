import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import * as daisysim2 from "@/lib/daisysim2";
import { msUntilCancellable, refundRental } from "@/lib/rentals";

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
    .eq("provider", "daisysim2")
    .single();

  if (error || !rental) return NextResponse.json({ error: "Rental not found" }, { status: 404 });

  if (rental.status !== "waiting") {
    return NextResponse.json(
      { error: "Only rentals still waiting for a code can be cancelled" },
      { status: 400 }
    );
  }

  const waitMs = msUntilCancellable(rental.created_at);
  if (waitMs > 0) {
    return NextResponse.json(
      {
        error: `You can cancel this in ${Math.ceil(waitMs / 1000)}s (after 3 minutes with no code).`,
      },
      { status: 422 }
    );
  }

  const admin = createAdminClient();

  try {
    await daisysim2.cancel(rental.external_id);
  } catch (e) {
    // Our own 3-minute gate above always waits longer than DaisySim's own
    // TOO_EARLY window, so this branch should be unreachable in normal
    // operation -- kept only as a defensive fallback.
    if (e instanceof daisysim2.DaisySim2Error && e.code === "TOO_EARLY") {
      return NextResponse.json(
        { error: e.message || "You can't cancel this number just yet -- please wait a bit and try again." },
        { status: 422 }
      );
    }
    if (e instanceof daisysim2.DaisySim2Error && e.code === "CODE_RECEIVED") {
      // A code landed right as we tried to cancel -- fetch it and treat
      // this as a completed rental instead of an error.
      try {
        const status = await daisysim2.checkStatus(rental.external_id);
        if (status.status === "Completed" && status.code) {
          const { data: updated } = await admin
            .from("rentals")
            .update({ status: "received", code: status.code, updated_at: new Date().toISOString() })
            .eq("id", rentalId)
            .eq("status", "waiting")
            .select()
            .single();
          return NextResponse.json({
            rental: updated ?? rental,
            info: "A code arrived just as you cancelled, so this rental was kept instead.",
          });
        }
      } catch {
        /* fall through to generic error below */
      }
      return NextResponse.json(
        { error: "A code already arrived for this number, so it can't be cancelled." },
        { status: 422 }
      );
    }
    const message = e instanceof daisysim2.DaisySim2Error ? e.message : "Failed to cancel rental";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // DaisySim (US Only) has now CONFIRMED the cancellation. Flip status
  // atomically (only if still "waiting", guarding against a race with a
  // status poll that landed at the same moment) before refunding, so we
  // never double-refund the same rental.
  const { data: updated } = await admin
    .from("rentals")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", rentalId)
    .eq("status", "waiting")
    .select()
    .single();

  const settled = updated ?? rental;
  if (updated) {
    await refundRental(admin, settled, `Refund for cancelled ${rental.service} rental +${rental.phone}`);
  }

  return NextResponse.json({ rental: settled });
}
