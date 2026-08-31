import "server-only";

/**
 * Server-side wrapper for the "US Only" number-rental provider.
 *
 * NOTE ON THE FILENAME/EXPORTS: this module used to wrap DaisySim's server7
 * API. It has been swapped to wrap Getatext (https://getatext.com/api/v1)
 * instead -- Getatext sells US numbers only, same as the old provider, so
 * "US Only" as a customer-facing feature is unchanged. The file is still
 * named daisysim2.ts and still exports `DaisySim2Error` / the same function
 * signatures (getBalance, getCountries, getApps, purchase, checkStatus,
 * cancel) ON PURPOSE -- every route under src/app/api/daisysim2/*, the cron
 * auto-canceller, the admin pricing pages, and the `rentals.provider =
 * 'daisysim2'` value in the database all reference this exact module/name.
 * Renaming any of that would mean touching a dozen files and a DB check
 * constraint for zero customer-facing benefit -- keeping the name is a
 * deliberate choice, not an oversight.
 *
 * Field shapes below are taken directly from Getatext's API docs. Two
 * things worth knowing:
 *   - Getatext's JSON responses are FLAT (the payload fields sit at the top
 *     level next to `errors`), unlike the old provider's `{ data: {...} }`
 *     envelope -- `call()` below reflects that.
 *   - Getatext is US-only account-wide (no country selector in their API
 *     at all), so getCountries() below doesn't call Getatext -- there's
 *     nothing to ask -- it just returns a single synthetic "USA" entry so
 *     every existing caller (which expects a Country[] to pick from) keeps
 *     working unchanged.
 */

const BASE_URL = process.env.GETATEXT_BASE_URL ?? "https://getatext.com/api/v1";

export class DaisySim2Error extends Error {
  constructor(message: string, public code?: string, public status?: number, public data?: unknown) {
    super(message);
    this.name = "DaisySim2Error";
  }
}

function apiKey(): string {
  const key = process.env.GETATEXT_API_KEY;
  if (!key) throw new DaisySim2Error("GETATEXT_API_KEY is not set on the server");
  return key;
}

/**
 * Getatext auth is a plain `Auth: <key>` header (not `Authorization:
 * Bearer`), and success/failure is signalled by HTTP status + an `errors`
 * field that's `null` on success and a string on failure -- there's no
 * `{ data: ... }` envelope, the payload fields are top-level.
 */
async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Auth: apiKey(),
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);

  // Getatext's own docs are inconsistent about how "no error" is spelled --
  // most endpoints show a real JSON `null`, a few show the literal string
  // "null" -- so both are treated as "no error" here.
  const hasError = json?.errors != null && json.errors !== "null" && json.errors !== "";

  if (!res.ok || !json || hasError) {
    const message =
      (typeof json?.errors === "string" && json.errors !== "null" ? json.errors : null) ??
      `Getatext request failed (${res.status})`;
    throw new DaisySim2Error(message, undefined, res.status, json);
  }

  return json as T;
}

export interface Balance {
  balance: number;
  currency: string;
  email: string;
}

export async function getBalance(): Promise<Balance> {
  const data = await call<{ balance: string }>("/balance");
  return { balance: Number(data.balance), currency: "USD", email: "" };
}

/** Getatext has no country selector -- it's USA-only for the whole account,
 * so this is a synthetic single-entry list, not a live API call. Kept as an
 * async function returning the same Country[] shape so every existing
 * caller (which awaits this and picks an id) needs no changes. */
export interface Country {
  id: string;
  name: string;
}

export async function getCountries(): Promise<Country[]> {
  return [{ id: "USA", name: "United States" }];
}

export interface App {
  code: string;
  name: string;
  price: number;
}

interface GetatextPriceEntry {
  service_name: string;
  api_name: string;
  price: string | number;
  stock?: string | number;
}

/**
 * GET /prices-info -- Getatext's catalog of rentable services + live
 * price/stock. The `country` argument is accepted (and ignored) purely to
 * keep this function's signature identical to the old provider's -- there
 * is no per-country catalog here, it's one flat US catalog.
 *
 * The docs' sample response shows one bare object with no wrapper, but
 * every OTHER list-returning Getatext endpoint (auctions, long-rentals,
 * service-long-rentals, ...) wraps its array in a named key alongside
 * `status`/`errors` (e.g. `{ status, auctions: [...], errors }`) -- the
 * sample here is far more likely to be documentation shorthand for "one
 * element of the real list" than the literal top-level shape. So this
 * checks, in order: a bare array, then the common wrapper key names seen
 * elsewhere in Getatext's own docs, then finally falls back to treating the
 * response as a single entry. If none of those produce anything
 * resembling a price list, it throws instead of silently returning an
 * empty catalog -- an empty catalog with no error reads as "no products
 * configured" in the admin UI, which hides a real integration bug.
 */
export async function getApps(_country: string): Promise<App[]> {
  const data = await call<any>("/prices-info");

  const candidates: unknown = Array.isArray(data)
    ? data
    : (data?.services ?? data?.prices ?? data?.data ?? data?.items ?? data?.results);

  const list: GetatextPriceEntry[] = Array.isArray(candidates)
    ? candidates
    : data && typeof data === "object" && "api_name" in data
      ? [data]
      : [];

  if (list.length === 0) {
    throw new DaisySim2Error(
      "Getatext's /prices-info response didn't match any known shape -- check GETATEXT_API_KEY and the live response manually.",
      undefined,
      undefined,
      data
    );
  }

  return list
    .filter((e) => e && e.api_name && (e.stock === undefined || Number(e.stock) > 0))
    .map((e) => ({ code: e.api_name, name: e.service_name, price: Number(e.price) }));
}

export interface PurchaseResult {
  activation_id: string;
  phone_number: string;
  service: string;
  country: string;
  amount_charged: number;
  balance_after: number;
}

/**
 * POST /rent-a-number. `country`/`countryName` are accepted for signature
 * compatibility with the old provider but unused -- Getatext has no
 * country concept to pass. `appName` is likewise unused (Getatext returns
 * the canonical service_name itself in the response, so there's nothing to
 * forward).
 */
export async function purchase(opts: {
  country: string;
  app: string;
  appName?: string;
  countryName?: string;
}): Promise<PurchaseResult> {
  const data = await call<{
    id: number;
    number: string;
    service_name: string;
    price: string | number;
    new_balance: string | number;
  }>("/rent-a-number", {
    method: "POST",
    body: { service: opts.app },
  });

  return {
    activation_id: String(data.id),
    phone_number: data.number,
    service: data.service_name,
    country: "USA",
    amount_charged: Number(data.price),
    balance_after: Number(data.new_balance),
  };
}

export interface CheckResult {
  activation_id: string;
  status: "Waiting" | "Completed" | "Cancelled";
  code: string | null;
  phone_number: string;
}

/**
 * POST /rental-status. Getatext's own `status` vocabulary isn't fully
 * documented (only "active" appears in the docs' example), so this treats
 * a non-empty `code` as the authoritative "Completed" signal regardless of
 * the literal status string, and only reads `status` to detect
 * cancellation -- matching the tri-state (Waiting/Completed/Cancelled)
 * every caller of this function already expects.
 */
export async function checkStatus(activationId: string): Promise<CheckResult> {
  const data = await call<{ id: number; status: string; code: string | null; number: string }>(
    "/rental-status",
    { method: "POST", body: { id: numericId(activationId) } }
  );

  const status: CheckResult["status"] = data.code
    ? "Completed"
    : /cancel/i.test(data.status)
      ? "Cancelled"
      : "Waiting";

  return {
    activation_id: String(data.id),
    status,
    code: data.code,
    phone_number: data.number,
  };
}

export interface CancelResult {
  activation_id: string;
  refund: number;
  balance_after: number;
}

/**
 * POST /cancel-rental. Getatext's docs don't enumerate this endpoint's
 * error responses, so failure handling here is defensive rather than
 * matched against documented strings:
 *   - if a code has already arrived for this rental (checked via
 *     /rental-status), this throws with code "CODE_RECEIVED" -- matching
 *     what every cancel route already special-cases (the code landed right
 *     as the cancel was requested, so the rental is kept instead of
 *     cancelled).
 *   - if the failure message mentions waiting/timing, this throws with
 *     code "TOO_EARLY" -- Getatext's docs mention accounts without
 *     "immediate cancellation" must wait 5 minutes, which callers already
 *     handle as a graceful "try again shortly" message.
 *   - anything else rethrows as-is; callers fall back to a generic error.
 */
export async function cancel(activationId: string): Promise<CancelResult> {
  try {
    const data = await call<{ id: number; code: string | null; cost: string | number; balance: string | number }>(
      "/cancel-rental",
      { method: "POST", body: { id: numericId(activationId) } }
    );
    return { activation_id: String(data.id), refund: Number(data.cost), balance_after: Number(data.balance) };
  } catch (e) {
    if (!(e instanceof DaisySim2Error)) throw e;

    try {
      const status = await checkStatus(activationId);
      if (status.status === "Completed" && status.code) {
        throw new DaisySim2Error(e.message, "CODE_RECEIVED", e.status, e.data);
      }
    } catch (inner) {
      if (inner instanceof DaisySim2Error && inner.code === "CODE_RECEIVED") throw inner;
      // rental-status lookup itself failed -- fall through to the original error below
    }

    if (/wait|minute|early/i.test(e.message)) {
      throw new DaisySim2Error(e.message, "TOO_EARLY", e.status, e.data);
    }
    throw e;
  }
}

function numericId(activationId: string): number | string {
  const n = Number(activationId);
  return Number.isFinite(n) ? n : activationId;
}
