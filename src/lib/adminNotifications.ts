import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Logs a notification for admins only -- used by customer-facing routes to
 * record a technical/provider-side failure (a blocked API request, an
 * unexpected response shape, etc.) that a customer shouldn't see raw, so
 * the admin can act on it from Admin -> Notifications while the customer
 * just sees a generic "try again shortly" message.
 *
 * Always uses the service-role client, since the request that triggers
 * this runs in a customer's session (not an admin's) and RLS on
 * admin_notifications only allows admin reads/writes.
 *
 * Best-effort: a failure to log must never break the actual customer
 * request that triggered it.
 */
export async function notifyAdmin(opts: {
  type: string;
  title: string;
  message: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("admin_notifications").insert({
      type: opts.type,
      title: opts.title,
      message: opts.message,
      meta: opts.meta ?? null,
    });
  } catch {
    /* best-effort, never throw */
  }
}
