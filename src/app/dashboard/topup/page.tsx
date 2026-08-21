import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { formatNaira, type TopupRequest } from "@/lib/types";
import { requestTopup } from "./actions";
import PocketfiTopup from "./PocketfiTopup";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { IconPlus } from "@/components/icons";

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
  const [{ data: requests }, settings] = await Promise.all([
    supabase
      .from("topup_requests")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20),
    getSettings(),
  ]);

  const requestList = (requests ?? []) as TopupRequest[];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        icon={<IconPlus />}
        title="Add funds"
        subtitle={
          settings.pocketfi_enabled
            ? "Pay instantly with card, bank, or a dedicated transfer account below -- or submit a manual request for an admin to review."
            : "Submit a top-up request below. An admin will review and credit your wallet manually."
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

      <form action={requestTopup} className="card space-y-4 p-6">
        <div>
          <label className="label" htmlFor="amount">
            Amount (₦)
          </label>
          <input
            className="input"
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="1"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="reference">
            Payment reference / note (optional)
          </label>
          <input
            className="input"
            id="reference"
            name="reference"
            type="text"
            placeholder="e.g. bank transfer ref, screenshot filename, etc."
          />
        </div>
        <button className="btn-primary w-full" type="submit">
          Submit top-up request
        </button>
      </form>

      <section>
        <h2 className="mb-3 text-lg font-bold">Your top-up requests</h2>
        <div className="card divide-y divide-[var(--border)]">
          {requestList.length === 0 && (
            <EmptyState icon={<IconPlus />} title="No top-up requests yet" body="Submit a request above to fund your wallet." />
          )}
          {requestList.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-2 px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <div className="min-w-0 break-words">
                <div className="font-semibold">{formatNaira(r.amount_cents)}</div>
                <div className="text-[var(--text-muted)]">
                  {r.reference ?? "—"} &middot; {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-500/15 text-yellow-300",
    approved: "bg-teal-500/15 text-teal-300",
    rejected: "bg-red-500/15 text-red-300",
  };
  return <span className={`badge ${colors[status] ?? ""}`}>{status}</span>;
}
