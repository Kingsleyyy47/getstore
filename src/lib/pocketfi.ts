import "server-only";
import crypto from "node:crypto";

/**
 * Thin wrapper around PocketFi's API (Nigerian payments: hosted checkout
 * links, dedicated virtual bank accounts, webhooks signed with
 * HMAC-SHA512).
 *
 * Endpoint paths, request fields, and response shapes below are taken
 * DIRECTLY from PocketFi's real developer docs (developer.pocketfi.ng) --
 * this replaced an earlier version that was scaffolded from a loose
 * description rather than the literal doc text, which is why virtual
 * account creation was 404ing (it was POSTing to a made-up path). If a call
 * still fails with a 4xx/404, re-check the current docs -- every route that
 * uses PocketFi goes through this file, so it's the one place to fix.
 *
 * NOTE: PocketFi's naming is the reverse of what you'd expect. The "Secret
 * API Key" is a plain hex string used ONLY to verify inbound webhook
 * signatures (HMAC) -- it is NOT a valid bearer token. The Bearer token
 * used to authenticate outbound API calls is the Sanctum-style `id|token`
 * credential shown in the docs' auth example (`352|3r5ZnULMaBfK...`), which
 * on PocketFi's dashboard is labeled "Public API Key" -- that's
 * POCKETFI_PUBLIC_KEY below.
 *
 * Env vars required (see .env.example):
 *   POCKETFI_BUSINESS_ID
 *   POCKETFI_PUBLIC_KEY  (the Sanctum `id|token` credential -- outbound API auth)
 *   POCKETFI_SECRET_KEY  (the hex string -- webhook HMAC verification only)
 *   POCKETFI_BASE_URL (defaults to https://api.pocketfi.ng; every path below
 *     already includes the "/api/v1" prefix per the docs' own per-endpoint
 *     headers, e.g. "POST /api/v1/checkout/request" -- don't add it again
 *     in POCKETFI_BASE_URL. For PocketFi's sandbox, the docs give a
 *     DIFFERENT base of https://api.pocketfi.ng/api/test with no further
 *     "/v1/..." breakdown shown -- if you need sandbox testing, confirm
 *     with PocketFi whether the same "/checkout/request" etc. suffixes
 *     apply under /api/test before relying on it.)
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
      Accept: "application/json",
      Authorization: `Bearer ${publicKey}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // Per the docs' error format: { status: false, message: "...", errors?: {...} }.
    // On a 422, `errors` names exactly which field(s) failed validation --
    // surface that if present, since "Unprocessable Entity" alone isn't
    // actionable.
    const validation = body?.errors ? ` (${JSON.stringify(body.errors)})` : "";
    const message = (body?.message ? `${body.message}${validation}` : null) ?? `PocketFi request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

/** Best-effort split of a single "full name" field into PocketFi's required
 * first_name/last_name pair -- our own profiles table only stores one
 * combined name field. Falls back to "Customer" for the surname when
 * there's nothing to split (PocketFi requires both fields to be non-empty). */
export function splitName(fullName: string | null | undefined, fallback: string): { firstName: string; lastName: string } {
  const source = (fullName ?? fallback).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
  }
  return { firstName: parts[0] || fallback, lastName: "Customer" };
}

export interface InitializePaymentResult {
  checkoutUrl: string;
  /** PocketFi's own payment_id (e.g. "PFI|4346813e0ed2") -- store this as
   * topup_requests.provider_reference. The docs' webhook payload example
   * only shows a `transaction.reference` field, not payment_id, so the
   * webhook handler treats a match on EITHER as confirmation -- see that
   * route's comments. */
  paymentId: string;
}

/**
 * POST /api/v1/checkout/request -- creates a hosted checkout session.
 * PocketFi returns a payment_link to redirect the customer to; once they
 * pay, PocketFi POSTs redirect_link with the result AND (separately) fires
 * a webhook. amountNaira is passed as a string per the docs' own example
 * payload ("amount": "100").
 */
export async function initializePayment(params: {
  amountNaira: number;
  email: string;
  firstName: string;
  lastName: string;
  /** Docs list this as required, but confirmed unneeded in practice on
   * other live PocketFi integrations -- only sent when available. */
  phone?: string;
  redirectLink: string;
}): Promise<InitializePaymentResult> {
  const businessId = requireEnv("POCKETFI_BUSINESS_ID");

  const body = await pocketfiFetch<any>("/api/v1/checkout/request", {
    method: "POST",
    body: JSON.stringify({
      first_name: params.firstName,
      last_name: params.lastName,
      ...(params.phone ? { phone: params.phone } : {}),
      business_id: businessId,
      email: params.email,
      redirect_link: params.redirectLink,
      amount: String(params.amountNaira),
    }),
  });

  const checkoutUrl = body?.payment_link;
  const paymentId = body?.payment_id;
  if (!checkoutUrl || !paymentId) throw new Error("PocketFi did not return a payment_link/payment_id");

  return { checkoutUrl, paymentId };
}

export interface VirtualAccountResult {
  /** No separate provider account id is returned by this endpoint per the
   * docs' response shape (just bankName/accountNumber/accountName) -- the
   * account number itself doubles as our provider-side identifier. */
  providerAccountId: string;
  accountNumber: string;
  bankName: string;
  accountName: string | null;
}

/**
 * POST /api/v1/virtual-accounts/create -- creates a dedicated (static)
 * virtual account for a customer. Docs list `phone` as required and
 * `nin`/`bvn` as required specifically for the "palmpay" bank -- confirmed
 * unneeded in practice across other live PocketFi integrations, so none of
 * the three are sent unless supplied.
 *
 * `bankProvider` must be one of the docs' literal codes: "saveheaven",
 * "paga", "kuda", "9psb", "palmpay" -- NOT the previous guessed set. If
 * Admin -> Settings has a different value saved (e.g. from before this
 * fix), update it there.
 */
export async function createVirtualAccount(params: {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  bankProvider: string;
  nin?: string;
  bvn?: string;
}): Promise<VirtualAccountResult> {
  const businessId = requireEnv("POCKETFI_BUSINESS_ID");

  const body = await pocketfiFetch<any>("/api/v1/virtual-accounts/create", {
    method: "POST",
    body: JSON.stringify({
      first_name: params.firstName,
      last_name: params.lastName,
      ...(params.phone ? { phone: params.phone } : {}),
      email: params.email,
      // NOTE: the docs use camelCase "businessId" here, unlike the
      // snake_case "business_id" the checkout endpoint uses -- confirmed
      // as written twice, differently, in the docs, not a typo on our end.
      businessId,
      bank: params.bankProvider,
      ...(params.nin ? { nin: params.nin } : {}),
      ...(params.bvn ? { bvn: params.bvn } : {}),
    }),
  });

  const account = body?.banks?.[0];
  if (!account?.accountNumber) throw new Error("PocketFi did not return a virtual account");

  return {
    providerAccountId: String(account.accountNumber),
    accountNumber: String(account.accountNumber),
    bankName: String(account.bankName ?? "PocketFi"),
    accountName: account.accountName ?? null,
  };
}

/**
 * Verifies a webhook's signature: HMAC-SHA512 of the raw request body,
 * keyed with the Secret API Key (the hex string -- this is its only valid
 * use; it is NOT a bearer token for outbound calls, see the module header
 * above), hex-encoded. MUST be checked against the raw request text -- do
 * not re-serialize a parsed JSON object, since key ordering/whitespace
 * differences would break the comparison.
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
