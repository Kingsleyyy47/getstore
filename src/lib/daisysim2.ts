import "server-only";

/**
 * Server-side wrapper for the "DaisySim API 2" server (server7,
 * https://daisysim.com/api/v1/server7). This is a SEPARATE, independent
 * provider from both DaisySMS (the "USA & Canada" flow) and the original
 * DaisySim virtual-numbers API (the "All Countries" flow) -- it is not a
 * replacement for either. It is USA-only, and is surfaced to customers as
 * "US Only". Bearer-token auth, JSON. SERVER-ONLY: reads the secret
 * DAISYSIM2_API_KEY.
 *
 * Shape differs from the original DaisySim client in a few ways the docs
 * called out explicitly:
 *   - a single /apps/{country} call returns the purchasable apps (with
 *     price) for a country, instead of separate /services + /prices calls
 *   - /purchase takes an `app` code directly (no separate tier/price step --
 *     the server resolves the current price itself; we never send a
 *     client-supplied price)
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
  const key = process.env.DAISYSIM2_API_KEY;
  if (!key) throw new DaisySim2Error("DAISYSIM2_API_KEY is not set on the server");
  return key;
}

async function call<T>(
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
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

export interface Country {
  id: number | string;
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

export async function getApps(country: Country["id"]): Promise<App[]> {
  const data = await call<{ apps: App[] }>(`/apps/${country}`);
  return data.apps;
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

/** Batched status check, capped at 20 ids per the API docs. */
export async function checkAll(activationIds: string[]): Promise<CheckResult[]> {
  const ids = activationIds.slice(0, 20);
  const data = await call<{ results: CheckResult[] }>("/check-all", {
    method: "POST",
    body: { ids },
  });
  return data.results;
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
  country: string;
  status: string;
  code: string | null;
  amount_charged: number;
  created_at: string;
  completed_at: string | null;
}

export async function getHistory(): Promise<HistoryOrder[]> {
  const data = await call<{ orders: HistoryOrder[] }>("/history");
  return data.orders;
}
