"use client";

import { useEffect, useMemo, useState } from "react";
import { formatNaira, type DeliveredCredentials } from "@/lib/types";
import { resolveAccountFormat } from "@/lib/csv";
import { IconStore, IconSearch, IconBox, IconInfo, IconCopy, IconCheck } from "@/components/icons";
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
  // What this account comes with, e.g. ["username","password","two_fa"] --
  // shown to the buyer as an "Account Format" line before they purchase.
  bulkFormatFields?: string[] | null;
  field1Label?: string | null;
  field2Label?: string | null;
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
export default function ProductsSection({
  templates,
  balanceCents,
}: {
  templates: TemplateItem[];
  balanceCents: number;
}) {
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
  // "__all__" shows every category, same as before this filter existed.
  // Anything else is a group key (g.categoryId ?? "__uncategorized") --
  // picking one hides every other category's banner + products entirely.
  const [selectedCategory, setSelectedCategory] = useState("__all__");
  const [checkoutItem, setCheckoutItem] = useState<TemplateItem | null>(null);
  // How many of checkoutItem the customer wants -- editable (not stuck at
  // 1), but never more than what's actually in stock.
  const [quantity, setQuantity] = useState(1);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  // One purchase can now mean several accounts (quantity > 1) -- each
  // successful call to /api/marketplace/purchase (one per unit, looped
  // below) adds its own delivered credentials here.
  const [delivered, setDelivered] = useState<DeliveredCredentials[] | null>(null);
  // Tracked locally (starting from the server-rendered balance) so the
  // checkout modal's "Balance after" line stays correct across repeat
  // purchases in the same visit, without needing a full page refetch.
  const [walletBalanceCents, setWalletBalanceCents] = useState(balanceCents);
  // Captured from checkoutItem at the moment of purchase (checkoutItem
  // itself gets cleared right after) so the "Purchase successful" modal can
  // still show the correct per-product Account Format alongside the actual
  // delivered values.
  const [deliveredItem, setDeliveredItem] = useState<TemplateItem | null>(null);
  // Set only when a multi-quantity purchase stopped partway (see the loop
  // in confirmPurchase) -- shown in the "Purchase successful" modal so it's
  // clear fewer accounts were delivered than were asked for, instead of
  // silently looking like a full success.
  const [deliveredNote, setDeliveredNote] = useState<string | null>(null);

  const categoryOptions = useMemo(
    () => baseGroups.map((g) => ({ key: g.categoryId ?? "__uncategorized", name: g.categoryName })),
    [baseGroups]
  );

  const groups = useMemo(() => {
    const byCategory =
      selectedCategory === "__all__"
        ? baseGroups
        : baseGroups.filter((g) => (g.categoryId ?? "__uncategorized") === selectedCategory);

    const q = search.trim().toLowerCase();
    if (!q) return byCategory;
    const result: Group[] = [];
    for (const g of byCategory) {
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
  }, [baseGroups, search, selectedCategory]);

  const hasAny = baseGroups.some((g) => g.items.length > 0);

  function openCheckout(t: TemplateItem) {
    setCheckoutItem(t);
    setQuantity(1);
    setBuyError(null);
  }

  function closeCheckout() {
    setCheckoutItem(null);
    setBuyError(null);
  }

  async function confirmPurchase() {
    if (!checkoutItem) return;
    const boughtId = checkoutItem.id;
    const qty = Math.max(1, Math.min(quantity, checkoutItem.available_count));
    setBuying(true);
    setBuyError(null);

    // No bulk-purchase endpoint exists server-side -- product_orders /
    // purchase_product() always hands out exactly one stock item per call
    // (this is what stops two customers ever landing on the same account),
    // so buying a quantity > 1 just calls it that many times in a row and
    // collects every delivered set of credentials. If stock runs out
    // mid-way (someone else bought the last one) or the wallet balance
    // isn't enough for the next unit, this stops right there and still
    // shows whatever was successfully bought instead of losing it.
    const orders: DeliveredCredentials[] = [];
    let failure: string | null = null;
    for (let i = 0; i < qty; i++) {
      const res = await fetch("/api/marketplace/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: boughtId }),
      });
      const json = await res.json();
      if (!res.ok) {
        failure = json.error ?? "Purchase failed";
        break;
      }
      orders.push(json.order);
    }

    setBuying(false);

    if (orders.length === 0) {
      setBuyError(failure ?? "Purchase failed");
      return;
    }

    setDeliveredNote(failure ? `Only ${orders.length} of ${qty} could be bought -- ${failure}` : null);
    setDelivered(orders);
    setDeliveredItem(checkoutItem);
    setWalletBalanceCents((prev) => Math.max(0, prev - checkoutItem.price_cents * orders.length));
    setCheckoutItem(null);
    setBaseGroups((prev) =>
      prev.map((g) => ({
        ...g,
        items: g.items.map((t) =>
          t.id === boughtId ? { ...t, available_count: Math.max(0, t.available_count - orders.length) } : t
        ),
      }))
    );
  }

  return (
    <section className="card space-y-3 p-4 sm:p-5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-[var(--text-muted)]">
          <IconStore size={16} />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-bold">Marketplace</div>
          <div className="truncate text-xs text-[var(--text-muted)]">Premium accounts, all categories</div>
        </div>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
          <IconSearch size={14} />
        </span>
        <input
          className="input h-9 w-full pl-8 text-sm"
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {categoryOptions.length > 1 && (
        <select
          className="input h-9 w-full text-sm"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="__all__">All categories</option>
          {categoryOptions.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </select>
      )}

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

            <div className="rounded-lg border border-brand/30 bg-brand/5 px-3 py-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-brand">
                <IconInfo size={13} />
                Account Format
              </div>
              <code className="block break-words text-xs text-[var(--text-muted)]">
                {resolveAccountFormat(
                  checkoutItem.name,
                  checkoutItem.bulkFormatFields,
                  checkoutItem.field1Label,
                  checkoutItem.field2Label
                )}
              </code>
            </div>

            <div className="divide-y divide-[var(--border)] rounded-lg bg-black/5 px-3 dark:bg-white/5">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-[var(--text-muted)]">Quantity</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] text-sm font-bold disabled:opacity-40"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={checkoutItem.available_count}
                    value={quantity}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (Number.isNaN(n)) return;
                      setQuantity(Math.max(1, Math.min(n, checkoutItem.available_count)));
                    }}
                    className="input h-7 w-14 px-1 text-center text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(checkoutItem.available_count, q + 1))}
                    disabled={quantity >= checkoutItem.available_count}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] text-sm font-bold disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-[var(--text-muted)]">Price</span>
                <span className="font-mono font-bold">{formatNaira(checkoutItem.price_cents * quantity)}</span>
              </div>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">{checkoutItem.available_count} in stock</p>

            <p className="text-right text-[11px] text-[var(--text-muted)]">
              Balance after purchase:{" "}
              {formatNaira(Math.max(0, walletBalanceCents - checkoutItem.price_cents * quantity))}
            </p>

            <button className="btn-primary w-full" onClick={confirmPurchase} disabled={buying}>
              {buying
                ? "Processing..."
                : `Confirm purchase -- ${formatNaira(checkoutItem.price_cents * quantity)}`}
            </button>
          </div>
        </Modal>
      )}

      {delivered && (
        <Modal
          title="Purchase successful"
          onClose={() => {
            setDelivered(null);
            setDeliveredItem(null);
            setDeliveredNote(null);
          }}
        >
          <div className="space-y-3 text-sm">
            <p className="text-[var(--text-muted)]">
              {delivered.length > 1
                ? `Here are your ${delivered.length} account details. You can also find these later on the Logs page.`
                : "Here are your account details. You can also find this later on the Logs page."}
            </p>
            {deliveredNote && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-600 dark:text-amber-300">
                {deliveredNote}
              </div>
            )}
            {deliveredItem && (
              <div className="rounded-lg border border-brand/30 bg-brand/5 px-3 py-2.5">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-brand">
                  <IconInfo size={13} />
                  Account Format
                </div>
                <code className="block break-words text-xs text-[var(--text-muted)]">
                  {resolveAccountFormat(
                    deliveredItem.name,
                    deliveredItem.bulkFormatFields,
                    deliveredItem.field1Label,
                    deliveredItem.field2Label
                  )}
                </code>
              </div>
            )}
            {delivered.map((order, i) => (
              <div key={i} className="space-y-2">
                {delivered.length > 1 && (
                  <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Account {i + 1} of {delivered.length}
                  </div>
                )}
                <CredentialRow label="Email" value={order.email} />
                <CredentialRow label="Username" value={order.username} />
                <CredentialRow label="Password" value={order.password} />
                <CredentialRow label="Email password" value={order.email_password} />
                <CredentialRow label="2FA code" value={order.two_fa} />
                <CredentialRow label="Recovery email" value={order.recovery_email} />
                <CredentialRow label="Recovery email password" value={order.recovery_email_password} />
                {/* Always last -- a link-only item (no password/username at
                    all, see DeliveredCredentials in src/lib/types.ts) has
                    nothing else to show here, so this is often the only row. */}
                <CredentialRow label="Login link" value={order.link} isLink />
              </div>
            ))}
            <button
              className="btn-primary w-full"
              onClick={() => {
                setDelivered(null);
                setDeliveredItem(null);
                setDeliveredNote(null);
              }}
            >
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
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable -- ignore, the value is still visible to select/copy manually
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-black/20 px-3 py-2 text-sm">
      <span className="shrink-0 text-[var(--text-muted)]">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        {isLink ? (
          <a href={value} target="_blank" rel="noopener noreferrer" className="break-all text-brand underline">
            {value}
          </a>
        ) : (
          <code className="break-all">{value}</code>
        )}
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label}`}
          className="shrink-0 rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--text)]"
        >
          {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
        </button>
      </div>
    </div>
  );
}
