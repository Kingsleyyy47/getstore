import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { formatNaira, type WalletTransaction } from "@/lib/types";
import PocketfiTopup from "./PocketfiTopup";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { IconPlus, IconReceipt } from "@/components/icons";

export default async function TopupPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string };
}) {
  const profile = await requireUser();
  const supabase = createClient();

  // getSettings() reads app_settings through the service-role client, since
  // its RLS policy restricts direct reads to admins (see supabase/003_settings.sql)
  // -- same helper the Numbers/purchase pages use for their enabled flags.
  const [{ data: txs }, settings] = await Promise.all([
    supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20),
    getSettings(),
  ]);

  const txList = (txs ?? []) as WalletTransaction[];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        icon={<IconPlus />}
        title="Add funds"
        subtitle={
          settings.pocketfi_enabled
            ? "Get a dedicated transfer account below for instant funding."
            : "Top-ups are currently unavailable. Please contact support."
        }
      />

      {searchParams.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {searchParams.error}
        </div>
      )}
      {searchParams.success && (
        <div className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-sm text-teal-300">
          Top-up request submitted. It will be credited once approved.
        </div>
      )}

      {settings.pocketfi_enabled && <PocketfiTopup />}

      <section>
        <h2 className="mb-3 text-lg font-bold">Transaction history</h2>
        <div className="card divide-y divide-[var(--border)]">
          {txList.length === 0 && (
            <EmptyState
              icon={<IconReceipt />}
              title="No transactions yet"
              body="Approved top-ups and other wallet activity will show up here."
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
