import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Receives DaisySMS's incoming-SMS webhook (configured on DaisySMS's own
 * dashboard at https://daisysms.io/dashboard/profile under "Webhook URL",
 * pointed at https://<your-domain>/api/webhooks/daisysms). Per DaisySMS's
 * docs, this fires as a POST whenever an SMS is forwarded to a rental, with
 * this exact body shape:
 *   {
 *     "activationId": 123,
 *     "messageId": 999,
 *     "service": "go",
 *     "text": "Your sms text",
 *     "code": "Your sms code",
 *     "country": 0,
 *     "receivedAt": "2022-06-01 17:30:57"   // UTC
 *   }
 * DaisySMS retries every 15 seconds, up to 8 times, if this endpoint
 * doesn't answer with a 2xx within its 3-second timeout -- so this handler
 * does the minimum work needed (one update query) and returns immediately.
 * This is a backup/faster alternative to polling /api/daisysms/status.
 *
 * NOTE: DaisySMS's docs don't describe a signing secret for this webhook,
 * so this endpoint can't cryptographically verify the sender. It mitigates
 * that the same way the DaisySim webhook does: it only ever updates a
 * rental that (a) already exists, (b) belongs to the daisysms provider,
 * and (c) is still "waiting" -- an attacker would need to guess a real,
 * currently-pending activation ID to do anything, and the only effect is
 * marking that rental's code (which the legitimate customer would also get
 * from polling). If you want stronger guarantees, ask DaisySMS support
 * whether they support a shared-secret header.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  if (!body || body.activationId == null || !body.code) {
    // Still 2xx -- an unrecognized payload shouldn't trigger DaisySMS's
    // retry-8-times behavior.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const admin = createAdminClient();

  await admin
    .from("rentals")
    .update({
      status: "received",
      code: String(body.code),
      full_text: body.text != null ? String(body.text) : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("provider", "daisysms")
    .eq("external_id", String(body.activationId))
    .eq("status", "waiting");

  return NextResponse.json({ ok: true });
}
