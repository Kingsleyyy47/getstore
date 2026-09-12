"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { IconSearch } from "@/components/icons";

/**
 * Shared "title + search + up to N items + See all" presentational shell
 * used by every dashboard preview section (US Only, USA & Canada, All
 * Countries, Products). Each section supplies its own items/renderItem;
 * this component just handles the search filter, the 10-at-a-time slice,
 * and the "See all" control (a modal-opener or a plain link).
 */
export default function PreviewList<T>({
  icon,
  title,
  subtitle,
  items,
  getSearchText,
  getKey,
  renderItem,
  searchPlaceholder = "Search...",
  pageSize = 10,
  loading = false,
  error = null,
  emptyText = "Nothing available right now.",
  seeAll,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  items: T[];
  getSearchText: (item: T) => string;
  getKey: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  searchPlaceholder?: string;
  pageSize?: number;
  loading?: boolean;
  error?: string | null;
  emptyText?: string;
  seeAll: { type: "link"; href: string } | { type: "modal"; onClick: () => void };
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => getSearchText(item).toLowerCase().includes(q));
  }, [items, search, getSearchText]);

  const visible = filtered.slice(0, pageSize);

  return (
    <section className="card space-y-3 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon && <span className="text-[var(--text-muted)]">{icon}</span>}
          <div className="min-w-0">
            <div className="text-sm font-bold">{title}</div>
            {subtitle && <div className="text-xs text-[var(--text-muted)]">{subtitle}</div>}
          </div>
        </div>
        {seeAll.type === "link" ? (
          <Link href={seeAll.href} className="btn-ghost h-8 shrink-0 px-3 text-xs">
            See all
          </Link>
        ) : (
          <button type="button" onClick={seeAll.onClick} className="btn-ghost h-8 shrink-0 px-3 text-xs">
            See all
          </button>
        )}
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
          <IconSearch size={14} />
        </span>
        <input
          className="input h-9 pl-8 text-sm"
          type="text"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && <p className="text-sm text-[var(--text-muted)]">Loading...</p>}
      {!loading && error && <p className="text-sm text-red-400">{error}</p>}
      {!loading && !error && visible.length === 0 && (
        <p className="text-sm text-[var(--text-muted)]">
          {items.length === 0 ? emptyText : `Nothing found for "${search}".`}
        </p>
      )}

      {!loading && !error && visible.length > 0 && <div className="space-y-2">{visible.map((item) => (
        <div key={getKey(item)}>{renderItem(item)}</div>
      ))}</div>}
    </section>
  );
}
