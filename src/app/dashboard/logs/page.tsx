import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNaira, type Rental } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { IconReceipt, IconPhone, IconStore, IconChevronRight } from "@/components/icons";

export default async function LogsPage() {
  const profile = await requireUser();
  const supabase = createClient();

  const [{ data: rentals }, { data: orders }] = await Promise.all([
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
  ]);

  const rentalList = (rentals ?? []) as Rental[];
  const orderList = orders ?? [];

  return (
    <div className="space-y-10">
      <PageHeader
        icon={<IconReceipt />}
        title="History"
        subtitle={
          <>
            Your history of purchases — every number rented and every marketplace order. Looking
            for wallet transactions?{" "}
            <Link href="/dashboard/wallet" className="text-brand hover:underline">
              Visit your Wallet
            </Link>
            .
          </>
        }
      />

      <section>
        <h2 className="mb-3 text-lg font-bold">Number History</h2>
        <div className="card divide-y divide-[var(--border)]">
          {rentalList.length === 0 && (
            <EmptyState icon={<IconPhone />} title="No rentals yet" body="Numbers you rent will show up here." />
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
                  {r.provider === "daisysim"
                    ? "All Countries"
                    : r.provider === "daisysim2"
                      ? "US Only"
                      : "USA & Canada"}{" "}
                  &middot; {new Date(r.created_at).toLocaleString()}
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
        <h2 className="mb-3 text-lg font-bold">Purchase History</h2>
        <div className="card divide-y divide-[var(--border)]">
          {orderList.length === 0 && (
            <EmptyState icon={<IconStore />} title="No purchases yet" body="Marketplace orders will show up here." />
          )}
          {orderList.map((o: any) => (
            <Link
              key={o.id}
              href={`/dashboard/orders/${o.id}`}
              className="flex flex-col gap-2 px-4 py-4 text-sm hover:bg-black/5 dark:hover:bg-white/5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <div className="min-w-0 break-words">
                <div className="font-semibold">{o.product_templates?.name ?? "Product"}</div>
                <div className="text-[var(--text-muted)]">
                  {formatNaira(o.price_cents)} &middot; {new Date(o.created_at).toLocaleString()}
                </div>
              </div>
              <span className="shrink-0 text-[var(--text-muted)]">
                <IconChevronRight size={16} />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
