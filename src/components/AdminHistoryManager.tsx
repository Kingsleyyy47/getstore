"use client";

import { useEffect, useRef, useState } from "react";
import { formatNaira } from "@/lib/types";
import {
  IconChevronDown,
  IconChevronRight,
  IconSearch,
  IconStore,
  IconPhone,
  IconGlobe,
  IconFlag,
  IconWallet,
} from "@/components/icons";

const PAGE_SIZE = 50;

interface HistoryRow {
  id: string;
  created_at: string;
  profiles?: { email: string | null } | null;
  [key: string]: unknown;
}

interface SectionConfig {
  kind: "orders" | "daisysms" | "daisysim" | "daisysim2" | "deposits";
  label: string;
  icon: React.ReactNode;
  renderRow: (row: any) => React.ReactNode;
}

/**
 * One collapsible history section, backed by /api/admin/history?kind=...
 * Loads nothing until first expanded, then fetches 50 rows at a time --
 * "See all" (Load more) appends the next 50, and typing in the search box
 * (matched against the customer's email) resets back to the first page.
 */
function HistorySection({ config }: { config: SectionConfig }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchPage(offset: number, q: string, append: boolean) {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        kind: config.kind,
        offset: String(offset),
        limit: String(PAGE_SIZE),
      });
      if (q) params.set("q", q);
      const res = await fetch(`/api/admin/history?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to load history");
        return;
      }
      setRows((prev) => (append ? [...prev, ...json.rows] : json.rows));
      setTotal(json.total);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  function toggleOpen() {
    setOpen((v) => !v);
    if (!loaded) {
      setLoaded(true);
      fetchPage(0, "", false);
    }
  }

  function onSearchChange(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPage(0, value, false);
    }, 350);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const hasMore = rows.length < total;

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={toggleOpen}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="shrink-0 text-[var(--text-muted)]">
          {open ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          {config.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{config.label}</span>
          {loaded && (
            <span className="block text-xs text-[var(--text-muted)]">
              {total} record{total === 1 ? "" : "s"}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="border-t border-[var(--border)] p-4">
          <div className="relative mb-3">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              <IconSearch size={14} />
            </span>
            <input
              className="input h-9 pl-8 text-sm"
              type="text"
              placeholder="Search by customer email..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>

          {error && (
            <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {loading && <p className="py-6 text-center text-sm text-[var(--text-muted)]">Loading...</p>}

          {!loading && rows.length === 0 && (
            <p className="py-6 text-center text-sm text-[var(--text-muted)]">
              {search ? `No results for "${search}".` : "Nothing here yet."}
            </p>
          )}

          {!loading && rows.length > 0 && (
            <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
              {rows.map((r) => (
                <div key={r.id} className="px-3 py-3 text-sm sm:px-4">
                  {config.renderRow(r)}
                </div>
              ))}
            </div>
          )}

          {hasMore && !loading && (
            <button
              type="button"
              className="btn-ghost mt-3 w-full"
              onClick={() => fetchPage(rows.length, search, true)}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading..." : `See all (${total - rows.length} more)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function rentalLabel(kind: "daisysms" | "daisysim" | "daisysim2"): string {
  return kind === "daisysim" ? "All Countries" : kind === "daisysim2" ? "US Only" : "USA & Canada";
}

function RentalRow({ r, kind }: { r: any; kind: "daisysms" | "daisysim" | "daisysim2" }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 break-words">
        <div className="font-semibold">
          {r.service}
          {r.country ? ` · ${r.country}` : ""} &middot; +{r.phone}
        </div>
        <div className="text-[var(--text-muted)]">
          {r.profiles?.email ?? "—"} &middot; {rentalLabel(kind)} &middot;{" "}
          {new Date(r.created_at).toLocaleString()}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[var(--text-muted)]">{formatNaira(r.price_cents)}</span>
        <span className="badge bg-black/10 dark:bg-white/10">{r.status}</span>
        {r.code && <code className="rounded bg-black/10 px-2 py-1 dark:bg-white/10">{r.code}</code>}
      </div>
    </div>
  );
}

/**
 * Admin -> History: everything a customer has ever bought, split into
 * separately-collapsible sections (Marketplace orders, each numbers
 * provider, and deposits) instead of one long merged feed, each with its
 * own search-by-email box and 50-rows-at-a-time paging.
 */
export default function AdminHistoryManager() {
  const sections: SectionConfig[] = [
    {
      kind: "orders",
      label: "Order History (Marketplace)",
      icon: <IconStore size={18} />,
      renderRow: (o: any) => (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 break-words">
            <div className="font-semibold">{o.product_templates?.name ?? "Product"}</div>
            <div className="text-[var(--text-muted)]">
              {o.profiles?.email ?? "—"} &middot; {new Date(o.created_at).toLocaleString()}
            </div>
          </div>
          <span className="font-semibold">{formatNaira(o.price_cents)}</span>
        </div>
      ),
    },
    {
      kind: "daisysms",
      label: "USA & Canada History",
      icon: <IconPhone size={18} />,
      renderRow: (r: any) => <RentalRow r={r} kind="daisysms" />,
    },
    {
      kind: "daisysim",
      label: "All Countries History",
      icon: <IconGlobe size={18} />,
      renderRow: (r: any) => <RentalRow r={r} kind="daisysim" />,
    },
    {
      kind: "daisysim2",
      label: "US Only History",
      icon: <IconFlag size={18} />,
      renderRow: (r: any) => <RentalRow r={r} kind="daisysim2" />,
    },
    {
      kind: "deposits",
      label: "Deposit History",
      icon: <IconWallet size={18} />,
      renderRow: (t: any) => (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 break-words">
            <div className="font-semibold">{t.profiles?.email ?? "—"}</div>
            <div className="text-[var(--text-muted)]">
              {t.description ?? "Top-up"} &middot; {new Date(t.created_at).toLocaleString()}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-brand">+{formatNaira(t.amount_cents)}</span>
            <span className="text-[var(--text-muted)]">balance after {formatNaira(t.balance_after_cents)}</span>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {sections.map((s) => (
        <HistorySection key={s.kind} config={s} />
      ))}
    </div>
  );
}
