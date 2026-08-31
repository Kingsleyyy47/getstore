import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Receives DaisySim's "code.received" webhook (configured on DaisySim's own
 * dashboard under Settings -> Webhook URL, pointed at
 * https://getstore.org/api/webhooks/daisysim). Fires once per activation,
 * as a backup/faster alternative to polling /api/daisysim/status or
 * /api/daisysim2/status.
 *
 * "daisysim2" (the "US Only" page) is no longer backed by DaisySim -- it now
 * calls Getatext instead (see src/lib/daisysim2.ts) and has its own webhook
 * at /api/webhooks/getatext. This endpoint still matches against both the
 * "daisysim" and "daisysim2" provider rows for backward safety, but that
 * OR-branch is now permanently a no-op for daisysim2: Getatext's rental ids
 * will never coincidentally match a DaisySim activation_id.
 *
 * NOTE: DaisySim's docs don't describe a signing secret for these webhooks,
 * so this endpoint can't cryptographically verify the sender. It mitigates
 * that by only ever updating a rental that (a) already exists, (b) belongs
 * to one of the two DaisySim-family providers, and (c) is still "waiting"
 * -- an attacker would need to guess a real, currently-pending
 * activation_id to do anything, and the only effect is marking that
 * rental's code (which the legitimate customer will also get from
 * polling). If you want stronger guarantees, ask DaisySim support whether
 * they support a shared-secret header.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  if (!body || body.event !== "code.received" || !body.activation_id || !body.code) {
    // Still 200 -- an unrecognized payload shouldn't trigger DaisySim's
    // retry-8-times behavior.
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
    .in("provider", ["daisysim", "daisysim2"])
    .eq("external_id", String(body.activation_id))
    .eq("status", "waiting");

  return NextResponse.json({ ok: true });
}
