import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Receives Getatext's webhook (configured on your Getatext profile page),
 * pointed at https://getstore.org/api/webhooks/getatext. Fires once a code
 * arrives for a rental, as a backup/faster alternative to polling
 * /api/daisysim2/status. Documented payload:
 *   { id, code, received_at, number, service_name, status, cost }
 *
 * NOTE: Getatext's docs don't describe a signing secret for these webhooks,
 * so this endpoint can't cryptographically verify the sender. Mitigated the
 * same way as the DaisySim webhook: it only ever updates a rental that (a)
 * already exists, (b) belongs to the "daisysim2" provider (Getatext's own
 * id space), and (c) is still "waiting" -- an attacker would need to guess
 * a real, currently-pending rental id to do anything, and the only effect
 * is marking that rental's code (which the legitimate customer would also
 * get from polling).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  if (!body || body.id === undefined || !body.code) {
    // Still 200 -- an unrecognized payload shouldn't trigger retries.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const admin = createAdminClient();

  await admin
    .from("rentals")
    .update({
      status: "received",
      code: String(body.code),
      updated_at: new Date().toISOString(),
    })
    .eq("provider", "daisysim2")
    .eq("external_id", String(body.id))
    .eq("status", "waiting");

  return NextResponse.json({ ok: true });
}
