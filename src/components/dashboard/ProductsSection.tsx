"use client";

import { useMemo, useState } from "react";
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

const PAGE_SIZE = 10;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildShuffledGroups(items: TemplateItem[]): Group[] {
  const map = new Map<string, Group>();
  for (const t of items) {
    const key = t.categoryId ?? "__uncategorized";
    if (!map.has(key)) {
      map.set(key, {
        categoryId: t.categoryId,
        categoryName: t.categoryName ?? "Other",
        categoryLogoUrl: t.categoryLogoUrl,
        items: [],
      });
    }
    map.get(key)!.items.push(t);
  }
  const groups = Array.from(map.values()).map((g) => ({ ...g, items: shuffle(g.items) }));
  return shuffle(groups);
}

/**
 * Dashboard "Marketplace" preview -- categories and their products, same
 * visual pattern as the full Marketplace page, but shuffled into a random
 * order (both which categories show first and which products within each)
 * rather than the alphabetical/most-recent order the full page uses.
 * Capped to PAGE_SIZE products total across categories. Tapping a product
 * opens a checkout confirmation right here on the dashboard; "See all"
 * still goes to the full Marketplace page to browse everything.
 */
export default function ProductsSection({ templates }: { templates: TemplateItem[] }) {
  // Shuffle once on mount, not on every render/search keystroke.
  const [baseGroups, setBaseGroups] = useState<Group[]>(() => buildShuffledGroups(templates));
  const [search, setSearch] = useState("");
  const [checkoutItem, setCheckoutItem] = useState<TemplateItem | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [delivered, setDelivered] = useState<DeliveredCredentials | null>(null);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result: Group[] = [];
    let count = 0;
    for (const g of baseGroups) {
      if (count >= PAGE_SIZE) break;
      const filtered = q
        ? g.items.filter(
            (t) =>
              t.name.toLowerCase().includes(q) ||
              (t.description ?? "").toLowerCase().includes(q) ||
              g.categoryName.toLowerCase().includes(q)
          )
        : g.items;
      if (filtered.length === 0) continue;
      const sliced = filtered.slice(0, PAGE_SIZE - count);
      result.push({ ...g, items: sliced });
      count += sliced.length;
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
                    <div className="truncate text-sm font-semibold">{t.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="badge bg-emerald-500/15 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        {t.available_count === 0 ? "Sold out" : `${t.available_count} pcs.`}
                      </span>
                      <span className="badge bg-black/10 text-[10px] font-mono font-semibold text-[var(--text)] dark:bg-white/10">
                        {formatNaira(t.price_cents)}
                      </span>
                    </div>
                  </div>
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
            <button className="btn-primary w-full" onClick={() => setDelivered(null)}>
              Done
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function CredentialRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2 text-sm">
      <span className="text-[var(--text-muted)]">{label}</span>
      <code>{value}</code>
    </div>
  );
}
