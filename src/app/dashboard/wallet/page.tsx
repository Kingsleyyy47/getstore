import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNaira, type Wallet, type WalletTransaction } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { IconWallet, IconPlus, IconReceipt, IconCard, IconMessage } from "@/components/icons";

const TILES = [
  {
    href: "/dashboard/topup",
    icon: <IconPlus />,
    color: "bg-brand/10 text-brand",
    title: "Add Funds",
    body: "Top up your wallet in Naira",
  },
  {
    href: "/dashboard/logs",
    icon: <IconReceipt />,
    color: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    title: "Purchase History",
    body: "Numbers and marketplace orders",
  },
  {
    href: "/faq",
    icon: <IconCard />,
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    title: "Payment Methods",
    body: "How manual top-ups are reviewed",
  },
  {
    href: "/faq",
    icon: <IconMessage />,
    color: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    title: "Support",
    body: "Questions about your wallet",
  },
];

export default async function WalletPage() {
  const profile = await requireUser();
  const supabase = createClient();

  const [{ data: wallet }, { data: txs }] = await Promise.all([
    supabase.from("wallets").select("*").eq("user_id", profile.id).single(),
    supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const w = wallet as Wallet | null;
  const txList = (txs ?? []) as WalletTransaction[];

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<IconWallet />}
        title="Wallet"
        subtitle="One balance for numbers, countries, and marketplace purchases."
      />

      <div className="card overflow-hidden">
        <div className="relative overflow-hidden bg-gradient-to-br from-brand to-emerald-700 p-6 text-white sm:p-8">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
              backgroundSize: "36px 36px",
            }}
          />
          <div className="relative flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <IconWallet size={26} />
            </span>
            <div>
              <div className="text-sm text-emerald-100/80">Wallet balance</div>
              <div className="mt-1 text-4xl font-extrabold">{formatNaira(w?.balance_cents ?? 0)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {TILES.map((t) => (
          <Link key={t.title} href={t.href} className="card flex flex-col p-5 hover:border-[var(--hover-border)]">
            <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full ${t.color}`}>
              {t.icon}
            </span>
            <div className="text-sm font-semibold">{t.title}</div>
            <div className="mt-0.5 text-xs text-[var(--text-muted)]">{t.body}</div>
          </Link>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">Wallet History</h2>
        <div className="card divide-y divide-[var(--border)]">
          {txList.length === 0 && (
            <EmptyState
              icon={<IconReceipt />}
              title="No transactions yet"
              body="Top up your wallet to see your ledger here."
              actionHref="/dashboard/topup"
              actionLabel="Add funds"
            />
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
              <div className={t.amount_cents >= 0 ? "font-semibold text-brand" : "font-semibold text-red-500"}>
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
