import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNaira, type Wallet, type WalletTransaction } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { IconWallet, IconPhone, IconStore, IconMessage } from "@/components/icons";

// "Add Funds" and "Payment Methods" tiles were removed here per request --
// this page is now purely a history hub (SMS/numbers, marketplace logs,
// deposits) plus Support. Topping up still lives at /dashboard/topup,
// reachable from the dashboard's own "Add Money" button.
const TILES = [
  {
    href: "/dashboard/logs#numbers",
    icon: <IconPhone />,
    color: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    title: "SMS History",
    body: "Numbers you've rented",
  },
  {
    href: "/dashboard/logs#purchases",
    icon: <IconStore />,
    color: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
    title: "Logs History",
    body: "Marketplace orders & delivered logins",
  },
  {
    href: "#deposits",
    icon: <IconWallet />,
    color: "bg-brand/10 text-brand",
    title: "Deposit History",
    body: "Money added to your wallet",
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
    // Deposits only now -- this section is titled "Deposit History" below,
    // not a full wallet ledger (that used to also include purchases,
    // refunds, etc).
    supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", profile.id)
      .eq("type", "topup")
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
        <div className="relative overflow-hidden bg-gradient-to-br from-brand to-emerald-700 p-4 text-white">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
              backgroundSize: "36px 36px",
            }}
          />
          <div className="relative flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <IconWallet size={18} />
            </span>
            <div>
              <div className="text-xs text-emerald-100/80">Wallet balance</div>
              <div className="text-xl font-extrabold">{formatNaira(w?.balance_cents ?? 0)}</div>
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

      <section id="deposits">
        <h2 className="mb-3 text-lg font-bold">Deposit History</h2>
        <div className="card divide-y divide-[var(--border)]">
          {txList.length === 0 && (
            <EmptyState
              icon={<IconWallet />}
              title="No deposits yet"
              body="Top up your wallet to see your deposits here."
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
                <div className="text-[var(--text-muted)]">
                  {t.description ?? "Top-up"} &middot; {new Date(t.created_at).toLocaleString()}
                </div>
              </div>
              <div className="font-semibold text-brand">+{formatNaira(t.amount_cents)}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
