import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import type { Wallet } from "@/lib/types";
import * as daisysim from "@/lib/daisysim";
import BalanceCard from "@/components/BalanceCard";
import QuickActions from "@/components/QuickActions";
import DashboardFundingCard from "@/components/DashboardFundingCard";
import USOnlySection from "@/components/dashboard/USOnlySection";
import USACanadaSection from "@/components/dashboard/USACanadaSection";
import AllCountriesSection from "@/components/dashboard/AllCountriesSection";
import ProductsSection from "@/components/dashboard/ProductsSection";
import Link from "next/link";
import { IconPlus } from "@/components/icons";

const ACTIVE_RENTAL_STATUS = "waiting";
const SPENT_RENTAL_STATUSES = new Set(["waiting", "received", "done"]);

function monthStartUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export default async function DashboardPage() {
  const profile = await requireUser();
  const supabase = createClient();
  const thisMonthStart = monthStartUTC(new Date());

  const [
    { data: wallet },
    { count: activeRentalCount },
    settings,
    { data: templates },
    { data: monthRentals },
    { data: monthOrders },
  ] = await Promise.all([
    supabase.from("wallets").select("*").eq("user_id", profile.id).single(),
    supabase
      .from("rentals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("status", ACTIVE_RENTAL_STATUS),
    getSettings(),
    supabase
      .from("product_templates")
      .select("id, name, description, price_cents, available_count")
      .gt("available_count", 0),
    supabase
      .from("rentals")
      .select("status, price_cents")
      .eq("user_id", profile.id)
      .gte("created_at", thisMonthStart.toISOString()),
    supabase
      .from("product_orders")
      .select("price_cents")
      .eq("user_id", profile.id)
      .gte("created_at", thisMonthStart.toISOString()),
  ]);

  const w = wallet as Wallet | null;

  const spentThisMonthCents =
    (monthRentals ?? [])
      .filter((r: any) => SPENT_RENTAL_STATUSES.has(r.status))
      .reduce((sum: number, r: any) => sum + (r.price_cents ?? 0), 0) +
    (monthOrders ?? []).reduce((sum: number, o: any) => sum + (o.price_cents ?? 0), 0);

  // Flat, randomly-ordered list of every in-stock product -- deliberately
  // NOT grouped by category, unlike the full Marketplace page.
  const productItems = ((templates ?? []) as any[])
    .map((t) => ({
      id: t.id as string,
      name: t.name as string,
      description: (t.description ?? null) as string | null,
      price_cents: t.price_cents as number,
      available_count: t.available_count as number,
    }))
    .sort(() => Math.random() - 0.5);

  let countries: { id: number; name: string }[] = [];
  let countriesError: string | null = null;
  if (settings.countries_enabled) {
    try {
      countries = await daisysim.getCountries();
    } catch (e) {
      countriesError = e instanceof daisysim.DaisySimError ? e.message : "Failed to load countries";
    }
  }

  return (
    <div className="space-y-6">
      <BalanceCard
        name={profile.full_name ?? profile.email}
        email={profile.email}
        balanceCents={w?.balance_cents ?? 0}
        rate={settings.usd_to_ngn_rate}
        activeRentals={activeRentalCount ?? 0}
        spentThisMonthCents={spentThisMonthCents}
      />

      <section>
        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Quick actions</div>
        <QuickActions />
      </section>

      <section className="space-y-4">
        {settings.us_numbers_enabled && (
          <USOnlySection whatsappUrl={settings.whatsapp_url} telegramUrl={settings.telegram_url} />
        )}

        {settings.numbers_enabled && (
          <USACanadaSection
            extraActivationEnabled={settings.extra_activation_enabled}
            whatsappUrl={settings.whatsapp_url}
            telegramUrl={settings.telegram_url}
          />
        )}

        {settings.countries_enabled && (
          <AllCountriesSection
            countries={countries}
            loadError={countriesError}
            whatsappUrl={settings.whatsapp_url}
            telegramUrl={settings.telegram_url}
          />
        )}

        <ProductsSection templates={productItems} />
      </section>

      <section>
        {settings.pocketfi_enabled ? (
          <DashboardFundingCard />
        ) : (
          <Link
            href="/dashboard/topup"
            className="card flex items-center justify-between gap-3 p-4 transition-colors hover:border-[var(--hover-border)]"
          >
            <div>
              <div className="text-sm font-bold">Add funds</div>
              <div className="text-xs text-[var(--text-muted)]">Top up your wallet balance</div>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand">
              <IconPlus size={16} />
            </span>
          </Link>
        )}
      </section>
    </div>
  );
}
