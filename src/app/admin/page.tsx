import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import {
  IconHome,
  IconUsers,
  IconUser,
  IconWallet,
  IconTag,
  IconBox,
  IconUpload,
  IconShield,
  IconBell,
  IconSettings,
  IconReceipt,
  IconDownload,
  IconBolt,
  IconPhone,
  IconHistory,
  IconStore,
} from "@/components/icons";

function dayStartUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export default async function AdminHomePage() {
  await requireRole("admin");
  const supabase = createClient();
  const todayStart = dayStartUTC(new Date()).toISOString();

  const [
    { count: customerCount },
    { count: newCustomersToday },
    { count: pendingTopups },
    { count: topupsToday },
    { data: wallets },
    { data: walletTxToday },
    { data: allTopups },
    { data: allPurchases },
    { count: rentalsWaiting },
    { count: rentalsWaitingToday },
    { count: rentalsEver },
    { count: rentalsToday },
    { count: productsLive },
    { count: productsAddedToday },
    { count: marketplaceOrders },
    { count: marketplaceOrdersToday },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    // "+N today" per card -- each one counts today's new rows for that same
    // metric, so the tiny tag always reads as "this many of these happened
    // today" rather than some unrelated number.
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart),
    supabase.from("topup_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("topup_requests")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart),
    supabase.from("wallets").select("balance_cents"),
    // Every wallet_transactions row from today, in one query -- covers the
    // "wallet balances held" delta (positive side), "active customers
    // today" (distinct user_id), and today's slice of deposits/revenue
    // below, instead of a separate round-trip per card.
    supabase.from("wallet_transactions").select("user_id, type, amount_cents").gte("created_at", todayStart),
    // All-time deposits and revenue need the full ledger, not just today --
    // same "fetch rows, sum in JS" approach already used for `wallets`
    // above. Fine at today's scale; move to a database-side sum/RPC if the
    // ledger grows large enough for this to matter.
    supabase.from("wallet_transactions").select("amount_cents").eq("type", "topup"),
    supabase.from("wallet_transactions").select("amount_cents").eq("type", "purchase"),
    // rentals spans all three number providers (daisysms/daisysim/daisysim2
    // all write into this one table, see 004_daisysim.sql) so every rentals
    // query here already covers every provider without a `provider` filter.
    supabase.from("rentals").select("*", { count: "exact", head: true }).eq("status", "waiting"),
    supabase
      .from("rentals")
      .select("*", { count: "exact", head: true })
      .eq("status", "waiting")
      .gte("created_at", todayStart),
    supabase.from("rentals").select("*", { count: "exact", head: true }),
    supabase.from("rentals").select("*", { count: "exact", head: true }).gte("created_at", todayStart),
    supabase.from("product_templates").select("*", { count: "exact", head: true }).eq("archived", false),
    supabase
      .from("product_templates")
      .select("*", { count: "exact", head: true })
      .eq("archived", false)
      .gte("created_at", todayStart),
    supabase.from("product_orders").select("*", { count: "exact", head: true }),
    supabase.from("product_orders").select("*", { count: "exact", head: true }).gte("created_at", todayStart),
  ]);

  const totalHeldCents = (wallets ?? []).reduce((sum, w: any) => sum + (w.balance_cents ?? 0), 0);

  const txToday = walletTxToday ?? [];
  const creditedTodayCents = txToday
    .filter((t: any) => t.amount_cents > 0)
    .reduce((sum: number, t: any) => sum + t.amount_cents, 0);
  const depositsTodayCents = txToday
    .filter((t: any) => t.type === "topup")
    .reduce((sum: number, t: any) => sum + t.amount_cents, 0);
  const revenueTodayCents = txToday
    .filter((t: any) => t.type === "purchase")
    .reduce((sum: number, t: any) => sum + Math.abs(t.amount_cents), 0);
  const activeCustomersToday = new Set(txToday.map((t: any) => t.user_id)).size;

  const totalDepositsCents = (allTopups ?? []).reduce((sum: number, t: any) => sum + t.amount_cents, 0);
  const totalRevenueCents = (allPurchases ?? []).reduce((sum: number, t: any) => sum + Math.abs(t.amount_cents), 0);

  const cards = [
    {
      label: "Total users",
      value: customerCount ?? 0,
      today: `+${newCustomersToday ?? 0} users today`,
      icon: <IconUsers />,
      color: "bg-brand/10 text-brand",
    },
    {
      label: "Active customers today",
      value: activeCustomersToday,
      today: `${activeCustomersToday > 0 ? "transacted" : "no activity"} today`,
      icon: <IconUser />,
      color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    },
    {
      label: "Pending top-ups",
      value: pendingTopups ?? 0,
      today: `+${topupsToday ?? 0} requests today`,
      icon: <IconWallet />,
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
      label: "Total wallet balances held",
      value: formatNaira(totalHeldCents),
      today: `+${formatNaira(creditedTodayCents)} today`,
      icon: <IconReceipt />,
      color: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    },
    {
      label: "Total deposits (customers only)",
      value: formatNaira(totalDepositsCents),
      today: `+${formatNaira(depositsTodayCents)} today`,
      icon: <IconDownload />,
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Total revenue (all-time)",
      value: formatNaira(totalRevenueCents),
      today: `+${formatNaira(revenueTodayCents)} today`,
      icon: <IconBolt />,
      color: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    },
    {
      label: "Rentals waiting for SMS",
      value: rentalsWaiting ?? 0,
      today: `+${rentalsWaitingToday ?? 0} today`,
      icon: <IconPhone />,
      color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    },
    {
      label: "Total rentals ever",
      value: rentalsEver ?? 0,
      today: `+${rentalsToday ?? 0} today`,
      icon: <IconHistory />,
      color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    },
    {
      label: "Marketplace products live",
      value: productsLive ?? 0,
      today: `+${productsAddedToday ?? 0} added today`,
      icon: <IconStore />,
      color: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    },
    {
      label: "Marketplace orders",
      value: marketplaceOrders ?? 0,
      today: `+${marketplaceOrdersToday ?? 0} today`,
      icon: <IconBox />,
      color: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    },
  ];

  const links = [
    {
      href: "/admin/categories",
      label: "Categories",
      desc: "Group product templates, e.g. Twitch, Twitter, VPN",
      icon: <IconTag />,
    },
    {
      href: "/admin/product-templates",
      label: "Product Templates",
      desc: "Create sellable products and set ₦ prices",
      icon: <IconBox />,
    },
    {
      href: "/admin/bulk-upload",
      label: "Bulk Upload",
      desc: "Upload CSV account stock for a product template",
      icon: <IconUpload />,
    },
    {
      href: "/admin/customers",
      label: "Customers",
      desc: "View any customer's wallet, rentals, and activity",
      icon: <IconUsers />,
    },
    {
      href: "/admin/topups",
      label: "Top-up requests",
      desc: "Approve or reject pending manual top-ups",
      icon: <IconWallet />,
    },
    { href: "/admin/roles", label: "Roles", desc: "Promote/demote admin accounts", icon: <IconShield /> },
    {
      href: "/admin/announcements",
      label: "Announcements",
      desc: "Push a pop-up message to all signed-in users",
      icon: <IconBell />,
    },
    {
      href: "/admin/settings",
      label: "Settings",
      desc: "₦/USD exchange rate and enable/disable Numbers",
      icon: <IconSettings />,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader icon={<IconHome />} title="Admin overview" subtitle="A quick snapshot of the whole platform." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="card flex items-center gap-4 p-6">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${c.color}`}>
              {c.icon}
            </span>
            <div className="min-w-0">
              <div className="text-sm text-[var(--text-muted)]">{c.label}</div>
              <div className="text-2xl font-extrabold">{c.value}</div>
              {/* Tiny "+N today" tag -- how many of this exact metric
                  happened today, so it's obvious at a glance whether
                  anything moved since this morning. */}
              <div className="mt-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {c.today}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="card flex items-start gap-4 p-6 hover:border-brand">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              {l.icon}
            </span>
            <div className="min-w-0">
              <div className="font-bold">{l.label}</div>
              <div className="text-sm text-[var(--text-muted)]">{l.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
