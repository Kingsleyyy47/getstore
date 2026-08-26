import Link from "next/link";
import { formatNaira } from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import { IconReceipt } from "@/components/icons";

export interface PurchaseItem {
  id: string;
  title: string;
  meta: string;
  priceCents: number;
  status: "waiting" | "received" | "done" | "cancelled" | "expired";
  /** Only marketplace orders have a detail page; rentals show inline with
   * no link (there's no per-rental detail view -- see /dashboard/logs). */
  href: string | null;
  createdAt: string;
}

const STATUS_STYLES: Record<PurchaseItem["status"], string> = {
  waiting: "bg-yellow-500/15 text-yellow-300",
  received: "bg-teal-500/15 text-teal-300",
  done: "bg-brand/15 text-brand",
  cancelled: "bg-red-500/15 text-red-300",
  expired: "bg-gray-500/15 text-gray-300",
};

function glyph(title: string): string {
  const word = title.trim().split(/\s+/)[0] ?? "?";
  return word.slice(0, 2);
}

export default function RecentPurchases({ items }: { items: PurchaseItem[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
        <h2 className="text-sm font-bold">Recent purchases</h2>
        <Link href="/dashboard/logs" className="text-xs font-semibold text-brand hover:underline">
          View all
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<IconReceipt />}
          title="Nothing yet"
          body="Rent a number or buy an account to see your activity here."
          actionHref="/dashboard/marketplace"
          actionLabel="Browse the marketplace"
        />
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {items.map((item) => {
            const row = (
              <>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-xs font-bold text-brand">
                  {glyph(item.title)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{item.title}</span>
                  <span className="mt-0.5 block truncate font-mono text-xs text-[var(--text-muted)]">
                    {item.meta}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1.5">
                  <span className={`badge ${STATUS_STYLES[item.status]}`}>{item.status}</span>
                  <span className="font-mono text-xs text-[var(--text-muted)]">
                    {formatNaira(item.priceCents)}
                  </span>
                </span>
              </>
            );
            const rowClass = "grid grid-cols-[36px_1fr_auto] items-center gap-3 px-5 py-3.5 text-sm";
            return item.href ? (
              <Link key={item.id} href={item.href} className={`${rowClass} hover:bg-black/[0.02] dark:hover:bg-white/[0.02]`}>
                {row}
              </Link>
            ) : (
              <div key={item.id} className={rowClass}>
                {row}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
