"use client";

import { useMemo, useState } from "react";
import { formatNaira, type DeliveredCredentials } from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import { IconStore, IconBox, IconSearch } from "@/components/icons";

interface TemplateItem {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  available_count: number;
  categoryId: string | null;
  categoryName: string | null;
  categoryLogoUrl: string | null;
  // Admin-set display order (Admin -> Category Shuffle) -- null for
  // uncategorized products, which always sort last.
  categorySortOrder?: number | null;
  // Resolved server-side: a site-wide, name-matched logo (Admin -> Logo)
  // if one exists for this product's name, else falls back to the
  // category logo. Used for the per-product icon; the category banner
  // above the grid still always uses categoryLogoUrl.
  logoUrl?: string | null;
}

// A rotating set of gradients so each category banner reads distinctly
// from the ones above/below it, the same way the reference site's
// category banners differ from each other.
const BANNER_GRADIENTS = [
  "from-violet-500 to-violet-800",
  "from-sky-500 to-sky-800",
  "from-amber-500 to-amber-800",
  "from-brand to-emerald-800",
  "from-rose-500 to-rose-800",
  "from-fuchsia-500 to-fuchsia-800",
];

export default function MarketplaceBrowser({ templates }: { templates: TemplateItem[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [delivered, setDelivered] = useState<DeliveredCredentials | null>(null);
  const [list, setList] = useState(templates);
  const [search, setSearch] = useState("");

  async function buy(id: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch("/api/marketplace/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: id }),
    });
    const json = await res.json();
    setBusyId(null);

    if (!res.ok) {
      setError(json.error ?? "Purchase failed");
      return;
    }

    setDelivered(json.order);
    setList((prev) =>
      prev.map((t) => (t.id === id ? { ...t, available_count: Math.max(0, t.available_count - 1) } : t))
    );
  }

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q) ||
        (t.categoryName ?? "").toLowerCase().includes(q)
    );
  }, [list, search]);

  // Group templates by category so each category renders as its own big
  // banner section with its products listed underneath -- not merged
  // together like a single feed.
  const groups = useMemo(() => {
    const map = new Map<
      string,
      {
        categoryId: string | null;
        categoryName: string;
        categoryLogoUrl: string | null;
        categorySortOrder: number | null;
        items: TemplateItem[];
      }
    >();
    for (const t of filteredList) {
      const key = t.categoryId ?? "__uncategorized";
      if (!map.has(key)) {
        map.set(key, {
          categoryId: t.categoryId,
          categoryName: t.categoryName ?? "Other",
          categoryLogoUrl: t.categoryLogoUrl,
          categorySortOrder: t.categorySortOrder ?? null,
          items: [],
        });
      }
      map.get(key)!.items.push(t);
    }
    // Admin-set order (Admin -> Category Shuffle) wins; uncategorized
    // ("Other") has no sort_order and always sorts last; ties (including
    // every category still at the default 0) fall back to alphabetical.
    return Array.from(map.values()).sort((a, b) => {
      if (a.categorySortOrder === null && b.categorySortOrder === null) {
        return a.categoryName.localeCompare(b.categoryName);
      }
      if (a.categorySortOrder === null) return 1;
      if (b.categorySortOrder === null) return -1;
      if (a.categorySortOrder !== b.categorySortOrder) return a.categorySortOrder - b.categorySortOrder;
      return a.categoryName.localeCompare(b.categoryName);
    });
  }, [filteredList]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {list.length === 0 && (
        <div className="card">
          <EmptyState icon={<IconStore />} title="No products available yet" body="Check back soon for new listings." />
        </div>
      )}

      {list.length > 0 && (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
            <IconSearch size={16} />
          </span>
          <input
            className="input pl-9"
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {list.length > 0 && filteredList.length === 0 && (
        <div className="card">
          <EmptyState
            icon={<IconSearch />}
            title="No products match your search"
            body={`Nothing found for "${search}". Try a different term.`}
          />
        </div>
      )}

      <div className="space-y-6">
        {groups.map((g, i) => (
          <div key={g.categoryId ?? "uncategorized"} className="space-y-3">
            <div
              className={`clip-decor relative rounded-2xl bg-gradient-to-br p-4 text-white sm:p-5 ${
                BANNER_GRADIENTS[i % BANNER_GRADIENTS.length]
              }`}
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage: "radial-gradient(60% 100% at 100% 0%, rgba(255,255,255,0.22), transparent 65%)",
                }}
              />
              <div className="relative flex items-center gap-3">
                {g.categoryLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={g.categoryLogoUrl}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-xl border border-white/30 object-cover"
                  />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
                    <IconBox size={22} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-bold uppercase leading-tight tracking-wide">{g.categoryName}</div>
                  <div className="text-xs text-white/70">
                    {g.items.length} product{g.items.length === 1 ? "" : "s"} available
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {g.items.map((t) => (
                <div key={t.id} className="card flex items-center gap-3 p-3.5 sm:p-4">
                  {t.logoUrl ?? t.categoryLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.logoUrl ?? t.categoryLogoUrl ?? undefined}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-full border border-[var(--border)] object-cover sm:h-12 sm:w-12"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-black/5 text-[9px] text-[var(--text-muted)] dark:bg-white/5 sm:h-12 sm:w-12">
                      {t.categoryName ?? "—"}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold leading-snug">
                      {t.name}
                      {t.description && (
                        <span className="font-normal text-[var(--text-muted)]"> {t.description}</span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="badge bg-emerald-500/15 font-semibold text-emerald-600 dark:text-emerald-400">
                        {t.available_count} pcs.
                      </span>
                      <span className="badge bg-black/10 font-mono font-semibold text-[var(--text)] dark:bg-white/10">
                        {formatNaira(t.price_cents)}
                      </span>
                    </div>
                  </div>

                  <button
                    className="btn-primary h-9 shrink-0 gap-1 px-4 text-sm"
                    disabled={busyId === t.id || t.available_count === 0}
                    onClick={() => buy(t.id)}
                  >
                    {busyId === t.id ? "..." : t.available_count === 0 ? "Sold" : "Buy"}
                    {t.available_count > 0 && busyId !== t.id && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {delivered && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md space-y-3 p-6">
            <h3 className="text-lg font-bold">Purchase successful</h3>
            <p className="text-sm text-[var(--text-muted)]">
              Here are your account details. You can also find this later on the Logs page.
            </p>
            <CredentialRow label="Email" value={delivered.email} />
            <CredentialRow label="Username" value={delivered.username} />
            <CredentialRow label="Password" value={delivered.password} />
            <CredentialRow label="Email password" value={delivered.email_password} />
            <CredentialRow label="2FA code" value={delivered.two_fa} />
            <CredentialRow label="Recovery email" value={delivered.recovery_email} />
            <CredentialRow label="Recovery email password" value={delivered.recovery_email_password} />
            {/* Always last -- a link-only item (no password/username at
                all, see DeliveredCredentials in src/lib/types.ts) has
                nothing else to show here, so this is often the only row. */}
            <CredentialRow label="Login link" value={delivered.link} isLink />
            <button className="btn-primary w-full" onClick={() => setDelivered(null)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CredentialRow({
  label,
  value,
  isLink,
}: {
  label: string;
  value: string | null;
  isLink?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-black/20 px-3 py-2 text-sm">
      <span className="text-[var(--text-muted)]">{label}</span>
      {isLink ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="break-all text-brand underline">
          {value}
        </a>
      ) : (
        <code>{value}</code>
      )}
    </div>
  );
}
