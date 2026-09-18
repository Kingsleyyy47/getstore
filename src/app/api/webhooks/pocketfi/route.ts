import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/lib/pocketfi";

/**
 * Receives PocketFi's payment webhooks (configured on PocketFi's dashboard
 * under Settings -> Webhooks, pointed at
 * https://getstore.org/api/webhooks/pocketfi). This DOES cryptographically
 * verify the sender before doing anything -- requests that fail
 * verification are rejected outright.
 *
 * Per PocketFi's real docs (developer.pocketfi.ng/docs/webhooks), the
 * signature header is read server-side as `HTTP_POCKETFI_SIGNATURE`
 * (PHP example) / `req.headers['http_pocketfi_signature']` (their own
 * Node.js example) -- both their sample snippets read it that literal way,
 * which is unusual for a real wire header name (normally that PHP
 * `$_SERVER['HTTP_...']` prefix means the actual header is just
 * "Pocketfi-Signature", but their Node example reading the SAME literal
 * key name contradicts that). Rather than guess wrong a second time, this
 * checks every plausible header name PocketFi might actually be sending.
 *
 * The docs' one documented payload shape (used for BOTH checkout payments
 * and virtual-account funding, per their generic "Webhooks" page -- there's
 * no separate example for each) is:
 *   {
 *     "order": { "amount": 5000.00, "settlement_amount": 4875.00,
 *                "fee": 125.00, "description": "..." },
 *     "transaction": { "reference": "pfi_ref_123456" }
 *   }
 * There's no `event`/`type` field shown to tell the two cases apart, and no
 * documented field naming WHICH virtual account was credited on that path.
 * This handler's strategy, until a real test transaction's logged payload
 * confirms the exact shape:
 *   1. Try matching transaction.reference against a pending
 *      topup_requests.provider_reference (set to PocketFi's payment_id in
 *      /api/pocketfi/checkout) -- if found, treat as a checkout payment.
 *   2. Otherwise, look for an account number in any of a few plausible
 *      spots (`account`, `transaction.account`, `order.account`) and match
 *      it against pocketfi_virtual_accounts -- if found, treat as a
 *      virtual-account credit.
 *   3. Otherwise, do nothing (still 200, so PocketFi doesn't retry forever)
 *      -- if this is hit in practice, log the raw payload PocketFi actually
 *      sent and fix the shape above to match it.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature =
    req.headers.get("pocketfi-signature") ??
    req.headers.get("x-pocketfi-signature") ??
    req.headers.get("http_pocketfi_signature") ??
    req.headers.get("http-pocketfi-signature");

  const admin = createAdminClient();
  const signatureValid = verifyWebhookSignature(rawBody, signature);

  // Log EVERY inbound webhook -- signature failures included -- before
  // anything else, so a customer's "my transfer didn't credit" report can be
  // diagnosed from the exact raw payload PocketFi sent (see
  // supabase/023_pocketfi_webhook_log.sql), instead of guessing at field
  // names with no way to check. This never blocks/fails the response --
  // logging errors are swallowed on purpose.
  let logId: string | null = null;
  try {
    const { data } = await admin
      .from("pocketfi_webhook_events")
      .insert({ signature_valid: signatureValid, raw_body: rawBody })
      .select("id")
      .single();
    logId = data?.id ?? null;
  } catch {
    // ignore -- logging must never be why a real payment fails to process
  }

  if (!signatureValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody || "{}");

  // Wide net across every plausible field name/nesting PocketFi might use --
  // their docs only show ONE shape (order.amount / transaction.reference)
  // shared across checkout AND virtual-account credits, with NO documented
  // field at all for which account number was credited. Until a real
  // logged payload (see pocketfi_webhook_events above) confirms the exact
  // shape for a bank-transfer credit, this checks every candidate spot
  // rather than a single guessed one.
  const reference: string | undefined =
    event?.transaction?.reference ??
    event?.transaction?.transaction_reference ??
    event?.payment_id ??
    event?.reference ??
    event?.transaction_reference ??
    event?.data?.reference;
  const amountNaira: number | undefined =
    Number(
      event?.order?.amount ??
        event?.amount ??
        event?.transaction?.amount ??
        event?.data?.amount ??
        event?.order?.settlement_amount
    ) || undefined;
  const description: string | undefined = event?.order?.description;
  const accountNumber: string | undefined =
    event?.account ??
    event?.account_number ??
    event?.transaction?.account ??
    event?.transaction?.account_number ??
    event?.order?.account ??
    event?.order?.account_number ??
    event?.virtual_account?.account_number ??
    event?.data?.account_number;

  let matchedCheckout = false;
  let matchedVirtualAccount = false;

  if (reference) {
    matchedCheckout = await handleCheckoutPayment(admin, { reference, amountNaira, description });
  }

  if (!matchedCheckout && accountNumber && amountNaira && reference) {
    matchedVirtualAccount = await handleVirtualAccountCredit(admin, { accountNumber, amountNaira, reference });
  }

  if (logId) {
    await admin
      .from("pocketfi_webhook_events")
      .update({ matched_checkout: matchedCheckout, matched_virtual_account: matchedVirtualAccount })
      .eq("id", logId);
  }

  // Always 2xx for a recognized-but-unhandled or already-processed event so
  // PocketFi doesn't keep retrying.
  return NextResponse.json({ ok: true });
}

/** Returns true if this reference matched a pending checkout top-up
 * (whether or not it still needed crediting), so the caller knows not to
 * also try the virtual-account path for the same event. */
async function handleCheckoutPayment(
  admin: ReturnType<typeof createAdminClient>,
  event: { reference: string; amountNaira?: number; description?: string }
): Promise<boolean> {
  const { data: topup } = await admin
    .from("topup_requests")
    .select("*")
    .eq("provider_reference", event.reference)
    .maybeSingle();

  if (!topup) return false; // not a checkout payment -- try the virtual-account path instead
  if (topup.status !== "pending") return true; // already handled

  const { data: wallet } = await admin
    .from("wallets")
    .select("balance_cents")
    .eq("user_id", topup.user_id)
    .single();

  const balanceCents = wallet?.balance_cents ?? 0;
  const newBalanceCents = balanceCents + topup.amount_cents;

  const { error: walletErr } = await admin
    .from("wallets")
    .update({ balance_cents: newBalanceCents, updated_at: new Date().toISOString() })
    .eq("user_id", topup.user_id);
  if (walletErr) return true;

  await admin.from("wallet_transactions").insert({
    user_id: topup.user_id,
    type: "topup",
    amount_cents: topup.amount_cents,
    balance_after_cents: newBalanceCents,
    description: `Top-up via PocketFi (${event.reference})`,
    related_topup_id: topup.id,
  });

  await admin
    .from("topup_requests")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", topup.id);

  return true;
}

/** Returns true if the account number matched a known virtual account,
 * whether or not it still needed crediting (already-processed also counts
 * as "matched" -- it just means this exact event was a retry). */
async function handleVirtualAccountCredit(
  admin: ReturnType<typeof createAdminClient>,
  event: { accountNumber: string; amountNaira: number; reference: string }
): Promise<boolean> {
  const { data: account } = await admin
    .from("pocketfi_virtual_accounts")
    .select("user_id")
    .eq("account_number", event.accountNumber)
    .maybeSingle();
  if (!account) return false;

  // Idempotency: PocketFi may retry this webhook, so check for an existing
  // row referencing this transaction reference before crediting again.
  const { data: already } = await admin
    .from("wallet_transactions")
    .select("id")
    .eq("description", `Bank transfer via PocketFi (txn ${event.reference})`)
    .maybeSingle();
  if (already) return true;

  const amount_cents = Math.round(event.amountNaira * 100);

  const { data: wallet } = await admin
    .from("wallets")
    .select("balance_cents")
    .eq("user_id", account.user_id)
    .single();

  const balanceCents = wallet?.balance_cents ?? 0;
  const newBalanceCents = balanceCents + amount_cents;

  const { error: walletErr } = await admin
    .from("wallets")
    .update({ balance_cents: newBalanceCents, updated_at: new Date().toISOString() })
    .eq("user_id", account.user_id);
  if (walletErr) return false;

  await admin.from("wallet_transactions").insert({
    user_id: account.user_id,
    type: "topup",
    amount_cents,
    balance_after_cents: newBalanceCents,
    description: `Bank transfer via PocketFi (txn ${event.reference})`,
  });
  return true;
}
