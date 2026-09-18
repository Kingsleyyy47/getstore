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

/** PocketFi's API rejects both /checkout/request and /virtual-accounts/create
 * with a 422 "The phone field is required" when no phone is sent -- confirmed
 * live against this business account, contrary to the docs' framing that
 * made it sound skippable. Nothing in this app currently collects a
 * customer's phone number, so this placeholder is sent whenever a real one
 * isn't available, matching the fallback pattern used elsewhere.
 *
 * IMPORTANT: this must look like a real Nigerian mobile number (leading 0 +
 * a real network prefix), not an obviously-fake string of zeros. Kuda
 * accepts a garbage phone number fine, but Paga's create-virtual-account
 * call was failing with a generic "Unable to process your request, please
 * contact support" specifically when the old all-zero placeholder
 * ("00000000000") was sent -- that's not a valid-looking number for any
 * network, and Paga's own backend evidently validates the format even
 * though PocketFi's own request-level validation doesn't. Using a
 * plausibly-formatted number (still not tied to any real subscriber) is the
 * fix -- if a future provider ALSO rejects this one, the message will now
 * include PocketFi's raw response (see createVirtualAccount below), so the
 * next failure will say exactly what's wrong instead of guessing again. */
const DUMMY_PHONE = "08100000000";

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
  /** PocketFi requires this field; falls back to DUMMY_PHONE when not
   * available (see that constant's comment). */
  phone?: string;
  redirectLink: string;
}): Promise<InitializePaymentResult> {
  const businessId = requireEnv("POCKETFI_BUSINESS_ID");

  const body = await pocketfiFetch<any>("/api/v1/checkout/request", {
    method: "POST",
    body: JSON.stringify({
      first_name: params.firstName,
      last_name: params.lastName,
      phone: params.phone || DUMMY_PHONE,
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

// Loose name hints used to pick out the right entry from PocketFi's
// `banks` array below -- see the comment on that array for why this
// matching exists at all.
const PROVIDER_NAME_HINTS: Record<string, string[]> = {
  saveheaven: ["saveheaven", "save heaven", "savehaven"],
  paga: ["paga"],
  kuda: ["kuda"],
  "9psb": ["9psb", "9 payment", "9 psb", "psb"],
  palmpay: ["palmpay", "palm pay"],
};

/**
 * PocketFi's create-virtual-account response key is plural ("banks"), and in
 * practice it can come back with MORE than one bank account in it -- e.g.
 * every partner bank enabled on the merchant's PocketFi dashboard, not just
 * the one named in the `bank` field of the request. The code used to just
 * take `banks[0]` unconditionally, which silently handed back whichever bank
 * happened to be listed first (in practice always the same one) regardless
 * of which provider was actually requested -- that's why switching the
 * Admin -> Settings provider (or a customer choosing "switch" on the
 * prompt) appeared to do nothing: the request itself was correct, but the
 * response was always read from the wrong array slot.
 *
 * This looks for the entry whose bank name actually matches the requested
 * provider. If there's only one entry, or a confident match, it's used. If
 * there are multiple entries and none match, it throws with the exact list
 * of bank names PocketFi returned, instead of silently returning the wrong
 * one again.
 */
function pickRequestedBank(banks: any[], bankProvider: string): any {
  if (banks.length === 1) return banks[0];

  const hints = PROVIDER_NAME_HINTS[bankProvider.toLowerCase()] ?? [bankProvider.toLowerCase()];
  const match = banks.find((b) => {
    const candidates = [b?.bank, b?.bankCode, b?.bank_code, b?.provider, b?.code, b?.slug, b?.bankName]
      .filter((v) => typeof v === "string")
      .map((v: string) => v.toLowerCase());
    return candidates.some((c) => hints.some((h) => c.includes(h)));
  });

  if (!match) {
    const names = banks.map((b) => b?.bankName ?? "unknown").join(", ");
    throw new Error(
      `PocketFi returned ${banks.length} accounts and none matched requested provider "${bankProvider}": ${names}`
    );
  }
  return match;
}

/**
 * POST /api/v1/virtual-accounts/create -- creates a dedicated (static)
 * virtual account for a customer. `phone` is required (falls back to
 * DUMMY_PHONE when not available -- see that constant's comment; confirmed
 * live that PocketFi 422s without it, despite this looking skippable from
 * the docs alone). `nin`/`bvn` are required specifically for the "palmpay"
 * bank per the docs and only sent when supplied.
 *
 * `bankProvider` must be one of the docs' literal codes: "saveheaven",
 * "paga", "kuda", "9psb", "palmpay" -- NOT the previous guessed set. If
 * Admin -> Settings has a different value saved (e.g. from before this
 * fix), update it there.
 *
 * IMPORTANT -- per the docs, `email` "must be unique per account", and
 * PocketFi's own guidance is one virtual account per customer. Calling this
 * a SECOND time with an email that already has an account on this business
 * (e.g. switching an existing customer to a different bank) is very likely
 * what was producing PocketFi's generic "Unable to process your request,
 * please contact support" response -- there's no documented endpoint to
 * change an existing account's bank, only create/fetch/delete. See
 * `deleteCustomer` below and switchPrimaryAccount in
 * pocketfi-virtual-account.ts, which now deletes the old customer record
 * first so the same email is free to register again on the new bank.
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
      phone: params.phone || DUMMY_PHONE,
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

  // PocketFi returned HTTP 200 (pocketfiFetch only throws on a non-2xx
  // status), but the body itself doesn't have a usable account -- this is
  // NOT a network/auth failure, it's PocketFi's own response shape not
  // matching what a successful create looks like (e.g. the requested
  // provider isn't actually enabled/KYC-approved on this merchant account).
  // Surface the raw body instead of a generic message so a real failure
  // says exactly what PocketFi sent back, rather than leaving it a mystery.
  const banks = body?.banks;
  if (!Array.isArray(banks) || banks.length === 0) {
    // Include the exact request we sent (minus phone/email, which aren't
    // needed to trace the call) plus a UTC timestamp -- when PocketFi says
    // this is "on our end" with no field-level error, the only way forward
    // is handing their support the precise request + moment so they can
    // pull it from their own server logs, since a generic "contact
    // support" message alone tells us nothing further to fix here.
    throw new Error(
      `PocketFi did not return a virtual account for provider "${params.bankProvider}" (businessId ${businessId}) at ${new Date().toISOString()} -- raw response: ${JSON.stringify(body)}`
    );
  }
  const account = pickRequestedBank(banks, params.bankProvider);
  if (!account?.accountNumber) {
    throw new Error(
      `PocketFi returned an account for "${params.bankProvider}" with no account number -- raw response: ${JSON.stringify(body)}`
    );
  }

  return {
    providerAccountId: String(account.accountNumber),
    accountNumber: String(account.accountNumber),
    bankName: String(account.bankName ?? "PocketFi"),
    accountName: account.accountName ?? null,
  };
}

/**
 * POST /api/v1/vcutomer/delete -- yes, "vcutomer" is the docs' literal
 * (misspelled) path, not a typo introduced here. Removes a customer's
 * record from PocketFi entirely for this business, keyed by email -- per
 * the docs there's no narrower "delete just this virtual account" endpoint.
 * Used by switchPrimaryAccount (pocketfi-virtual-account.ts) to free up an
 * email that already has an account so it can be re-registered on a
 * different bank -- see the big comment on createVirtualAccount above for
 * why this is necessary. This is NOT confirmed to only remove the virtual
 * account and leave transaction history intact; it may remove the whole
 * customer record, which is why the "switch" flow's old promise that "the
 * old account keeps working" no longer holds once this has been called.
 */
export async function deleteCustomer(email: string): Promise<void> {
  const businessId = requireEnv("POCKETFI_BUSINESS_ID");
  await pocketfiFetch<any>("/api/v1/vcutomer/delete", {
    method: "POST",
    body: JSON.stringify({ businessId, email }),
  });
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
