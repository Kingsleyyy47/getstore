import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { IconReceipt, IconWallet } from "@/components/icons";

const PAGE_SIZE = 30;

/**
 * Every deposit that has actually landed in a customer's wallet -- i.e.
 * wallet_transactions rows of type "topup", created the moment an admin
 * approves a pending top-up request (see /api/admin/topup/approve). This is
 * deliberately separate from "Top-ups" in the sidebar, which only shows
 * requests still AWAITING approval -- this page is the full, permanent
 * record of every deposit that's ever been credited, approved or not
 * pending anymore.
 */
export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  await requireRole("admin");
  const supabase = createClient();

  const page = Math.max(1, Number(searchParams.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [{ data: rows, count }, { data: allAmounts }] = await Promise.all([
    supabase
      .from("wallet_transactions")
      .select("*, profiles(email)", { count: "exact" })
      .eq("type", "topup")
      .order("created_at", { ascending: false })
      .range(from, to),
    supabase.from("wallet_transactions").select("amount_cents").eq("type", "topup"),
  ]);

  const transactions = rows ?? [];
  const totalCount = count ?? 0;
  const totalDepositedCents = (allAmounts ?? []).reduce(
    (sum, r: any) => sum + (r.amount_cents ?? 0),
    0
  );
  const lastPage = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<IconReceipt />}
        title="Transactions"
        subtitle="Every deposit ever credited to a customer wallet, newest first -- the permanent record behind the Top-ups approval queue."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card flex items-center gap-4 p-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
            <IconWallet />
          </span>
          <div className="min-w-0">
            <div className="text-sm text-[var(--text-muted)]">Total deposited, all time</div>
            <div className="text-2xl font-extrabold">{formatNaira(totalDepositedCents)}</div>
          </div>
        </div>
        <div className="card flex items-center gap-4 p-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
            <IconReceipt />
          </span>
          <div className="min-w-0">
            <div className="text-sm text-[var(--text-muted)]">Deposits recorded</div>
            <div className="text-2xl font-extrabold">{totalCount.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="card divide-y divide-[var(--border)]">
        {transactions.length === 0 && (
          <EmptyState icon={<IconReceipt />} title="No deposits yet" body="Approved top-ups will show up here." />
        )}
        {transactions.map((t: any) => (
          <div
            key={t.id}
            className="flex flex-col gap-2 px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6"
          >
            <div className="min-w-0 break-words">
              <div className="font-semibold">{t.profiles?.email ?? t.user_id}</div>
              <div className="text-[var(--text-muted)]">
                {t.description ?? "Top-up"} &middot; {new Date(t.created_at).toLocaleString()}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-brand">+{formatNaira(t.amount_cents)}</span>
              <span className="text-[var(--text-muted)]">
                balance after {formatNaira(t.balance_after_cents)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {lastPage > 1 && (
        <div className="flex items-center justify-between text-sm">
          <a
            href={`/admin/transactions?page=${Math.max(1, page - 1)}`}
            className={`btn-ghost ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
          >
            Previous
          </a>
          <span className="text-[var(--text-muted)]">
            Page {page} of {lastPage}
          </span>
          <a
            href={`/admin/transactions?page=${Math.min(lastPage, page + 1)}`}
            className={`btn-ghost ${page >= lastPage ? "pointer-events-none opacity-40" : ""}`}
          >
            Next
          </a>
        </div>
      )}
    </div>
  );
}
