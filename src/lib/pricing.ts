import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PriceOverride {
  margin_cents: number | null;
  auto_markup: boolean;
  customer_price_cents: number | null;
}

/**
 * The single source of truth for "what does the customer actually pay,
 * in Naira cents, for this service" -- used by both the admin pricing
 * pages (to show a live preview) and the purchase routes.
 *
 * Precedence:
 *   1. customer_price_cents, if set -- a frozen override for THIS ONE
 *      product/country (set from the pricing manager's "Customer price"
 *      column).
 *   2. margin_cents, if auto_markup is on -- live cost * rate + a flat ₦
 *      margin for THIS ONE product/country, recomputed fresh every call so
 *      it tracks provider cost changes.
 *   3. neither -- the app-wide `markup_percent` from Admin -> Settings
 *      ("Global markup %"), applied to every DaisySMS/All Countries/US Only
 *      product that hasn't been individually overridden above. This is
 *      what makes the global setting act as "the markup for everything,
 *      with per-product overrides on top" -- change it once in Settings
 *      and every un-overridden price across every country updates; a
 *      product an admin has specifically priced (1 or 2 above) keeps its
 *      own number regardless of what the global percent is set to.
 */
export function computeEffectivePriceCents(
  costUsd: number,
  rate: number,
  markupPercent: number,
  override?: PriceOverride | null
): number {
  if (override?.customer_price_cents != null) {
    return override.customer_price_cents;
  }
  const baseCents = Math.round(costUsd * rate * 100);
  if (override?.auto_markup && override.margin_cents != null) {
    return baseCents + override.margin_cents;
  }
  return Math.round(baseCents * (1 + markupPercent / 100));
}

export interface ServicePriceRow extends PriceOverride {
  is_enabled: boolean;
}

/**
 * Looks up the admin-configured price override row (and enabled flag) for
 * one service, used by the actual purchase routes right before charging so
 * a customer's real bill matches what the admin pricing manager shows --
 * not just the flat global-markup fallback.
 *
 * `country` should be "" for daisysms (not country-scoped), and the
 * provider's country id (as a string) for daisysim / daisysim2, matching
 * how rows are written by the admin pricing API.
 */
export async function getServicePriceRow(
  provider: "daisysms" | "daisysim" | "daisysim2",
  country: string,
  serviceCode: string
): Promise<ServicePriceRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("provider_service_prices")
    .select("margin_cents, auto_markup, customer_price_cents, is_enabled")
    .eq("provider", provider)
    .eq("country", country)
    .eq("service_code", serviceCode)
    .maybeSingle();

  if (!data) return null;
  return {
    margin_cents: data.margin_cents,
    auto_markup: data.auto_markup,
    customer_price_cents: data.customer_price_cents,
    is_enabled: data.is_enabled,
  };
}

/**
 * Bulk version of getServicePriceRow for a whole provider/country at once
 * -- used by the customer-facing browse endpoints (which list many
 * services/apps per request) so the displayed price matches what the
 * purchase route will actually charge, without an N+1 query per item.
 */
export async function getServicePriceMap(
  provider: "daisysms" | "daisysim" | "daisysim2",
  country: string
): Promise<Map<string, ServicePriceRow>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("provider_service_prices")
    .select("service_code, margin_cents, auto_markup, customer_price_cents, is_enabled")
    .eq("provider", provider)
    .eq("country", country);

  const map = new Map<string, ServicePriceRow>();
  for (const row of data ?? []) {
    map.set(row.service_code as string, {
      margin_cents: row.margin_cents,
      auto_markup: row.auto_markup,
      customer_price_cents: row.customer_price_cents,
      is_enabled: row.is_enabled,
    });
  }
  return map;
}
