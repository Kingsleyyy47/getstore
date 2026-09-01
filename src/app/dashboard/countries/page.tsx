import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { formatNaira, type Wallet } from "@/lib/types";
import * as daisysim from "@/lib/daisysim";
import CountriesBrowser from "./CountriesBrowser";
import PageHeader from "@/components/PageHeader";
import { IconGlobe } from "@/components/icons";

export default async function CountriesPage() {
  const profile = await requireUser();
  const supabase = createClient();

  const [{ data: wallet }, settings] = await Promise.all([
    supabase.from("wallets").select("*").eq("user_id", profile.id).single(),
    getSettings(),
  ]);

  const w = wallet as Wallet | null;

  if (!settings.countries_enabled) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader icon={<IconGlobe />} title="All Countries" />
        <div className="card p-6 text-sm text-[var(--text-muted)]">
          This feature is currently unavailable. Please check back later.
        </div>
      </div>
    );
  }

  let countries: { id: number; name: string }[] = [];
  let loadError: string | null = null;
  try {
    countries = await daisysim.getCountries();
  } catch (e) {
    loadError = e instanceof daisysim.DaisySimError ? e.message : "Failed to load countries";
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        icon={<IconGlobe />}
        title="All Countries"
        subtitle={
          <>
            Pick a country and service to see live price tiers. Wallet balance:{" "}
            <strong>{formatNaira(w?.balance_cents ?? 0)}</strong>
          </>
        }
      />

      {loadError ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {loadError}
        </div>
      ) : (
        <CountriesBrowser
          countries={countries}
          whatsappUrl={settings.whatsapp_url}
          telegramUrl={settings.telegram_url}
        />
      )}
    </div>
  );
}
