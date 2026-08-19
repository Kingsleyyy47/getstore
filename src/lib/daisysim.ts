import "server-only";

/**
 * Server-side wrapper for the DaisySim Virtual Numbers API
 * (https://daisysim.com/api/v1/virtual). Bearer-token auth, JSON, USD
 * pricing. SERVER-ONLY: reads the secret DAISYSIM_API_KEY.
 *
 * This is the second Numbers provider (alongside DaisySMS), reached from
 * the "All Countries" flow: pick a country, pick a service, pick a price
 * tier, purchase, poll for the code.
 */

const BASE_URL = process.env.DAISYSIM_BASE_URL ?? "https://daisysim.com/api/v1/virtual";

export class DaisySimError extends Error {
  constructor(message: string, public code?: string, public status?: number) {
    super(message);
    this.name = "DaisySimError";
  }
}

function apiKey(): string {
  const key = process.env.DAISYSIM_API_KEY;
  if (!key) throw new DaisySimError("DAISYSIM_API_KEY is not set on the server");
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
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);

  if (!json || json.success !== true) {
    const message = json?.error ?? `DaisySim request failed (${res.status})`;
    throw new DaisySimError(message, json?.code, res.status);
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

export interface CountriesResponse {
  countries: { id: number; name: string }[];
}

export async function getCountries(): Promise<CountriesResponse["countries"]> {
  const data = await call<CountriesResponse>("/countries");
  return data.countries;
}

export interface ServicesResponse {
  country_id: number;
  services: { code: string; name: string }[];
}

export async function getServices(countryId: number): Promise<ServicesResponse["services"]> {
  const data = await call<ServicesResponse>(`/services/${countryId}`);
  return data.services;
}

export interface PricesResponse {
  country: number;
  service: string;
  total_numbers: number;
  tiers: { tier: number; price: number; available: number }[];
}

export async function getPrices(country: number, service: string): Promise<PricesResponse> {
  return call<PricesResponse>("/prices", { method: "POST", body: { country, service } });
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
  country: number;
  service: string;
  price: number;
  serviceName?: string;
}): Promise<PurchaseResult> {
  return call<PurchaseResult>("/purchase", {
    method: "POST",
    body: {
      country: opts.country,
      service: opts.service,
      price: opts.price,
      service_name: opts.serviceName,
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

export interface HistoryResponse {
  orders: HistoryOrder[];
  pagination: { current_page: number; per_page: number; total: number; last_page: number };
}

export async function getHistory(opts?: {
  page?: number;
  perPage?: number;
  status?: "waiting" | "completed" | "cancelled";
}): Promise<HistoryResponse> {
  return call<HistoryResponse>("/history", {
    query: { page: opts?.page, per_page: opts?.perPage, status: opts?.status },
  });
}
