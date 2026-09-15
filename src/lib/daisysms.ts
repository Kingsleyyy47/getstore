import "server-only";

/**
 * Minimal server-side DaisySMS API wrapper (https://daisysms.io/docs/api).
 * SERVER-ONLY: this reads the secret DAISYSMS_API_KEY. Never import this
 * into a Client Component.
 */

const BASE_URL = process.env.DAISYSMS_BASE_URL ?? "https://daisysms.io/stubs/handler_api.php";

export class DaisySMSError extends Error {
  /**
   * True for errors that are genuinely about the CUSTOMER's request (price
   * too low, nothing in stock right now, too many active rentals) -- safe
   * to show them verbatim. False (default) for technical/infra failures
   * (blocked by Cloudflare, bad API key, unexpected response shape) that
   * should never reach a customer -- those get logged to Admin ->
   * Notifications instead and the customer sees a generic message.
   */
  constructor(message: string, public raw?: string, public customerSafe = false) {
    super(message);
    this.name = "DaisySMSError";
  }
}

function apiKey(): string {
  const key = process.env.DAISYSMS_API_KEY;
  if (!key) throw new DaisySMSError("DAISYSMS_API_KEY is not set on the server");
  return key;
}

async function call(params: Record<string, string | number | undefined>) {
  const url = new URL(BASE_URL);
  url.searchParams.set("api_key", apiKey());
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  // Server-side fetch from a serverless function sends no User-Agent (or a
  // bare "node" one) by default, which some sites' Cloudflare bot
  // protection flags and answers with an HTML "Just a moment..." challenge
  // page instead of the real API response -- a real browser-like header
  // set avoids that for anything short of a full JS challenge.
  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  const body = (await res.text()).trim();

  // If Cloudflare (or similar) intercepted the request with a challenge
  // page, the body is HTML, not the plain "KEY:VALUE" or JSON text every
  // DaisySMS endpoint actually returns -- surface that clearly instead of
  // letting callers choke on it as if it were a normal API response.
  if (body.startsWith("<!DOCTYPE") || body.startsWith("<html")) {
    throw new DaisySMSError(
      "DaisySMS's API is currently blocking this request behind a security check (Cloudflare) instead of returning data. This isn't something a header change can always fix from our side -- if it keeps happening, DaisySMS support may need to allowlist this server. Try again shortly.",
      body.slice(0, 300)
    );
  }

  return { body, headers: res.headers };
}

export interface Rental {
  id: string;
  phone: string;
  priceDollars: number | null;
}

export async function getBalance(): Promise<number> {
  const { body } = await call({ action: "getBalance" });
  if (body === "BAD_KEY") throw new DaisySMSError("Invalid DaisySMS API key", body);
  const [, amount] = body.split(":");
  if (!amount) throw new DaisySMSError(`Unexpected getBalance response: ${body}`, body);
  return parseFloat(amount);
}

export async function getNumber(opts: {
  service: string;
  maxPriceDollars?: number;
  areas?: string;
  carriers?: string;
  number?: string;
}): Promise<Rental> {
  const { body, headers } = await call({
    action: "getNumber",
    service: opts.service,
    max_price: opts.maxPriceDollars,
    areas: opts.areas,
    carriers: opts.carriers,
    number: opts.number,
  });

  raiseForCommonErrors(body);

  const parts = body.split(":");
  if (parts.length === 3 && parts[0] === "ACCESS_NUMBER") {
    const priceHeader = headers.get("x-price");
    return {
      id: parts[1],
      phone: parts[2],
      priceDollars: priceHeader ? parseFloat(priceHeader) : null,
    };
  }
  throw new DaisySMSError(`Unexpected getNumber response: ${body}`, body);
}

function raiseForCommonErrors(body: string) {
  // Technical/config issues -- not the customer's fault, not customer-safe.
  if (body === "BAD_KEY") throw new DaisySMSError("Invalid DaisySMS API key", body);
  if (body === "NO_MONEY") throw new DaisySMSError("Insufficient DaisySMS platform balance", body);

  // Genuinely about this customer's request -- fine to show verbatim.
  if (body === "MAX_PRICE_EXCEEDED")
    throw new DaisySMSError("Current price exceeds the max price", body, true);
  if (body === "NO_NUMBERS") throw new DaisySMSError("No numbers available", body, true);
  if (body === "TOO_MANY_ACTIVE_RENTALS")
    throw new DaisySMSError("Too many active rentals; finish some before renting more", body, true);
}

export type StatusResult =
  | { status: "STATUS_OK"; code: string; fullText?: string }
  | { status: "STATUS_WAIT_CODE" }
  | { status: "STATUS_CANCEL" };

export async function getStatus(id: string, text = false): Promise<StatusResult> {
  const { body, headers } = await call({ action: "getStatus", id, text: text ? 1 : undefined });

  if (body === "NO_ACTIVATION") throw new DaisySMSError("Unknown activation ID", body);
  if (body === "STATUS_WAIT_CODE") return { status: "STATUS_WAIT_CODE" };
  if (body === "STATUS_CANCEL") return { status: "STATUS_CANCEL" };

  const parts = body.split(":");
  if (parts.length === 2 && parts[0] === "STATUS_OK") {
    return {
      status: "STATUS_OK",
      code: parts[1],
      fullText: text ? headers.get("x-text") ?? undefined : undefined,
    };
  }
  throw new DaisySMSError(`Unexpected getStatus response: ${body}`, body);
}

export async function setStatusDone(id: string): Promise<void> {
  const { body } = await call({ action: "setStatus", id, status: 6 });
  if (body === "ACCESS_ACTIVATION") return;
  if (body === "NO_ACTIVATION") throw new DaisySMSError("Unknown activation ID", body);
  throw new DaisySMSError(`Unexpected setStatus(done) response: ${body}`, body);
}

export async function cancelRental(id: string): Promise<void> {
  const { body } = await call({ action: "setStatus", id, status: 8 });
  if (body === "ACCESS_CANCEL") return;
  if (body === "ACCESS_READY")
    throw new DaisySMSError("Rental already has a code; can't cancel", body);
  throw new DaisySMSError(`Unexpected setStatus(cancel) response: ${body}`, body);
}

export interface ExtraActivation {
  id: string;
  phone: string;
  /**
   * Unix timestamp (seconds) the number will be ready to receive another
   * SMS, or null if it's ready immediately. Per DaisySMS's docs this can
   * shift earlier if other users finish their rentals on the same number
   * sooner than expected -- treat it as an estimate, not a guarantee.
   */
  readyAt: number | null;
}

/**
 * Requests an additional SMS code on a number that already received one,
 * per DaisySMS's docs: "You may want to get an additional message after
 * you've already received one previously on the same number." Pass the
 * PREVIOUS activation's id (the DaisySMS-side id, not our rentals.id).
 *
 * Per the docs, DaisySMS may garnish a $0.20 penalty from the platform's
 * balance if this is requested but no message ever arrives -- so this
 * should only be offered to customers after they've genuinely received a
 * code already, not as a free-for-all retry button.
 */
export async function getExtraActivation(previousActivationId: string): Promise<ExtraActivation> {
  const { body } = await call({
    action: "getExtraActivation",
    activationId: previousActivationId,
  });

  if (body === "BAD_ID") {
    throw new DaisySMSError(
      "That rental can't request another code (missing, or already got one)",
      body
    );
  }

  const parts = body.split(":");
  if (parts[0] === "ASLEEP" && parts.length === 4) {
    return { id: parts[1], phone: parts[2], readyAt: Number(parts[3]) };
  }
  if (parts[0] === "ACCESS_NUMBER" && parts.length === 3) {
    return { id: parts[1], phone: parts[2], readyAt: null };
  }
  throw new DaisySMSError(`Unexpected getExtraActivation response: ${body}`, body);
}

export async function getPrices(service?: string, country?: string): Promise<unknown> {
  const { body } = await call({ action: "getPrices", service, country });
  return JSON.parse(body);
}

export async function getPricesVerification(service?: string, country?: string): Promise<unknown> {
  const { body } = await call({ action: "getPricesVerification", service, country });
  if (body === "BAD_KEY") throw new DaisySMSError("Invalid DaisySMS API key", body);
  try {
    return JSON.parse(body);
  } catch {
    throw new DaisySMSError(`getPricesVerification returned non-JSON: ${body.slice(0, 300)}`, body);
  }
}

export interface CatalogEntry {
  code: string;
  costUsd: number;
  available: number;
}

/**
 * Flattens getPricesVerification()'s response into a simple per-service
 * catalog for the admin pricing manager.
 *
 * PARTIALLY CONFIRMED: DaisySMS's own docs confirm the outer shape is
 * "service => country => data" (i.e. { [serviceCode]: { [countryId]:
 * <data> } }), matching what this function already assumed. What the docs
 * don't spell out is the exact field names inside <data> -- only that it
 * carries remaining-number counts (capped display at "100" for anything
 * over 100) and pricing. This still assumes `{ cost: number; count:
 * number }` per the same handler_api.php convention DaisySMS's other
 * endpoints follow. For each service, this picks the LOWEST-cost country
 * entry (so the displayed "cost" is the best price DaisySMS currently
 * offers for that service). If the USA & Canada pricing page comes back
 * empty, paste one real sample response and the field names can be
 * corrected in a couple of minutes.
 */
export async function listCatalog(): Promise<CatalogEntry[]> {
  const raw = (await getPricesVerification()) as unknown;
  if (!raw || typeof raw !== "object") {
    throw new DaisySMSError(
      `getPricesVerification returned a non-object response: ${JSON.stringify(raw).slice(0, 300)}`
    );
  }

  // DaisySMS's docs only loosely spell out the field names inside each
  // per-country entry -- try the common variants handler_api.php-style
  // APIs use for "unit cost" and "remaining count" before giving up.
  const COST_KEYS = ["cost", "price", "retail_price", "cost_usd", "Price"];
  const COUNT_KEYS = ["count", "quantity", "qty", "available", "Qty"];

  function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
    for (const k of keys) {
      const n = Number(obj[k]);
      if (Number.isFinite(n)) return n;
    }
    return null;
  }

  const entries: CatalogEntry[] = [];
  for (const [code, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const valueObj = value as Record<string, unknown>;

    // The real response is FLAT: { [service]: { cost, count, multi } } --
    // no per-country nesting at all, despite DaisySMS's docs implying one.
    // Try that shape first...
    const directCost = pickNumber(valueObj, COST_KEYS);
    let best: { cost: number; count: number } | null =
      directCost !== null ? { cost: directCost, count: pickNumber(valueObj, COUNT_KEYS) ?? 0 } : null;

    // ...and fall back to the nested { [service]: { [countryId]: {cost,
    // count} } } shape in case a different DaisySMS endpoint/response does
    // nest by country.
    if (!best) {
      for (const countryEntry of Object.values(valueObj)) {
        if (!countryEntry || typeof countryEntry !== "object") continue;
        const entry = countryEntry as Record<string, unknown>;
        const cost = pickNumber(entry, COST_KEYS);
        const count = pickNumber(entry, COUNT_KEYS) ?? 0;
        if (cost === null) continue;
        if (!best || cost < best.cost) best = { cost, count };
      }
    }

    if (best) entries.push({ code, costUsd: best.cost, available: best.count });
  }

  if (entries.length === 0) {
    // Nothing matched any known field-name shape -- surface the raw
    // response instead of silently showing "No products found", so the
    // real field names can be read off and added above.
    throw new DaisySMSError(
      `DaisySMS pricing response didn't match any known shape. Raw sample: ${JSON.stringify(raw).slice(0, 500)}`
    );
  }

  return entries;
}
