import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AppSettings {
  usd_to_ngn_rate: number;
  numbers_enabled: boolean;
  countries_enabled: boolean;
  us_numbers_enabled: boolean;
}

const FALLBACK: AppSettings = {
  usd_to_ngn_rate: 1650,
  numbers_enabled: true,
  countries_enabled: true,
  us_numbers_enabled: true,
};

/**
 * Reads the singleton app_settings row. Uses the service-role client
 * because this needs to be readable from non-admin pages too (e.g. the
 * customer-facing Numbers/All Countries pages need the exchange rate and
 * the enabled flags), and app_settings' RLS policy restricts direct reads
 * to admins.
 */
export async function getSettings(): Promise<AppSettings> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_settings")
    .select("usd_to_ngn_rate, numbers_enabled, countries_enabled, us_numbers_enabled")
    .eq("id", true)
    .single();

  if (!data) return FALLBACK;
  return {
    usd_to_ngn_rate: Number(data.usd_to_ngn_rate),
    numbers_enabled: data.numbers_enabled,
    countries_enabled: data.countries_enabled,
    us_numbers_enabled: data.us_numbers_enabled,
  };
}
