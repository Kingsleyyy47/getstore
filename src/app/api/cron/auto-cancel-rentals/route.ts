import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import * as daisysms from "@/lib/daisysms";
import * as daisysim from "@/lib/daisysim";
import * as daisysim2 from "@/lib/daisysim2";
import { AUTO_CANCEL_AFTER_MS, refundRental } from "@/lib/rentals";

export const dynamic = "force-dynamic";

/**
 * Auto-cancels rentals that have been "waiting" for a code for more than
 * AUTO_CANCEL_AFTER_MS (7 minutes) with none received.
 *
 * IMPORTANT: this never just gives up on a rental locally. For each stale
 * rental it calls the OWNING provider's own cancel endpoint first --
 * DaisySMS's setStatus(cancel), or DaisySim's/DaisySim2's /cancel -- and
 * only marks the rental "expired" + refunds once that provider has
 * confirmed the cancellation. If the provider says a code actually arrived
 * moments ago (DaisySMS's "already has a code" / DaisySim's CODE_RECEIVED),
 * this marks the rental "received" instead of cancelling it, matching the
 * behavior of the customer-facing /cancel routes.
 *
 * Trigger this on a schedule:
 *   - On Vercel: see vercel.json's `crons` entry. Vercel automatically sends
 *     `Authorization: Bearer $CRON_SECRET` on its own scheduled hits to
 *     this route, which is exactly what's checked below.
 *   - Elsewhere: point any external scheduler (cron-job.org, a GitHub
 *     Actions scheduled workflow, etc.) at
 *     https://getstore.org/api/cron/auto-cancel-rentals every few minutes,
 *     sending that same `Authorization: Bearer <CRON_SECRET>` header.
 * See .env.example for CRON_SECRET.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set on the server" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - AUTO_CANCEL_AFTER_MS).toISOString();

  const { data: stale, error } = await admin
    .from("rentals")
    .select("*")
    .eq("status", "waiting")
    .lt("created_at", cutoff);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = await Promise.allSettled((stale ?? []).map((rental) => autoCancelOne(admin, rental)));

  const summary = { checked: stale?.length ?? 0, expired: 0, receivedInstead: 0, skipped: 0, errored: 0 };
  for (const r of results) {
    if (r.status === "fulfilled") summary[r.value]++;
    else summary.errored++;
  }

  return NextResponse.json({ ok: true, ...summary });
}

type Outcome = "expired" | "receivedInstead" | "skipped";

async function autoCancelOne(
  admin: ReturnType<typeof createAdminClient>,
  rental: any
): Promise<Outcome> {
  try {
    if (rental.provider === "daisysms") {
      try {
        await daisysms.cancelRental(rental.external_id);
      } catch (e) {
        if (e instanceof daisysms.DaisySMSError && /already has a code/i.test(e.message)) {
          return markReceivedIfCodeArrived(admin, rental, async () => {
            const status = await daisysms.getStatus(rental.external_id, true);
            return status.status === "STATUS_OK" ? { code: status.code, fullText: status.fullText } : null;
          });
        }
        throw e;
      }
    } else if (rental.provider === "daisysim" || rental.provider === "daisysim2") {
      const client = rental.provider === "daisysim" ? daisysim : daisysim2;
      try {
        await client.cancel(rental.external_id);
      } catch (e) {
        const err = e as { code?: string } | null;
        if (err?.code === "CODE_RECEIVED") {
          return markReceivedIfCodeArrived(admin, rental, async () => {
            const status = await client.checkStatus(rental.external_id);
            return status.status === "Completed" && status.code ? { code: status.code } : null;
          });
        }
        if (err?.code === "TOO_EARLY") {
          // Shouldn't happen 7 minutes in, but don't force a cancellation
          // the provider isn't ready to confirm yet -- retry next run.
          return "skipped";
        }
        throw e;
      }
    } else {
      return "skipped";
    }
  } catch {
    // Provider call failed (network/unexpected error) -- leave it "waiting"
    // and retry on the next cron run rather than expiring it without a
    // confirmed cancellation.
    return "skipped";
  }

  // Provider confirmed the cancellation -- flip status atomically (only if
  // still "waiting", guarding against a race with a customer /cancel call
  // or a status poll that landed at the same moment) before refunding, so
  // this never double-refunds the same rental.
  const { data: updated } = await admin
    .from("rentals")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("id", rental.id)
    .eq("status", "waiting")
    .select()
    .maybeSingle();

  if (!updated) return "skipped"; // someone else already resolved it

  await refundRental(
    admin,
    updated,
    `Auto-cancelled after 7 minutes with no code -- ${updated.service} +${updated.phone}`
  );

  return "expired";
}

async function markReceivedIfCodeArrived(
  admin: ReturnType<typeof createAdminClient>,
  rental: any,
  fetchCode: () => Promise<{ code: string; fullText?: string } | null>
): Promise<Outcome> {
  const result = await fetchCode();
  if (!result) return "skipped";

  const { data: updated } = await admin
    .from("rentals")
    .update({
      status: "received",
      code: result.code,
      full_text: result.fullText ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rental.id)
    .eq("status", "waiting")
    .select()
    .maybeSingle();

  return updated ? "receivedInstead" : "skipped";
}
