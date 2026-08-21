import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface SupportLinks {
  support_url: string | null;
  whatsapp_url: string | null;
  telegram_url: string | null;
  twitter_url: string | null;
  instagram_url: string | null;
}

export interface AppSettings extends SupportLinks {
  usd_to_ngn_rate: number;
  numbers_enabled: boolean;
  countries_enabled: boolean;
  us_numbers_enabled: boolean;
  exchange_rate_mode: "manual" | "live";
  exchange_rate_updated_at: string | null;
  extra_activation_enabled: boolean;
  pocketfi_enabled: boolean;
  pocketfi_bank_provider: string;
}

const FALLBACK: AppSettings = {
  usd_to_ngn_rate: 1650,
  numbers_enabled: true,
  countries_enabled: true,
  us_numbers_enabled: true,
  support_url: null,
  whatsapp_url: null,
  telegram_url: null,
  twitter_url: null,
  instagram_url: null,
  exchange_rate_mode: "manual",
  exchange_rate_updated_at: null,
  extra_activation_enabled: false,
  pocketfi_enabled: false,
  pocketfi_bank_provider: "paga",
};

/**
 * Reads the singleton app_settings row. Uses the service-role client
 * because this needs to be readable from non-admin pages too (e.g. the
 * customer-facing Numbers/All Countries pages need the exchange rate and
 * the enabled flags, and every public page needs the support/social links),
 * and app_settings' RLS policy restricts direct reads to admins.
 *
 * The select() column list is a string literal (not built from a variable)
 * on purpose -- supabase-js's typed client can only infer the shape of
 * `data` from a literal string, so a dynamically-built one silently
 * degrades to a generic/untyped row and breaks type-checking below.
 */
export async function getSettings(): Promise<AppSettings> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_settings")
    .select(
      "usd_to_ngn_rate, numbers_enabled, countries_enabled, us_numbers_enabled, support_url, whatsapp_url, telegram_url, twitter_url, instagram_url, exchange_rate_mode, exchange_rate_updated_at, extra_activation_enabled, pocketfi_enabled, pocketfi_bank_provider"
    )
    .eq("id", true)
    .single();

  if (!data) return FALLBACK;
  return {
    usd_to_ngn_rate: Number(data.usd_to_ngn_rate),
    numbers_enabled: data.numbers_enabled,
    countries_enabled: data.countries_enabled,
    us_numbers_enabled: data.us_numbers_enabled,
    support_url: data.support_url ?? null,
    whatsapp_url: data.whatsapp_url ?? null,
    telegram_url: data.telegram_url ?? null,
    twitter_url: data.twitter_url ?? null,
    instagram_url: data.instagram_url ?? null,
    exchange_rate_mode: (data.exchange_rate_mode as "manual" | "live") ?? "manual",
    exchange_rate_updated_at: data.exchange_rate_updated_at ?? null,
    extra_activation_enabled: data.extra_activation_enabled ?? false,
    pocketfi_enabled: data.pocketfi_enabled ?? false,
    pocketfi_bank_provider: data.pocketfi_bank_provider ?? "paga",
  };
}

/** Just the support/social links, for pages that only need those. */
export async function getSupportLinks(): Promise<SupportLinks> {
  const settings = await getSettings();
  return {
    support_url: settings.support_url,
    whatsapp_url: settings.whatsapp_url,
    telegram_url: settings.telegram_url,
    twitter_url: settings.twitter_url,
    instagram_url: settings.instagram_url,
  };
}
