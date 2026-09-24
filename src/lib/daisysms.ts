import "server-only";

/**
 * Minimal server-side DaisySMS API wrapper (https://daisysms.io/docs/api).
 * SERVER-ONLY: this reads the secret DAISYSMS_API_KEY. Never import this
 * into a Client Component.
 */

const DEFAULT_BASE_URL = "https://daisysms.io/stubs/handler_api.php";

/**
 * Keep deployments resilient to an accidentally broad or legacy env value.
 * DaisySMS's API is on daisysms.io, and the handler path is required; the
 * public site root returns HTML and cannot answer API actions.
 */
function baseUrl(): string {
  const configured = process.env.DAISYSMS_BASE_URL?.trim() || DEFAULT_BASE_URL;
  let url: URL;

  try {
    url = new URL(configured);
  } catch {
    throw new DaisySMSError(
      "Invalid DAISYSMS_BASE_URL. Use https://daisysms.io/stubs/handler_api.php"
    );
  }

  if (url.hostname === "daisysms.com" || url.hostname === "www.daisysms.com") {
    url.hostname = "daisysms.io";
  }
  if (url.hostname === "www.daisysms.io") {
    url.hostname = "daisysms.io";
  }
  if (url.hostname === "daisysms.io" && (!url.pathname || url.pathname === "/")) {
    url.pathname = "/stubs/handler_api.php";
  }

  return url.toString();
}

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

const REQUEST_TIMEOUT_MS = 12_000;

async function call(params: Record<string, string | number | undefined>) {
  const url = new URL(baseUrl());
  url.searchParams.set("api_key", apiKey());
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  // Previously this sent a spoofed desktop-Chrome User-Agent + Accept
  // headers on the theory that a plain server fetch looks more bot-like to
  // Cloudflare than a "real browser" one. Removing those was still the
  // right call (a server claiming to be Chrome while its actual TLS/HTTP
  // fingerprint obviously isn't Chrome is more suspicious, not less), but
  // it turned out not to be the whole story: DaisySMS/Cloudflare appears to
  // also block Vercel's shared serverless IP ranges outright, regardless of
  // headers. So when DAISYSMS_PROXY_URL is configured, route the actual
  // outbound call through a Supabase Edge Function instead (see
  // supabase/functions/daisysms-proxy) -- the same network a confirmed
  // -working reference DaisySMS integration uses successfully. Falls back
  // to calling DaisySMS directly if the proxy isn't configured.
  const proxyUrl = process.env.DAISYSMS_PROXY_URL?.trim();
  let res: Response;
  if (proxyUrl) {
    const proxySecret = process.env.DAISYSMS_PROXY_SECRET?.trim();
    if (!proxySecret) {
      throw new DaisySMSError(
        "DAISYSMS_PROXY_URL is set but DAISYSMS_PROXY_SECRET is missing -- set it to the same value configured on the Supabase daisysms-proxy function."
      );
    }
    let proxied: URL;
    try {
      proxied = new URL(proxyUrl);
    } catch {
      throw new DaisySMSError("Invalid DAISYSMS_PROXY_URL -- expected the deployed daisysms-proxy function URL.");
    }
    proxied.search = url.search;
    res = await fetchWithTimeout(proxied.toString(), 0, { "x-proxy-secret": proxySecret });
  } else {
    res = await fetchWithTimeout(url.toString());
  }
  const body = (await res.text()).trim();

  // The handler API returns plain text for most actions and JSON for pricing.
  // If the configured URL points at the public site, or a security layer
  // intercepts the request, the body is HTML instead. Do not describe every
  // HTML response as Cloudflare: a wrong base URL is a common and fixable
  // deployment error.
  const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
  const looksLikeHtml =
    body.startsWith("<!DOCTYPE") ||
    body.startsWith("<html") ||
    (contentType.includes("text/html") && /<html[\s>]|<!doctype html/i.test(body.slice(0, 500)));
  if (looksLikeHtml) {
    const endpoint = url.pathname === "/stubs/handler_api.php"
      ? "the DaisySMS API endpoint"
      : `the configured URL (${url.origin}${url.pathname})`;
    const guidance = proxyUrl
      ? "Requests are already routed through the daisysms-proxy Supabase Edge Function -- check that it's deployed, DAISYSMS_PROXY_SECRET matches on both sides, and DaisySMS/Cloudflare isn't now also blocking Supabase's network."
      : "Set DAISYSMS_BASE_URL to https://daisysms.io/stubs/handler_api.php. If that value is already correct, DaisySMS may be serving a security challenge to this server (common for Vercel's shared IPs) -- set DAISYSMS_PROXY_URL to route through a Supabase Edge Function instead (see supabase/functions/daisysms-proxy), or have support allowlist this server.";
    throw new DaisySMSError(
      `DaisySMS returned an HTML page instead of API data from ${endpoint}. ${guidance}`,
      body.slice(0, 300)
    );
  }

  return { body, headers: res.headers };
}

/** fetch with a hard timeout and one retry on a transient network error
 * (connection reset / abort / timeout) -- mirrors the retry-once pattern
 * of the reference integration above, and the same timeout-guard shape
 * already used for PocketFi (see src/lib/pocketfi.ts) so a stalled
 * request fails fast with a clear error instead of hanging the request
 * indefinitely. */
async function fetchWithTimeout(
  url: string,
  attempt = 0,
  headers?: Record<string, string>
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { cache: "no-store", signal: controller.signal, headers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isTransient =
      e instanceof Error &&
      (e.name === "AbortError" ||
        /connection reset|ECONNRESET|ETIMEDOUT|timeout/i.test(msg));
    if (isTransient && attempt === 0) {
      return fetchWithTimeout(url, attempt + 1, headers);
    }
    throw new DaisySMSError(
      e instanceof Error && e.name === "AbortError"
        ? `DaisySMS did not respond within ${REQUEST_TIMEOUT_MS / 1000}s`
        : `Failed to reach DaisySMS: ${msg}`
    );
  } finally {
    clearTimeout(timeoutId);
  }
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
  // Per DaisySMS's docs, ACCESS_READY covers both "rental missing" and
  // "already got the code" -- we can't tell which from the response alone,
  // but either way there's nothing left to cancel.
  if (body === "ACCESS_READY")
    throw new DaisySMSError("Can't cancel: this rental is missing or already has a code", body);
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
 * DaisySMS's docs confirm the outer shape is "service => country => data"
 * (i.e. { [serviceCode]: { [countryId]: <data> } }, country 187 = USA)
 * capping displayed remaining-number counts at "100". They don't spell out
 * the exact field names inside <data> though, so this still tries the
 * common handler_api.php-style names (`cost`/`count` and their usual
 * variants) for both that nested shape and a flat { [service]: {cost,
 * count} } shape some real responses have come back as, in case DaisySMS's
 * actual output doesn't match their own docs exactly. For each service,
 * this picks the LOWEST-cost country entry (so the displayed "cost" is the
 * best price DaisySMS currently offers for that service). If the USA &
 * Canada pricing page comes back empty, paste one real sample response and
 * the field names can be corrected in a couple of minutes.
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
