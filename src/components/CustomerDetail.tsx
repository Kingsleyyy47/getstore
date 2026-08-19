import { createClient } from "@/lib/supabase/server";
import { formatNaira, type Rental, type Wallet, type WalletTransaction } from "@/lib/types";
import AdjustBalanceForm from "./AdjustBalanceForm";
import EmptyState from "@/components/EmptyState";
import { IconUser, IconPhone, IconReceipt } from "@/components/icons";

export default async function CustomerDetail({
  customerId,
  canAdjustBalance,
}: {
  customerId: string;
  canAdjustBalance: boolean;
}) {
  const supabase = createClient();

  const [{ data: profile }, { data: wallet }, { data: rentals }, { data: txs }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", customerId).single(),
    supabase.from("wallets").select("*").eq("user_id", customerId).single(),
    supabase
      .from("rentals")
      .select("*")
      .eq("user_id", customerId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", customerId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (!profile) {
    return <p className="text-sm text-[var(--text-muted)]">Customer not found.</p>;
  }

  const w = wallet as Wallet | null;
  const rentalList = (rentals ?? []) as Rental[];
  const txList = (txs ?? []) as WalletTransaction[];

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

      <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm text-[var(--text-muted)]">Wallet balance</div>
          <div className="text-3xl font-extrabold">{formatNaira(w?.balance_cents ?? 0)}</div>
        </div>
        {canAdjustBalance && <AdjustBalanceForm customerId={customerId} />}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">Rentals</h2>
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
                  {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[var(--text-muted)]">{formatNaira(r.price_cents)}</span>
                <span className="badge bg-white/10">{r.status}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Wallet activity</h2>
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
