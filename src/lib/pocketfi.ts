import "server-only";
import crypto from "node:crypto";

/**
 * Thin wrapper around PocketFi's API (Nigerian payments: hosted checkout
 * links, dedicated virtual bank accounts, webhooks signed with
 * HMAC-SHA512).
 *
 * IMPORTANT -- verify against PocketFi's actual API reference before going
 * live. This was scaffolded from a description of the endpoints (Initialize
 * Payment / Create Virtual Account / webhook signature verification /
 * NIN-BVN identity verification) rather than the literal spec text, so the
 * request/response field names and paths below are best-effort. If a call
 * fails with a 4xx complaining about an unknown field or wrong path, check
 * PocketFi's docs and adjust the shapes in this file only -- every route
 * that uses PocketFi goes through here, so this is the one place to fix.
 *
 * NOTE: PocketFi's naming is the reverse of what you'd expect. The "Secret
 * API Key" is a plain hex string used ONLY to verify inbound webhook
 * signatures (HMAC) -- it is NOT a valid bearer token. The "Public API Key"
 * is the Laravel Sanctum-style `id|token` credential that actually
 * authenticates outbound API calls (looks like `1|abc123...`), so that's
 * what goes in the Authorization header below.
 *
 * Env vars required (see .env.example):
 *   POCKETFI_BUSINESS_ID
 *   POCKETFI_PUBLIC_KEY  (the Sanctum `id|token` credential -- outbound API auth)
 *   POCKETFI_SECRET_KEY  (the hex string -- webhook HMAC verification only)
 *   POCKETFI_BASE_URL (defaults to https://api.pocketfi.ng)
 */

const BASE_URL = process.env.POCKETFI_BASE_URL || "https://api.pocketfi.ng";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function pocketfiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const publicKey = requireEnv("POCKETFI_PUBLIC_KEY");

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${publicKey}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = body?.message || body?.error || `PocketFi request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

export interface InitializePaymentResult {
  checkoutUrl: string;
  providerReference: string;
}

/**
 * Creates a hosted checkout link for a one-off payment. amountNaira is in
 * whole Naira (not kobo) -- adjust here if PocketFi actually expects kobo.
 */
export async function initializePayment(params: {
  amountNaira: number;
  email: string;
  reference: string; // our own idempotency key, echoed back on the webhook
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<InitializePaymentResult> {
  const businessId = requireEnv("POCKETFI_BUSINESS_ID");

  const body = await pocketfiFetch<any>("/v1/payments/initialize", {
    method: "POST",
    body: JSON.stringify({
      business_id: businessId,
      amount: params.amountNaira,
      currency: "NGN",
      email: params.email,
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });

  const checkoutUrl = body?.data?.checkout_url ?? body?.data?.authorization_url;
  const providerReference = body?.data?.reference ?? params.reference;
  if (!checkoutUrl) throw new Error("PocketFi did not return a checkout URL");

  return { checkoutUrl, providerReference };
}

export interface VirtualAccountResult {
  providerAccountId: string;
  accountNumber: string;
  bankName: string;
  accountName: string | null;
}

/**
 * Creates (or, per PocketFi's docs, may return the existing one for) a
 * dedicated virtual account for a customer. Per the docs, virtual accounts
 * on some banks (e.g. PalmPay) require NIN/BVN-level KYC on the business
 * account -- if this call fails with a KYC-related error, that's a
 * PocketFi dashboard verification issue, not a bug here.
 *
 * bankProvider selects which partner bank issues the account (PocketFi
 * supports several -- Paga, PalmPay, Wema, etc.). It's admin-configurable
 * (app_settings.pocketfi_bank_provider, defaults to "paga") rather than
 * hardcoded, so the admin can swap it from Admin -> Settings if one
 * partner has an outage. IMPORTANT -- the field name below (`provider`)
 * and the exact provider codes PocketFi accepts ("paga", "palmpay", ...)
 * are unverified against PocketFi's real API reference; confirm against
 * their docs/dashboard and adjust here if a call 4xxs on this field.
 */
export async function createVirtualAccount(params: {
  email: string;
  fullName: string;
  userId: string; // used as our own external reference
  bankProvider: string;
}): Promise<VirtualAccountResult> {
  const businessId = requireEnv("POCKETFI_BUSINESS_ID");

  const body = await pocketfiFetch<any>("/v1/virtual-accounts", {
    method: "POST",
    body: JSON.stringify({
      business_id: businessId,
      email: params.email,
      full_name: params.fullName,
      external_reference: params.userId,
      provider: params.bankProvider,
    }),
  });

  const data = body?.data;
  if (!data?.account_number) throw new Error("PocketFi did not return a virtual account");

  return {
    providerAccountId: String(data.id ?? data.account_id ?? data.account_number),
    accountNumber: String(data.account_number),
    bankName: String(data.bank_name ?? "PocketFi"),
    accountName: data.account_name ?? null,
  };
}

/**
 * Verifies the `x-pocketfi-signature` header PocketFi sends on webhook
 * requests: HMAC-SHA512 of the raw request body, keyed with the Secret API
 * Key (the hex string -- this is its only valid use; it is NOT a bearer
 * token for outbound calls, see the module header above), hex-encoded.
 * MUST be checked against the raw request text -- do not re-serialize a
 * parsed JSON object, since key ordering/whitespace differences would
 * break the comparison.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const secretKey = requireEnv("POCKETFI_SECRET_KEY");

  const expected = crypto.createHmac("sha512", secretKey).update(rawBody).digest("hex");

  // Constant-time compare -- both must be equal length for timingSafeEqual.
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
