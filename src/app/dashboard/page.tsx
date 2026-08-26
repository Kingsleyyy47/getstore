import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import type { Rental, Wallet } from "@/lib/types";
import BalanceCard from "@/components/BalanceCard";
import QuickActions from "@/components/QuickActions";
import DashboardStats from "@/components/DashboardStats";
import RecentPurchases, { type PurchaseItem } from "@/components/RecentPurchases";
import DashboardFundingCard from "@/components/DashboardFundingCard";
import Link from "next/link";
import { IconPlus } from "@/components/icons";

const ACTIVE_RENTAL_STATUS = "waiting";
// Money already left the wallet for these and hasn't been refunded --
// cancelled/expired rentals ARE refunded (see src/lib/rentals.ts), so they
// don't count as "spent".
const SPENT_RENTAL_STATUSES = new Set(["waiting", "received", "done"]);

function monthStartUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export default async function DashboardPage() {
  const profile = await requireUser();
  const supabase = createClient();

  const now = new Date();
  const thisMonthStart = monthStartUTC(now);
  const prevMonthStart = new Date(Date.UTC(thisMonthStart.getUTCFullYear(), thisMonthStart.getUTCMonth() - 1, 1));
  const dayOfMonth = now.getUTCDate();

  const [
    { data: wallet },
    { data: recentRentals },
    { data: recentOrders },
    { count: activeRentalCount },
    settings,
    { data: monthRentals },
    { data: monthOrders },
    { data: prevMonthRentals },
    { data: prevMonthOrders },
  ] = await Promise.all([
    supabase.from("wallets").select("*").eq("user_id", profile.id).single(),
    supabase
      .from("rentals")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("product_orders")
      .select("*, product_templates(name, categories(name))")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("rentals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("status", ACTIVE_RENTAL_STATUS),
    getSettings(),
    supabase
      .from("rentals")
      .select("status, price_cents, created_at")
      .eq("user_id", profile.id)
      .gte("created_at", thisMonthStart.toISOString()),
    supabase
      .from("product_orders")
      .select("price_cents, created_at")
      .eq("user_id", profile.id)
      .gte("created_at", thisMonthStart.toISOString()),
    supabase
      .from("rentals")
      .select("status, price_cents")
      .eq("user_id", profile.id)
      .gte("created_at", prevMonthStart.toISOString())
      .lt("created_at", thisMonthStart.toISOString()),
    supabase
      .from("product_orders")
      .select("price_cents")
      .eq("user_id", profile.id)
      .gte("created_at", prevMonthStart.toISOString())
      .lt("created_at", thisMonthStart.toISOString()),
  ]);

  const w = wallet as Wallet | null;
  const rentalList = (recentRentals ?? []) as Rental[];
  const orderList = recentOrders ?? [];

  // ---- "This month" stats ----
  const mRentals = monthRentals ?? [];
  const mOrders = monthOrders ?? [];
  const pRentals = prevMonthRentals ?? [];
  const pOrders = prevMonthOrders ?? [];

  const completedThisMonth =
    mRentals.filter((r) => r.status === "done" || r.status === "received").length + mOrders.length;
  const completedPrevMonth =
    pRentals.filter((r) => r.status === "done" || r.status === "received").length + pOrders.length;

  const spentThisMonthCents =
    mRentals.filter((r) => SPENT_RENTAL_STATUSES.has(r.status)).reduce((sum, r) => sum + r.price_cents, 0) +
    mOrders.reduce((sum, o) => sum + o.price_cents, 0);
  const spentPrevMonthCents =
    pRentals.filter((r) => SPENT_RENTAL_STATUSES.has(r.status)).reduce((sum, r) => sum + r.price_cents, 0) +
    pOrders.reduce((sum, o) => sum + o.price_cents, 0);

  const completedTrendPct = completedPrevMonth > 0 ? ((completedThisMonth - completedPrevMonth) / completedPrevMonth) * 100 : null;
  const spentTrendPct = spentPrevMonthCents > 0 ? ((spentThisMonthCents - spentPrevMonthCents) / spentPrevMonthCents) * 100 : null;

  // Daily spend buckets for the sparkline, day 1 through today.
  const dailySpendCents = Array.from({ length: dayOfMonth }, () => 0);
  const addToDay = (createdAt: string, cents: number) => {
    const day = new Date(createdAt).getUTCDate();
    if (day >= 1 && day <= dailySpendCents.length) dailySpendCents[day - 1] += cents;
  };
  mRentals.filter((r) => SPENT_RENTAL_STATUSES.has(r.status)).forEach((r) => addToDay(r.created_at, r.price_cents));
  mOrders.forEach((o) => addToDay(o.created_at, o.price_cents));

  // ---- Merged "recent purchases" feed ----
  const purchaseItems: PurchaseItem[] = [
    ...rentalList.map(
      (r): PurchaseItem => ({
        id: `rental-${r.id}`,
        title: `${r.service} number`,
        meta: `${r.country ? `${r.country} · ` : ""}+${r.phone}`,
        priceCents: r.price_cents,
        status: r.status,
        href: null,
        createdAt: r.created_at,
      })
    ),
    ...orderList.map(
      (o: any): PurchaseItem => ({
        id: `order-${o.id}`,
        title: o.product_templates?.name ?? "Marketplace account",
        meta: `Marketplace${o.product_templates?.categories?.name ? ` · ${o.product_templates.categories.name}` : ""}`,
        priceCents: o.price_cents,
        status: "done",
        href: `/dashboard/orders/${o.id}`,
        createdAt: o.created_at,
      })
    ),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <BalanceCard
        name={profile.full_name ?? ""}
        email={profile.email}
        balanceCents={w?.balance_cents ?? 0}
        rate={settings.usd_to_ngn_rate}
        activeRentals={activeRentalCount ?? 0}
        spentThisMonthCents={spentThisMonthCents}
      />

      <section>
        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
          Quick actions
        </div>
        <QuickActions />
      </section>

      <section>
        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
          This month
        </div>
        <DashboardStats
          completedCount={completedThisMonth}
          completedTrendPct={completedTrendPct}
          spentCents={spentThisMonthCents}
          spentTrendPct={spentTrendPct}
          dailySpendCents={dailySpendCents}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr] lg:items-start">
        <RecentPurchases items={purchaseItems} />
        {settings.pocketfi_enabled ? (
          <DashboardFundingCard />
        ) : (
          <div className="card flex flex-col items-start gap-3 p-6">
            <h2 className="text-sm font-bold">Add funds</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Top up your wallet to start renting numbers or buying accounts.
            </p>
            <Link href="/dashboard/topup" className="btn-primary inline-flex items-center gap-1.5">
              <IconPlus size={16} />
              Go to Top-up
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
