import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/lib/pocketfi";

/**
 * Receives PocketFi's payment webhooks (configured on PocketFi's dashboard,
 * pointed at https://getstore.org/api/webhooks/pocketfi). Unlike the
 * DaisySMS/DaisySim webhooks, PocketFi's docs describe an HMAC-SHA512
 * signature on the `x-pocketfi-signature` header, so this endpoint DOES
 * cryptographically verify the sender before doing anything -- requests
 * that fail verification are rejected outright.
 *
 * Handles two event shapes:
 *   - checkout payment completed  -> matches a topup_requests row by
 *     provider_reference (set in /api/pocketfi/checkout), credits the
 *     wallet, marks it approved.
 *   - virtual account credited    -> matches a pocketfi_virtual_accounts
 *     row by account number, credits that user's wallet directly (there's
 *     no topup_requests row for this path -- the wallet_transactions
 *     insert alone is enough for it to show up on /admin/transactions).
 *
 * IMPORTANT -- verify the exact event `type`/field names below against
 * PocketFi's actual webhook payload docs; adjust the two `if` branches
 * below if they don't match. Whatever the field names turn out to be, keep
 * the idempotency check (looking up an existing wallet_transactions row by
 * provider reference before crediting) -- PocketFi, like most payment
 * providers, may retry a webhook delivery.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-pocketfi-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody || "{}");
  const admin = createAdminClient();

  const eventType: string | undefined = event?.event ?? event?.type;
  const data = event?.data ?? {};

  if (eventType === "payment.success" || eventType === "charge.success") {
    await handleCheckoutPayment(admin, data);
  } else if (eventType === "virtual_account.credited" || eventType === "transfer.received") {
    await handleVirtualAccountCredit(admin, data);
  }

  // Always 2xx for a recognized-but-unhandled or already-processed event so
  // PocketFi doesn't keep retrying.
  return NextResponse.json({ ok: true });
}

async function handleCheckoutPayment(admin: ReturnType<typeof createAdminClient>, data: any) {
  const providerReference: string | undefined = data?.reference;
  if (!providerReference) return;

  const { data: topup } = await admin
    .from("topup_requests")
    .select("*")
    .eq("provider_reference", providerReference)
    .single();

  if (!topup || topup.status !== "pending") return; // already handled, or not ours

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
  if (walletErr) return;

  await admin.from("wallet_transactions").insert({
    user_id: topup.user_id,
    type: "topup",
    amount_cents: topup.amount_cents,
    balance_after_cents: newBalanceCents,
    description: `Top-up via PocketFi (${providerReference})`,
    related_topup_id: topup.id,
  });

  await admin
    .from("topup_requests")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", topup.id);
}

async function handleVirtualAccountCredit(admin: ReturnType<typeof createAdminClient>, data: any) {
  const accountNumber: string | undefined = data?.account_number;
  const amountNaira: number | undefined = data?.amount;
  const providerTransactionId: string | undefined = data?.transaction_id ?? data?.id;
  if (!accountNumber || !amountNaira || !providerTransactionId) return;

  const { data: account } = await admin
    .from("pocketfi_virtual_accounts")
    .select("user_id")
    .eq("account_number", accountNumber)
    .single();
  if (!account) return;

  // Idempotency: PocketFi may retry this webhook, and description isn't
  // unique-constrained, so check for an existing row referencing this
  // provider transaction id before crediting again.
  const { data: already } = await admin
    .from("wallet_transactions")
    .select("id")
    .eq("description", `Bank transfer via PocketFi (txn ${providerTransactionId})`)
    .maybeSingle();
  if (already) return;

  const amount_cents = Math.round(amountNaira * 100);

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
  if (walletErr) return;

  await admin.from("wallet_transactions").insert({
    user_id: account.user_id,
    type: "topup",
    amount_cents,
    balance_after_cents: newBalanceCents,
    description: `Bank transfer via PocketFi (txn ${providerTransactionId})`,
  });
}
