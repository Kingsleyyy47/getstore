import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Shared timing rules + refund helper for number rentals (DaisySMS,
 * DaisySim, DaisySim2), used by the per-provider /cancel routes, the
 * per-provider /status polling routes, and the auto-cancel cron
 * (src/app/api/cron/auto-cancel-rentals/route.ts).
 *
 *   - A customer can only cancel a rental (and get refunded) after it has
 *     been waiting MIN_CANCEL_WAIT_MS with no code -- enforced server-side
 *     in each /cancel route, not just hidden in the UI.
 *   - If nobody cancels it and no code ever arrives, the cron auto-cancels
 *     it after AUTO_CANCEL_AFTER_MS -- but only once the OWNING provider
 *     has actually confirmed the cancellation (DaisySMS's setStatus(cancel)
 *     / DaisySim's & DaisySim2's /cancel), never just by giving up locally.
 *   - If the provider itself reports a rental as cancelled (e.g. a customer
 *     polls /status and DaisySMS returns STATUS_CANCEL, or DaisySim/
 *     DaisySim2 return "Cancelled"), that should be reflected -- and
 *     refunded -- immediately, without waiting on the cron.
 */

export const MIN_CANCEL_WAIT_MS = 3 * 60 * 1000; // customers may cancel after 3 min with no code
export const AUTO_CANCEL_AFTER_MS = 7 * 60 * 1000; // auto-cancel after 7 min with no code

/**
 * Milliseconds remaining before a customer is allowed to cancel a rental
 * still waiting for a code, given when it was created. 0 once the 3-minute
 * window has passed.
 */
export function msUntilCancellable(createdAt: string): number {
  const elapsedMs = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, MIN_CANCEL_WAIT_MS - elapsedMs);
}

interface RefundableRental {
  id: string;
  user_id: string;
  price_cents: number;
  service: string;
  phone: string;
}

/**
 * Credits a rental's price back to its owner's wallet and logs the refund
 * in wallet_transactions. Callers are responsible for having already
 * atomically flipped the rental's status away from "waiting" (see the
 * `.eq("status", "waiting")` guard used in every call site) so this never
 * runs twice for the same rental.
 */
export async function refundRental(
  admin: ReturnType<typeof createAdminClient>,
  rental: RefundableRental,
  description: string
): Promise<void> {
  const { data: wallet } = await admin
    .from("wallets")
    .select("balance_cents")
    .eq("user_id", rental.user_id)
    .single();

  const balanceCents = wallet?.balance_cents ?? 0;
  const newBalanceCents = balanceCents + rental.price_cents;

  await admin
    .from("wallets")
    .update({ balance_cents: newBalanceCents, updated_at: new Date().toISOString() })
    .eq("user_id", rental.user_id);

  await admin.from("wallet_transactions").insert({
    user_id: rental.user_id,
    type: "refund",
    amount_cents: rental.price_cents,
    balance_after_cents: newBalanceCents,
    description,
    related_rental_id: rental.id,
  });
}
