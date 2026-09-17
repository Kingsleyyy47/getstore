import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmin } from "@/lib/adminNotifications";

/**
 * Receives DaisySMS's webhook push for incoming SMS (see their docs:
 * "Webhooks" -- configured on https://daisysms.io/dashboard/profile).
 * When a webhook URL is set, DaisySMS POSTs the code to us the moment it
 * arrives instead of us finding out only on our next 5s poll -- faster for
 * the customer, and since this is DaisySMS calling US (not us calling
 * them), it's also immune to the Cloudflare bot-challenge issue that can
 * block our own outbound polling requests to their API (see src/lib/
 * daisysms.ts). Polling (src/app/api/daisysms/status/route.ts) stays in
 * place as the fallback in case the webhook is never configured, is
 * temporarily unreachable, or a delivery is simply missed.
 *
 * DaisySMS's webhook config is just a URL with no signing/auth mechanism
 * of its own, so this endpoint is secured with a shared secret passed as a
 * query string param on the URL you register with them, e.g.:
 *   https://yoursite.com/api/daisysms/webhook?secret=<DAISYSMS_WEBHOOK_SECRET>
 *
 * Body shape, per their docs:
 *   { activationId, messageId, service, text, code, country, receivedAt }
 * receivedAt is UTC.
 */
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = process.env.DAISYSMS_WEBHOOK_SECRET;
  if (!secret) {
    // Not configured -- fail closed rather than accepting unauthenticated
    // writes to the rentals table.
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  if (searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const activationId = body?.activationId;
  const code = body?.code;

  if (activationId === undefined || activationId === null || !code) {
    // Malformed payload -- ask DaisySMS to retry in case this was a
    // transient issue on their end, per their docs (non-2xx retries every
    // 15s, up to 8 times).
    return NextResponse.json({ error: "Missing activationId or code" }, { status: 400 });
  }

  const admin = createAdminClient();
  const externalId = String(activationId);

  const { data: rental, error: findErr } = await admin
    .from("rentals")
    .select("id, status")
    .eq("provider", "daisysms")
    .eq("external_id", externalId)
    .single();

  if (findErr || !rental) {
    // Nothing to do with this activation (unknown to us, already purged,
    // or a webhook test ping) -- respond 2xx either way so DaisySMS
    // doesn't keep retrying something we'll never be able to match.
    return NextResponse.json({ ok: true, matched: false });
  }

  // A cancelled/expired rental was already refunded -- don't resurrect it
  // just because a code showed up late. "waiting" -> "received" is the
  // normal first-code case; "received"/"done" already has a code, but an
  // extra activation (see getExtraActivation) can bring a second one, so
  // still refresh the code/text for those, just without touching status.
  if (rental.status === "cancelled" || rental.status === "expired") {
    return NextResponse.json({ ok: true, matched: true, applied: false });
  }

  const update: Record<string, string> = {
    code: String(code),
    full_text: typeof body?.text === "string" ? body.text : "",
    updated_at: new Date().toISOString(),
  };
  if (rental.status === "waiting") update.status = "received";

  const { error: updateErr } = await admin.from("rentals").update(update).eq("id", rental.id);

  if (updateErr) {
    await notifyAdmin({
      type: "provider_error",
      title: "DaisySMS webhook: failed to save incoming code",
      message: updateErr.message,
      meta: { activationId: externalId, rentalId: rental.id },
    });
    // Still 2xx -- the polling fallback will pick this up on its next
    // check, and retrying the exact same webhook delivery won't fix a DB
    // write failure.
  }

  return NextResponse.json({ ok: true, matched: true, applied: !updateErr });
}
