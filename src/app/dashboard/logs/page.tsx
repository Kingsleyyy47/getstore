import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNaira, type Rental, type WalletTransaction } from "@/lib/types";
import OrderRevealButton from "@/components/OrderRevealButton";

export default async function LogsPage() {
  const profile = await requireUser();
  const supabase = createClient();

  const [{ data: rentals }, { data: orders }, { data: txs }] = await Promise.all([
    supabase
      .from("rentals")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("product_orders")
      .select("*, product_templates(name)")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const rentalList = (rentals ?? []) as Rental[];
  const orderList = orders ?? [];
  const txList = (txs ?? []) as WalletTransaction[];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Logs</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Your full history: number rentals, marketplace orders, and wallet activity.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">Number rentals</h2>
        <div className="card divide-y divide-[var(--border)]">
          {rentalList.length === 0 && (
            <p className="p-6 text-sm text-[var(--text-muted)]">No rentals yet.</p>
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
                  {r.provider === "daisysim" ? "All Countries" : "Numbers"} &middot;{" "}
                  {new Date(r.created_at).toLocaleString()}
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
        <h2 className="mb-3 text-lg font-bold">Marketplace orders</h2>
        <div className="card divide-y divide-[var(--border)]">
          {orderList.length === 0 && (
            <p className="p-6 text-sm text-[var(--text-muted)]">No marketplace purchases yet.</p>
          )}
          {orderList.map((o: any) => (
            <div
              key={o.id}
              className="flex flex-col gap-2 px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <div className="min-w-0 break-words">
                <div className="font-semibold">{o.product_templates?.name ?? "Product"}</div>
                <div className="text-[var(--text-muted)]">
                  {formatNaira(o.price_cents)} &middot; {new Date(o.created_at).toLocaleString()}
                </div>
              </div>
              <OrderRevealButton orderId={o.id} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Wallet activity</h2>
        <div className="card divide-y divide-[var(--border)]">
          {txList.length === 0 && (
            <p className="p-6 text-sm text-[var(--text-muted)]">No transactions yet.</p>
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
