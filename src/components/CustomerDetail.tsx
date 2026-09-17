import { createClient } from "@/lib/supabase/server";
import { formatNaira, type Rental, type Wallet, type WalletTransaction } from "@/lib/types";
import AdjustBalanceForm from "./AdjustBalanceForm";
import EmptyState from "@/components/EmptyState";
import { IconUser, IconPhone, IconReceipt, IconStore, IconWallet } from "@/components/icons";

function providerLabel(provider: string): string {
  return provider === "daisysim" ? "All Countries" : provider === "daisysim2" ? "US Only" : "USA & Canada";
}

export default async function CustomerDetail({
  customerId,
  canAdjustBalance,
}: {
  customerId: string;
  canAdjustBalance: boolean;
}) {
  const supabase = createClient();

  // Rentals count as "spent" the same way the customer's own dashboard
  // does (src/app/dashboard/page.tsx's SPENT_RENTAL_STATUSES) -- a
  // cancelled/expired rental was refunded, so it was never really spent.
  // Every marketplace order counts, since there's no cancel/refund path for
  // those.
  const SPENT_RENTAL_STATUSES = ["waiting", "received", "done"];

  const [
    { data: profile },
    { data: wallet },
    { data: rentals },
    { data: orders },
    { data: deposits },
    { data: txs },
    { data: allOrderAmounts },
    { data: allSpentRentalAmounts },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", customerId).single(),
    supabase.from("wallets").select("*").eq("user_id", customerId).single(),
    supabase
      .from("rentals")
      .select("*")
      .eq("user_id", customerId)
      .order("created_at", { ascending: false })
      .limit(50),
    // Marketplace purchases -- previously missing from this page entirely.
    supabase
      .from("product_orders")
      .select("*, product_templates(name)")
      .eq("user_id", customerId)
      .order("created_at", { ascending: false })
      .limit(50),
    // Deposit history -- topups only, separate from the full wallet
    // ledger below (which also includes purchase debits, refunds, etc).
    supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", customerId)
      .eq("type", "topup")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", customerId)
      .order("created_at", { ascending: false })
      .limit(20),
    // Unlimited, for the "Total spent" figure -- the sections above cap at
    // 50 rows each for display, which isn't enough to sum accurately for a
    // heavy customer.
    supabase.from("product_orders").select("price_cents").eq("user_id", customerId),
    supabase
      .from("rentals")
      .select("price_cents")
      .eq("user_id", customerId)
      .in("status", SPENT_RENTAL_STATUSES),
  ]);

  if (!profile) {
    return <p className="text-sm text-[var(--text-muted)]">Customer not found.</p>;
  }

  const w = wallet as Wallet | null;
  const rentalList = (rentals ?? []) as Rental[];
  const orderList = orders ?? [];
  const depositList = (deposits ?? []) as WalletTransaction[];
  const txList = (txs ?? []) as WalletTransaction[];
  const totalSpentCents =
    (allOrderAmounts ?? []).reduce((sum: number, o: any) => sum + (o.price_cents ?? 0), 0) +
    (allSpentRentalAmounts ?? []).reduce((sum: number, r: any) => sum + (r.price_cents ?? 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <IconUser />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{profile.full_name ?? profile.email}</h1>
          <p className="text-sm text-[var(--text-muted)]">
            {profile.email} &middot; <span className="badge bg-brand/15 text-brand">{profile.role}</span>
          </p>
        </div>
      </div>

      <div className="card flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div>
            <div className="text-sm text-[var(--text-muted)]">Wallet balance</div>
            <div className="text-3xl font-extrabold">{formatNaira(w?.balance_cents ?? 0)}</div>
          </div>
          <div>
            <div className="text-sm text-[var(--text-muted)]">Total spent</div>
            <div className="text-3xl font-extrabold">{formatNaira(totalSpentCents)}</div>
          </div>
        </div>
        {canAdjustBalance && <AdjustBalanceForm customerId={customerId} />}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">Marketplace Purchases</h2>
        <div className="card divide-y divide-[var(--border)]">
          {orderList.length === 0 && (
            <EmptyState icon={<IconStore />} title="No marketplace purchases yet" />
          )}
          {orderList.map((o: any) => (
            <div
              key={o.id}
              className="flex flex-col gap-2 px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <div className="min-w-0 break-words">
                <div className="font-semibold">{o.product_templates?.name ?? "Product"}</div>
                <div className="text-[var(--text-muted)]">{new Date(o.created_at).toLocaleString()}</div>
              </div>
              <span className="font-semibold">{formatNaira(o.price_cents)}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Number Rentals</h2>
        <div className="card divide-y divide-[var(--border)]">
          {rentalList.length === 0 && (
            <EmptyState icon={<IconPhone />} title="No rentals yet" />
          )}
          {rentalList.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-2 px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <div className="min-w-0 break-words">
                <div className="font-semibold">
                  {r.service} &middot; +{r.phone}
                </div>
                <div className="text-[var(--text-muted)]">
                  {providerLabel(r.provider)} &middot; {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[var(--text-muted)]">{formatNaira(r.price_cents)}</span>
                <span className="badge bg-white/10">{r.status}</span>
                {r.code && <code className="rounded bg-black/30 px-2 py-1">{r.code}</code>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Deposit History</h2>
        <div className="card divide-y divide-[var(--border)]">
          {depositList.length === 0 && (
            <EmptyState icon={<IconWallet />} title="No deposits yet" />
          )}
          {depositList.map((t) => (
            <div
              key={t.id}
              className="flex flex-col gap-2 px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <div className="min-w-0 break-words">
                <div className="text-[var(--text-muted)]">
                  {t.description ?? "Top-up"} &middot; {new Date(t.created_at).toLocaleString()}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold text-brand">+{formatNaira(t.amount_cents)}</span>
                <span className="text-[var(--text-muted)]">balance after {formatNaira(t.balance_after_cents)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">All Wallet Activity</h2>
        <div className="card divide-y divide-[var(--border)]">
          {txList.length === 0 && (
            <EmptyState icon={<IconReceipt />} title="No transactions yet" />
          )}
          {txList.map((t) => (
            <div
              key={t.id}
              className="flex flex-col gap-2 px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <div className="min-w-0 break-words">
                <div className="font-semibold capitalize">{t.type}</div>
                <div className="text-[var(--text-muted)]">
                  {t.description ?? "—"} &middot; {new Date(t.created_at).toLocaleString()}
                </div>
              </div>
              <div className={t.amount_cents >= 0 ? "text-teal-400" : "text-red-400"}>
                {t.amount_cents >= 0 ? "+" : ""}
                {formatNaira(t.amount_cents)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
