import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { IconUsers, IconUser } from "@/components/icons";

export default async function CustomersListPage() {
  await requireRole("admin");
  const supabase = createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*, wallets(balance_cents)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader icon={<IconUsers />} title="Customers" />
      <div className="card divide-y divide-[var(--border)]">
        {(profiles ?? []).length === 0 && <EmptyState icon={<IconUsers />} title="No customers yet" />}
        {(profiles ?? []).map((p: any) => (
          <Link
            key={p.id}
            href={`/admin/customers/${p.id}`}
            className="flex flex-col gap-3 px-4 py-4 text-sm hover:bg-black/5 dark:hover:bg-white/5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                <IconUser size={16} />
              </span>
              <div className="min-w-0 break-words">
                <div className="font-semibold">{p.full_name ?? p.email}</div>
                <div className="text-[var(--text-muted)]">{p.email}</div>
              </div>
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
