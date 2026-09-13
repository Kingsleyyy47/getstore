import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import type { Wallet } from "@/lib/types";
import { getProductLogoMap, normalizeProductName } from "@/lib/productLogos";
import BalanceCard from "@/components/BalanceCard";
import QuickActions from "@/components/QuickActions";
import DashboardFundingCard from "@/components/DashboardFundingCard";
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
    productLogoMap,
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
      .select("id, name, description, price_cents, available_count, category_id, categories(name, logo_url)")
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
    getProductLogoMap(),
  ]);

  const w = wallet as Wallet | null;

  const spentThisMonthCents =
    (monthRentals ?? [])
      .filter((r: any) => SPENT_RENTAL_STATUSES.has(r.status))
      .reduce((sum: number, r: any) => sum + (r.price_cents ?? 0), 0) +
    (monthOrders ?? []).reduce((sum: number, o: any) => sum + (o.price_cents ?? 0), 0);

  // Same category + product data the full Marketplace page uses -- the
  // dashboard preview shuffles both the category order and each category's
  // products client-side instead of showing them alphabetically/by recency.
  const productItems = ((templates ?? []) as any[]).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    description: (t.description ?? null) as string | null,
    price_cents: t.price_cents as number,
    available_count: t.available_count as number,
    categoryId: (t.category_id ?? null) as string | null,
    categoryName: (t.categories?.name ?? null) as string | null,
    categoryLogoUrl: (t.categories?.logo_url ?? null) as string | null,
    // Site-wide, name-matched logo (Admin -> Logo) takes priority over
    // the category logo when both exist.
    logoUrl: (productLogoMap.get(normalizeProductName(t.name)) ?? t.categories?.logo_url ?? null) as
      | string
      | null,
  }));

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

      <section>
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
