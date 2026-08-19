import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNaira, type TopupRequest } from "@/lib/types";
import { requestTopup } from "./actions";

export default async function TopupPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string };
}) {
  const profile = await requireUser();
  const supabase = createClient();

  const { data: requests } = await supabase
    .from("topup_requests")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const requestList = (requests ?? []) as TopupRequest[];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Top up your wallet</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Submit a top-up request below. An admin will review and credit your wallet manually.
          (Automatic card payments are coming soon.)
        </p>
      </div>

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
            <p className="p-6 text-sm text-[var(--text-muted)]">No top-up requests yet.</p>
          )}
          {requestList.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-6 py-4 text-sm">
              <div>
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
