import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNaira, type Rental, type Wallet } from "@/lib/types";

export default async function DashboardPage() {
  const profile = await requireUser();
  const supabase = createClient();

  const [{ data: wallet }, { data: rentals }] = await Promise.all([
    supabase.from("wallets").select("*").eq("user_id", profile.id).single(),
    supabase
      .from("rentals")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const w = wallet as Wallet | null;
  const rentalList = (rentals ?? []) as Rental[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome{profile.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="text-sm text-[var(--text-muted)]">{profile.email}</p>
      </div>

      <div className="card flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
        <div>
          <div className="text-sm text-[var(--text-muted)]">Wallet balance</div>
          <div className="text-3xl font-extrabold">{formatNaira(w?.balance_cents ?? 0)}</div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/topup" className="btn-primary">
            Top up
          </Link>
          <Link href="/dashboard/purchase" className="btn-ghost">
            Buy a number
          </Link>
          <Link href="/dashboard/marketplace" className="btn-ghost">
            Marketplace
          </Link>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Recent rentals</h2>
          <Link href="/dashboard/logs" className="text-sm text-brand hover:underline">
            View all logs
          </Link>
        </div>
        <div className="card divide-y divide-[var(--border)]">
          {rentalList.length === 0 && (
            <p className="p-6 text-sm text-[var(--text-muted)]">
              No rentals yet.{" "}
              <Link href="/dashboard/purchase" className="text-brand hover:underline">
                Buy your first number
              </Link>
              .
            </p>
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
                  {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[var(--text-muted)]">{formatNaira(r.price_cents)}</span>
                <StatusBadge status={r.status} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    waiting: "bg-yellow-500/15 text-yellow-300",
    received: "bg-teal-500/15 text-teal-300",
    done: "bg-brand/15 text-brand",
    cancelled: "bg-red-500/15 text-red-300",
    expired: "bg-gray-500/15 text-gray-300",
  };
  return <span className={`badge ${colors[status] ?? ""}`}>{status}</span>;
}
