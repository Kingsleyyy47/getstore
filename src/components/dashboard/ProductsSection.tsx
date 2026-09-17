"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatNaira, type DeliveredCredentials } from "@/lib/types";
import { IconStore, IconSearch, IconBox } from "@/components/icons";
import Modal from "@/components/Modal";

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
  // still always uses categoryLogoUrl.
  logoUrl?: string | null;
}

interface Group {
  categoryId: string | null;
  categoryName: string;
  categoryLogoUrl: string | null;
  categorySortOrder: number | null;
  items: TemplateItem[];
}

const BANNER_GRADIENTS = [
  "from-violet-500 to-violet-800",
  "from-sky-500 to-sky-800",
  "from-amber-500 to-amber-800",
  "from-brand to-emerald-800",
  "from-rose-500 to-rose-800",
  "from-fuchsia-500 to-fuchsia-800",
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function groupByCategory(items: TemplateItem[]): Group[] {
  const map = new Map<string, Group>();
  for (const t of items) {
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
  // every category still at the default 0) fall back to alphabetical. This
  // is a pure function of `items`, so it produces the exact same order on
  // the server and on the client -- unlike the per-category product
  // shuffle below, it's safe to use for the very first render.
  return Array.from(map.values()).sort((a, b) => {
    if (a.categorySortOrder === null && b.categorySortOrder === null) {
      return a.categoryName.localeCompare(b.categoryName);
    }
    if (a.categorySortOrder === null) return 1;
    if (b.categorySortOrder === null) return -1;
    if (a.categorySortOrder !== b.categorySortOrder) return a.categorySortOrder - b.categorySortOrder;
    return a.categoryName.localeCompare(b.categoryName);
  });
}

function buildShuffledGroups(items: TemplateItem[]): Group[] {
  // Category order stays exactly as the admin set it (Category Shuffle) --
  // only the products within each category get randomized.
  return groupByCategory(items).map((g) => ({ ...g, items: shuffle(g.items) }));
}

/**
 * Dashboard "Marketplace" preview -- every category and product, same
 * visual pattern as the full Marketplace page. Category order follows the
 * admin's Category Shuffle setting (same as the full Marketplace page);
 * each category's own products are additionally shuffled into a random
 * order here. Tapping a product opens a checkout confirmation right here
 * on the dashboard; "See all" still links to the full Marketplace page.
 */
export default function ProductsSection({ templates }: { templates: TemplateItem[] }) {
  // Start with the deterministic (unshuffled) grouping -- this is what
  // both the server render and the client's first render produce, so they
  // match. Math.random() can't run here: if the initial render shuffled
  // directly, the server and the client would each roll a different order
  // and React would throw a hydration mismatch error as soon as the page
  // loads. The actual shuffle happens client-only, once, right after mount
  // (see the effect below), which is safe since it happens after hydration
  // has already reconciled against the server's markup.
  const [baseGroups, setBaseGroups] = useState<Group[]>(() => groupByCategory(templates));
  useEffect(() => {
    setBaseGroups(buildShuffledGroups(templates));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [search, setSearch] = useState("");
  const [checkoutItem, setCheckoutItem] = useState<TemplateItem | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [delivered, setDelivered] = useState<DeliveredCredentials | null>(null);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return baseGroups;
    const result: Group[] = [];
    for (const g of baseGroups) {
      const filtered = g.items.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q) ||
          g.categoryName.toLowerCase().includes(q)
      );
      if (filtered.length === 0) continue;
      result.push({ ...g, items: filtered });
    }
    return result;
  }, [baseGroups, search]);

  const hasAny = baseGroups.some((g) => g.items.length > 0);

  function openCheckout(t: TemplateItem) {
    setCheckoutItem(t);
    setBuyError(null);
  }

  function closeCheckout() {
    setCheckoutItem(null);
    setBuyError(null);
  }

  async function confirmPurchase() {
    if (!checkoutItem) return;
    setBuying(true);
    setBuyError(null);

    const res = await fetch("/api/marketplace/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: checkoutItem.id }),
    });
    const json = await res.json();
    setBuying(false);

    if (!res.ok) {
      setBuyError(json.error ?? "Purchase failed");
      return;
    }

    const boughtId = checkoutItem.id;
    setDelivered(json.order);
    setCheckoutItem(null);
    setBaseGroups((prev) =>
      prev.map((g) => ({
        ...g,
        items: g.items.map((t) =>
          t.id === boughtId ? { ...t, available_count: Math.max(0, t.available_count - 1) } : t
        ),
      }))
    );
  }

  return (
    <section className="card space-y-3 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[var(--text-muted)]">
            <IconStore size={16} />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold">Marketplace</div>
            <div className="text-xs text-[var(--text-muted)]">Premium accounts, all categories</div>
          </div>
        </div>
        <Link href="/dashboard/marketplace" className="btn-ghost h-8 shrink-0 px-3 text-xs">
          See all
        </Link>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
          <IconSearch size={14} />
        </span>
        <input
          className="input h-9 pl-8 text-sm"
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {!hasAny && <p className="text-sm text-[var(--text-muted)]">No products available yet.</p>}
      {hasAny && groups.length === 0 && (
        <p className="text-sm text-[var(--text-muted)]">Nothing found for &quot;{search}&quot;.</p>
      )}

      <div className="space-y-5">
        {groups.map((g, i) => (
          <div key={g.categoryId ?? "uncategorized"} className="space-y-2.5">
            <div
              className={`clip-decor relative rounded-xl bg-gradient-to-br p-3 text-white ${
                BANNER_GRADIENTS[i % BANNER_GRADIENTS.length]
              }`}
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage: "radial-gradient(60% 100% at 100% 0%, rgba(255,255,255,0.22), transparent 65%)",
                }}
              />
              <div className="relative flex items-center gap-2.5">
                {g.categoryLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={g.categoryLogoUrl}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-lg border border-white/30 object-cover"
                  />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20">
                    <IconBox size={16} />
                  </span>
                )}
                <div className="min-w-0 flex-1 text-sm font-bold uppercase tracking-wide">{g.categoryName}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {g.items.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openCheckout(t)}
                  disabled={t.available_count === 0}
                  className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] p-2.5 text-left transition-colors enabled:hover:border-[var(--hover-border)] disabled:opacity-60"
                >
                  {t.logoUrl ?? t.categoryLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.logoUrl ?? t.categoryLogoUrl ?? undefined}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-full border border-[var(--border)] object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-black/5 text-[8px] text-[var(--text-muted)] dark:bg-white/5">
                      {g.categoryName}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold leading-snug">
                      {t.name}
                      {t.description && (
                        <span className="font-normal text-[var(--text-muted)]"> {t.description}</span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {/* Piece count always shows (same as the full
                          Marketplace page), even at 0 -- "Sold out" is a
                          separate badge, not a replacement for it, so the
                          exact stock number is never hidden. */}
                      <span
                        className={`badge text-[10px] font-semibold ${
                          t.available_count === 0
                            ? "bg-red-500/15 text-red-600 dark:text-red-400"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {t.available_count} pcs.
                      </span>
                      {t.available_count === 0 && (
                        <span className="badge bg-red-500/15 text-[10px] font-semibold text-red-600 dark:text-red-400">
                          Sold out
                        </span>
                      )}
                      <span className="badge bg-black/10 text-[10px] font-mono font-semibold text-[var(--text)] dark:bg-white/10">
                        {formatNaira(t.price_cents)}
                      </span>
                    </div>
                  </div>
                  {/* The whole card is already the clickable element (see
                      the outer <button>), but without something that reads
                      as a call-to-action it wasn't obvious tapping it does
                      anything -- this mirrors the full Marketplace page's
                      actual Buy button visually, as a plain span so it
                      doesn't nest a second interactive control inside the
                      row's own button. */}
                  <span
                    className={`btn-primary flex h-8 shrink-0 items-center gap-1 px-3 text-xs ${
                      t.available_count === 0 ? "opacity-60" : ""
                    }`}
                  >
                    {t.available_count === 0 ? "Sold" : "Buy"}
                    {t.available_count > 0 && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {checkoutItem && (
        <Modal title="Checkout" onClose={closeCheckout}>
          <div className="space-y-4 text-sm">
            {buyError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-300">
                {buyError}
              </div>
            )}

            <div className="flex items-center gap-3">
              {checkoutItem.logoUrl ?? checkoutItem.categoryLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={checkoutItem.logoUrl ?? checkoutItem.categoryLogoUrl ?? undefined}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-full border border-[var(--border)] object-cover"
                />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-black/5 dark:bg-white/5">
                  <IconBox size={20} />
                </span>
              )}
              <div className="min-w-0">
                <div className="font-bold">{checkoutItem.name}</div>
                {checkoutItem.description && (
                  <div className="text-xs text-[var(--text-muted)]">{checkoutItem.description}</div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-black/5 px-3 py-2.5 dark:bg-white/5">
              <span className="text-[var(--text-muted)]">Price</span>
              <span className="font-mono font-bold">{formatNaira(checkoutItem.price_cents)}</span>
            </div>

            <button className="btn-primary w-full" onClick={confirmPurchase} disabled={buying}>
              {buying ? "Processing..." : `Confirm purchase -- ${formatNaira(checkoutItem.price_cents)}`}
            </button>
          </div>
        </Modal>
      )}

      {delivered && (
        <Modal title="Purchase successful" onClose={() => setDelivered(null)}>
          <div className="space-y-3 text-sm">
            <p className="text-[var(--text-muted)]">
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
        </Modal>
      )}
    </section>
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
