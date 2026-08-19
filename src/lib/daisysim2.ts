import "server-only";

/**
 * Server-side wrapper for the "DaisySim API 2" server (server7,
 * https://daisysim.com/api/v1/server7). This is a SEPARATE, independent
 * provider from both DaisySMS (the "USA & Canada" flow) and the original
 * DaisySim virtual-numbers API (the "All Countries" flow) -- it is not a
 * replacement for either. It is USA-only, and is surfaced to customers as
 * "US Only". Bearer-token auth, JSON. SERVER-ONLY: reads the secret
 * DAISYSIM_API_KEY.
 *
 * This is the same DaisySim account/API key as src/lib/daisysim.ts -- one
 * company, two products under the same account -- so there is no separate
 * DAISYSIM2_API_KEY. Only the base URL differs (server7 vs. the original
 * /virtual endpoint).
 *
 * Field shapes below were copied verbatim from the server7 API docs
 * (not re-derived/guessed), including two things that differ from the
 * original DaisySim client's conventions:
 *   - GET /apps/{country} and POST /check-all return their payload as a
 *     bare array in `data` (NOT wrapped in a `{ apps: [...] }` /
 *     `{ results: [...] }` object like /countries and /history are)
 *   - /purchase takes an `app` code copied verbatim from /apps (never
 *     constructed/guessed) and never sends a price -- the server resolves
 *     the live price from the app code alone and returns what it actually
 *     charged as `amount_charged`
 *   - /cancel and /check use the same TOO_EARLY / CODE_RECEIVED error-code
 *     pattern as the original DaisySim API, so the existing cancel-route
 *     handling logic carries over directly
 *   - error responses are branched on by the `code` field, not by message
 *     text, per the docs' explicit guidance
 */

const BASE_URL = process.env.DAISYSIM2_BASE_URL ?? "https://daisysim.com/api/v1/server7";

export class DaisySim2Error extends Error {
  constructor(message: string, public code?: string, public status?: number, public data?: unknown) {
    super(message);
    this.name = "DaisySim2Error";
  }
}

function apiKey(): string {
  // Same DaisySim account key as the original provider -- not a separate
  // DAISYSIM2_API_KEY. Only the base URL is product-specific.
  const key = process.env.DAISYSIM_API_KEY;
  if (!key) throw new DaisySim2Error("DAISYSIM_API_KEY is not set on the server");
  return key;
}

async function call<T>(
  path: string,
  init?: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> }
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);

  if (!json || json.success !== true) {
    const message = json?.error ?? json?.message ?? `DaisySim (US) request failed (${res.status})`;
    throw new DaisySim2Error(message, json?.code, res.status, json?.data);
  }

  return json.data as T;
}

export interface Balance {
  balance: number;
  currency: string;
  email: string;
}

export async function getBalance(): Promise<Balance> {
  return call<Balance>("/balance");
}

/** Currently USA-only per the docs -- id is a string, e.g. "USA". */
export interface Country {
  id: string;
  name: string;
}

export async function getCountries(): Promise<Country[]> {
  const data = await call<{ countries: Country[] }>("/countries");
  return data.countries;
}

export interface App {
  code: string;
  name: string;
  price: number;
}

/**
 * Response is a bare array in `data` (not `{ apps: [...] }`). Sold-out
 * services are already excluded server-side, so this can be rendered
 * directly with no filtering.
 */
export async function getApps(country: Country["id"]): Promise<App[]> {
  return call<App[]>(`/apps/${country}`);
}

export interface PurchaseResult {
  activation_id: string;
  phone_number: string;
  service: string;
  country: string;
  amount_charged: number;
  balance_after: number;
}

export async function purchase(opts: {
  country: Country["id"];
  app: string;
  appName?: string;
  countryName?: string;
}): Promise<PurchaseResult> {
  return call<PurchaseResult>("/purchase", {
    method: "POST",
    body: {
      country: opts.country,
      app: opts.app,
      app_name: opts.appName,
      country_name: opts.countryName,
    },
  });
}

export interface CheckResult {
  activation_id: string;
  status: "Waiting" | "Completed" | "Cancelled";
  code: string | null;
  phone_number: string;
}

export async function checkStatus(activationId: string): Promise<CheckResult> {
  return call<CheckResult>(`/check/${activationId}`);
}

/** /check-all's per-item status set is wider than single /check's. */
export interface CheckAllResult {
  activation_id: string;
  status: "Completed" | "Waiting" | "Not Found" | "Invalid";
  code: string | null;
  /** Present for Completed/Waiting; omitted for Not Found/Invalid. */
  phone_number?: string;
}

/**
 * Batched status check, capped at 20 ids per the docs. Response is a bare
 * array in `data` (not `{ results: [...] }`).
 */
export async function checkAll(activationIds: string[]): Promise<CheckAllResult[]> {
  const ids = activationIds.slice(0, 20);
  return call<CheckAllResult[]>("/check-all", {
    method: "POST",
    body: { ids },
  });
}

export interface CancelResult {
  activation_id: string;
  refund: number;
  balance_after: number;
}

export async function cancel(activationId: string): Promise<CancelResult> {
  return call<CancelResult>(`/cancel/${activationId}`, { method: "POST" });
}

export interface HistoryOrder {
  activation_id: string;
  phone_number: string;
  service: string;
  service_code: string | null;
  country: string;
  status: string;
  code: string | null;
  amount_charged: number;
  created_at: string;
  completed_at: string | null;
}

export interface HistoryResponse {
  orders: HistoryOrder[];
  pagination: { current_page: number; per_page: number; total: number; last_page: number };
}

export async function getHistory(opts?: {
  page?: number;
  perPage?: number;
  status?: "completed" | "waiting" | "cancelled";
}): Promise<HistoryResponse> {
  return call<HistoryResponse>("/history", {
    query: { page: opts?.page, per_page: opts?.perPage, status: opts?.status },
  });
}
