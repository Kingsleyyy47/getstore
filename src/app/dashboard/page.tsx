import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { formatNaira, type Rental, type Wallet } from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import BalanceCard from "@/components/BalanceCard";
import { IconReceipt, IconStore, IconPhone, IconGlobe, IconFlag } from "@/components/icons";

const QUICK_ACTIONS = [
  { href: "/dashboard/marketplace", icon: <IconStore />, label: "Buy Account", color: "bg-violet-500" },
  { href: "/dashboard/purchase", icon: <IconPhone />, label: "Buy USA Numbers", color: "bg-sky-500" },
  { href: "/dashboard/us-numbers", icon: <IconFlag />, label: "US Only", color: "bg-amber-500" },
  { href: "/dashboard/countries", icon: <IconGlobe />, label: "Other Countries", color: "bg-emerald-500" },
];

export default async function DashboardPage() {
  const profile = await requireUser();
  const supabase = createClient();

  const [{ data: wallet }, { data: rentals }, settings] = await Promise.all([
    supabase.from("wallets").select("*").eq("user_id", profile.id).single(),
    supabase
      .from("rentals")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(5),
    getSettings(),
  ]);

  const w = wallet as Wallet | null;
  const rentalList = (rentals ?? []) as Rental[];

  return (
    <div className="space-y-8">
      <BalanceCard
        name={profile.full_name ?? ""}
        email={profile.email}
        balanceCents={w?.balance_cents ?? 0}
        rate={settings.usd_to_ngn_rate}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="card flex flex-col items-center gap-2 p-4 text-center hover:border-[var(--hover-border)] sm:p-5"
          >
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl text-white ${a.color}`}>
              {a.icon}
            </span>
            <span className="text-xs font-semibold sm:text-sm">{a.label}</span>
          </Link>
        ))}
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Recent rentals</h2>
          <Link href="/dashboard/logs" className="text-sm text-brand hover:underline">
            View all history
          </Link>
        </div>
        <div className="card divide-y divide-[var(--border)]">
          {rentalList.length === 0 && (
            <EmptyState
              icon={<IconReceipt />}
              title="No rentals yet"
              body="Rent your first number to see it show up here."
              actionHref="/dashboard/purchase"
              actionLabel="Buy your first number"
            />
          )}
          {rentalList.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-2 px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <div className="min-w-0">
                <div className="font-semibold break-words">
                  {r.service}
                  {r.country ? ` · ${r.country}` : ""} &middot; +{r.phone}
                </div>
                <div className="text-[var(--text-muted)]">
                  {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[var(--text-muted)]">{formatNaira(r.price_cents)}</span>
                <StatusBadge status={r.status} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    waiting: "bg-yellow-500/15 text-yellow-300",
    received: "bg-teal-500/15 text-teal-300",
    done: "bg-brand/15 text-brand",
    cancelled: "bg-red-500/15 text-red-300",
    expired: "bg-gray-500/15 text-gray-300",
  };
  return <span className={`badge ${colors[status] ?? ""}`}>{status}</span>;
}
