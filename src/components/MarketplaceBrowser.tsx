"use client";

import { useMemo, useState } from "react";
import { formatNaira, type DeliveredCredentials } from "@/lib/types";
import { resolveAccountFormat } from "@/lib/csv";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";
import { IconStore, IconBox, IconSearch, IconInfo, IconCopy, IconCheck } from "@/components/icons";

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
  // What this account comes with, e.g. ["username","password","two_fa"] --
  // shown as an "Account Format" line inside the checkout confirmation
  // modal, opened by tapping the product card (see openCheckout below).
  bulkFormatFields?: string[] | null;
  field1Label?: string | null;
  field2Label?: string | null;
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

export default function MarketplaceBrowser({
  templates,
  balanceCents,
}: {
  templates: TemplateItem[];
  balanceCents: number;
}) {
  const [error, setError] = useState<string | null>(null);
  // One purchase can now mean several accounts (quantity > 1) -- each
  // successful call to /api/marketplace/purchase (one per unit, looped
  // in confirmPurchase) adds its own delivered credentials here.
  const [delivered, setDelivered] = useState<DeliveredCredentials[] | null>(null);
  // Set only when a multi-quantity purchase stopped partway.
  const [deliveredNote, setDeliveredNote] = useState<string | null>(null);
  // Tracked locally (starting from the server-rendered balance) so the
  // checkout modal's "Balance after" line stays correct across repeat
  // purchases in the same visit, without needing a full page refetch.
  const [walletBalanceCents, setWalletBalanceCents] = useState(balanceCents);
  // Captured from checkoutItem at the moment of purchase (checkoutItem
  // itself gets cleared right after) so the "Purchase successful" modal can
  // still show the correct per-product Account Format alongside the actual
  // delivered values.
  const [deliveredItem, setDeliveredItem] = useState<TemplateItem | null>(null);
  const [list, setList] = useState(templates);
  const [search, setSearch] = useState("");
  // "__all__" shows every category, same as before this filter existed.
  // Anything else is a group key (categoryId ?? "__uncategorized") -- see
  // the matching filter on `groups` below.
  const [selectedCategory, setSelectedCategory] = useState("__all__");
  // Tapping a product opens a checkout confirmation modal (same pattern as
  // the dashboard's Marketplace preview) instead of buying instantly --
  // this is where the Account Format now lives, rather than cluttering
  // every card in the grid.
  const [checkoutItem, setCheckoutItem] = useState<TemplateItem | null>(null);
  // How many of checkoutItem the customer wants -- editable (not stuck at
  // 1), but never more than what's actually in stock.
  const [quantity, setQuantity] = useState(1);
  const [buying, setBuying] = useState(false);

  function openCheckout(t: TemplateItem) {
    setCheckoutItem(t);
    setQuantity(1);
    setError(null);
  }

  function closeCheckout() {
    setCheckoutItem(null);
    setError(null);
  }

  async function confirmPurchase() {
    if (!checkoutItem) return;
    const id = checkoutItem.id;
    const qty = Math.max(1, Math.min(quantity, checkoutItem.available_count));
    setBuying(true);
    setError(null);

    // No bulk-purchase endpoint exists server-side -- purchase_product()
    // always hands out exactly one stock item per call (this is what stops
    // two customers ever landing on the same account), so buying a
    // quantity > 1 just calls it that many times in a row and collects
    // every delivered set of credentials. If stock runs out mid-way or the
    // wallet balance isn't enough for the next unit, this stops right
    // there and still shows whatever was successfully bought.
    const orders: DeliveredCredentials[] = [];
    let failure: string | null = null;
    for (let i = 0; i < qty; i++) {
      const res = await fetch("/api/marketplace/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: id }),
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
      setError(failure ?? "Purchase failed");
      return;
    }

    setDeliveredNote(failure ? `Only ${orders.length} of ${qty} could be bought -- ${failure}` : null);
    setDelivered(orders);
    setDeliveredItem(checkoutItem);
    setWalletBalanceCents((prev) => Math.max(0, prev - checkoutItem.price_cents * orders.length));
    setCheckoutItem(null);
    setList((prev) =>
      prev.map((t) => (t.id === id ? { ...t, available_count: Math.max(0, t.available_count - orders.length) } : t))
    );
  }

  // Options for the category dropdown -- built from the full, unfiltered
  // list so every category still shows up regardless of the current search
  // text or which category is currently selected.
  const categoryOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of list) {
      const key = t.categoryId ?? "__uncategorized";
      if (!seen.has(key)) seen.set(key, t.categoryName ?? "Other");
    }
    return Array.from(seen, ([key, name]) => ({ key, name }));
  }, [list]);

  const filteredList = useMemo(() => {
    const byCategory =
      selectedCategory === "__all__"
        ? list
        : list.filter((t) => (t.categoryId ?? "__uncategorized") === selectedCategory);

    const q = search.trim().toLowerCase();
    if (!q) return byCategory;
    return byCategory.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q) ||
        (t.categoryName ?? "").toLowerCase().includes(q)
    );
  }, [list, search, selectedCategory]);

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

      {list.length > 0 && categoryOptions.length > 1 && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory("__all__")}
            className={`btn-ghost h-9 shrink-0 whitespace-nowrap px-3 text-sm ${
              selectedCategory === "__all__" ? "!bg-brand !text-white" : ""
            }`}
          >
            All
          </button>
          <select
            className="input h-9 flex-1 text-sm"
            value={selectedCategory === "__all__" ? "" : selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value || "__all__")}
          >
            <option value="" disabled>
              Choose a category...
            </option>
            {categoryOptions.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
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
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openCheckout(t)}
                  disabled={t.available_count === 0}
                  className="card flex items-center gap-3 p-3.5 text-left transition-colors enabled:hover:border-[var(--hover-border)] disabled:opacity-60 sm:p-4"
                >
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

                  <span
                    className={`btn-primary flex h-9 shrink-0 items-center gap-1 px-4 text-sm ${
                      t.available_count === 0 ? "opacity-60" : ""
                    }`}
                  >
                    {t.available_count === 0 ? "Sold" : "Buy"}
                    {t.available_count > 0 && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
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
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-300">{error}</div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card max-h-[85vh] w-full max-w-md space-y-3 overflow-y-auto p-6">
            <h3 className="text-lg font-bold">Purchase successful</h3>
            <p className="text-sm text-[var(--text-muted)]">
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
