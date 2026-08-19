import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/types";

export default async function CustomersListPage() {
  await requireRole("admin");
  const supabase = createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*, wallets(balance_cents)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Customers</h1>
      <div className="card divide-y divide-[var(--border)]">
        {(profiles ?? []).map((p: any) => (
          <Link
            key={p.id}
            href={`/admin/customers/${p.id}`}
            className="flex flex-col gap-2 px-4 py-4 text-sm hover:bg-white/5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
          >
            <div className="min-w-0 break-words">
              <div className="font-semibold">{p.full_name ?? p.email}</div>
              <div className="text-[var(--text-muted)]">{p.email}</div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="badge bg-white/10">{p.role}</span>
              <span>{formatNaira(p.wallets?.[0]?.balance_cents ?? 0)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
