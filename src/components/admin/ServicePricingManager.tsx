"use client";

import { useEffect, useMemo, useState } from "react";
import { formatNaira } from "@/lib/types";
import { IconStar, IconChevronDown, IconSearch } from "@/components/icons";

interface Item {
  code: string;
  name: string;
  costUsd: number;
  available: number | null;
  isFavorite: boolean;
  isEnabled: boolean;
  marginCents: number | null;
  autoMarkup: boolean;
  customerPriceCents: number;
  hasOverride: boolean;
}

export default function ServicePricingManager({
  provider,
  providerLabel,
  country,
  countries,
  onCountryChange,
}: {
  provider: "daisysms" | "daisysim" | "daisysim2";
  providerLabel: string;
  country?: string;
  countries?: { id: string; name: string }[];
  onCountryChange?: (id: string) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [rate, setRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showNaira, setShowNaira] = useState(true);
  const [favoritesOpen, setFavoritesOpen] = useState(true);

  const [bulkMargin, setBulkMargin] = useState("");
  const [keepAutoApplying, setKeepAutoApplying] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const qs = country ? `?country=${encodeURIComponent(country)}` : "";
    const res = await fetch(`/api/admin/pricing/${provider}${qs}`);
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to load pricing");
      return;
    }
    setItems(json.items);
    setRate(json.rate);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, country]);

  async function post(action: string, extra: Record<string, unknown>) {
    const res = await fetch(`/api/admin/pricing/${provider}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, country: country ?? "", ...extra }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to save");
  }

  function patchItem(code: string, patch: Partial<Item>) {
    setItems((list) => list.map((i) => (i.code === code ? { ...i, ...patch } : i)));
  }

  async function toggleFavorite(item: Item) {
    const next = !item.isFavorite;
    patchItem(item.code, { isFavorite: next });
    try {
      await post("toggle-favorite", { serviceCode: item.code, name: item.name, favorite: next });
    } catch {
      patchItem(item.code, { isFavorite: !next });
    }
  }

  async function toggleEnabled(item: Item) {
    const next = !item.isEnabled;
    patchItem(item.code, { isEnabled: next });
    try {
      await post("toggle-enabled", { serviceCode: item.code, name: item.name, enabled: next });
    } catch {
      patchItem(item.code, { isEnabled: !next });
    }
  }

  async function toggleAutoMarkup(item: Item) {
    const next = !item.autoMarkup;
    patchItem(item.code, { autoMarkup: next });
    try {
      await post("toggle-auto-markup", { serviceCode: item.code, name: item.name, autoMarkup: next });
      await load();
    } catch {
      patchItem(item.code, { autoMarkup: !next });
    }
  }

  async function saveMargin(item: Item, marginNairaStr: string) {
    try {
      await post("save-margin", {
        serviceCode: item.code,
        name: item.name,
        costUsd: item.costUsd,
        rate,
        marginNaira: marginNairaStr === "" ? null : Number(marginNairaStr),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save margin");
    }
  }

  async function savePrice(item: Item, priceNairaStr: string) {
    try {
      await post("save-price", {
        serviceCode: item.code,
        name: item.name,
        customerPriceNaira: priceNairaStr === "" ? null : Number(priceNairaStr),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save price");
    }
  }

  const filtered = useMemo(
    () => items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()) || i.code.toLowerCase().includes(search.toLowerCase())),
    [items, search]
  );
  const favorites = filtered.filter((i) => i.isFavorite);
  const rest = filtered.filter((i) => !i.isFavorite);

  async function applyBulkMargin() {
    if (!bulkMargin) return;
    setBulkBusy(true);
    setError(null);
    try {
      await post("bulk-margin", {
        marginNaira: Number(bulkMargin),
        keepAutoApplying,
        items: filtered.map((i) => ({ serviceCode: i.code, name: i.name, costUsd: i.costUsd })),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply bulk markup");
    }
    setBulkBusy(false);
  }

  async function bulkSetEnabled(enabled: boolean) {
    setBulkBusy(true);
    setError(null);
    try {
      await post("bulk-enabled", {
        enabled,
        items: filtered.map((i) => ({ serviceCode: i.code, name: i.name })),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    }
    setBulkBusy(false);
  }

  return (
    <div className="space-y-4">
      {countries && countries.length > 0 && (
        <div>
          <label className="label" htmlFor="pricing-country">
            Country
          </label>
          <select
            id="pricing-country"
            className="input max-w-xs"
            value={country ?? ""}
            onChange={(e) => onCountryChange?.(e.target.value)}
          >
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <button type="button" className="btn-ghost" onClick={() => setShowNaira((v) => !v)}>
        Show {providerLabel} cost in {showNaira ? "₦" : "$"}
      </button>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[180px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
            <IconSearch size={16} />
          </span>
          <input
            className="input pl-9"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <input
          className="input w-32"
          placeholder="₦ e.g. 1000"
          value={bulkMargin}
          onChange={(e) => setBulkMargin(e.target.value)}
        />
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <input type="checkbox" checked={keepAutoApplying} onChange={(e) => setKeepAutoApplying(e.target.checked)} />
          Keep auto-applying on future syncs
        </label>
        <button type="button" className="btn-ghost" onClick={applyBulkMargin} disabled={bulkBusy || !bulkMargin}>
          Markup
        </button>
        <button type="button" className="btn-ghost" onClick={() => bulkSetEnabled(true)} disabled={bulkBusy}>
          Enable all ({filtered.length})
        </button>
        <button type="button" className="btn-ghost" onClick={() => bulkSetEnabled(false)} disabled={bulkBusy}>
          Disable all ({filtered.length})
        </button>
      </div>

      {loading ? (
        <div className="card p-6 text-sm text-[var(--text-muted)]">Loading...</div>
      ) : (
        <>
          {favorites.length > 0 && (
            <div className="card overflow-hidden border-amber-400/40">
              <button
                type="button"
                onClick={() => setFavoritesOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-600 dark:text-amber-300"
              >
                <span className="flex items-center gap-2">
                  <IconStar size={16} filled />
                  Favorites ({favorites.length})
                </span>
                <span className={`transition-transform ${favoritesOpen ? "rotate-180" : ""}`}>
                  <IconChevronDown size={16} />
                </span>
              </button>
              {favoritesOpen && (
                <div className="divide-y divide-[var(--border)]">
                  {favorites.map((item) => (
                    <Row
                      key={item.code}
                      item={item}
                      rate={rate}
                      showNaira={showNaira}
                      onToggleFavorite={() => toggleFavorite(item)}
                      onToggleEnabled={() => toggleEnabled(item)}
                      onToggleAutoMarkup={() => toggleAutoMarkup(item)}
                      onSaveMargin={(v) => saveMargin(item, v)}
                      onSavePrice={(v) => savePrice(item, v)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="hidden grid-cols-4 gap-4 border-b border-[var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] sm:grid">
              <div>Product</div>
              <div>Cost</div>
              <div>Customer price (₦)</div>
              <div className="text-right">Enabled</div>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {rest.length === 0 && (
                <div className="p-6 text-center text-sm text-[var(--text-muted)]">No products found.</div>
              )}
              {rest.map((item) => (
                <Row
                  key={item.code}
                  item={item}
                  rate={rate}
                  showNaira={showNaira}
                  onToggleFavorite={() => toggleFavorite(item)}
                  onToggleEnabled={() => toggleEnabled(item)}
                  onToggleAutoMarkup={() => toggleAutoMarkup(item)}
                  onSaveMargin={(v) => saveMargin(item, v)}
                  onSavePrice={(v) => savePrice(item, v)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Row({
  item,
  rate,
  showNaira,
  onToggleFavorite,
  onToggleEnabled,
  onToggleAutoMarkup,
  onSaveMargin,
  onSavePrice,
}: {
  item: Item;
  rate: number;
  showNaira: boolean;
  onToggleFavorite: () => void;
  onToggleEnabled: () => void;
  onToggleAutoMarkup: () => void;
  onSaveMargin: (v: string) => void;
  onSavePrice: (v: string) => void;
}) {
  const [marginInput, setMarginInput] = useState(item.marginCents != null ? String(item.marginCents / 100) : "");
  const [priceInput, setPriceInput] = useState(String(item.customerPriceCents / 100));

  return (
    <div className="flex flex-col gap-3 px-4 py-4 text-sm sm:grid sm:grid-cols-4 sm:items-start sm:gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label={item.isFavorite ? "Unfavorite" : "Favorite"}
            className={item.isFavorite ? "text-amber-500" : "text-[var(--text-muted)] hover:text-amber-500"}
          >
            <IconStar size={16} filled={item.isFavorite} />
          </button>
          <span className="font-semibold break-words">{item.name}</span>
        </div>
        {item.available != null && (
          <div className="ml-6 text-xs text-[var(--text-muted)]">{item.available} available</div>
        )}
        <div className="ml-6 mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={item.autoMarkup}
            onClick={onToggleAutoMarkup}
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
              item.autoMarkup ? "bg-brand" : "bg-[var(--border)]"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                item.autoMarkup ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className="text-xs text-[var(--text-muted)]">Auto-markup</span>
          <input
            className="input h-8 w-20 px-2 py-1 text-xs"
            value={marginInput}
            onChange={(e) => setMarginInput(e.target.value)}
            placeholder="₦ 700"
          />
          <button type="button" className="btn-ghost h-8 px-2.5 py-0 text-xs" onClick={() => onSaveMargin(marginInput)}>
            Save margin
          </button>
        </div>
      </div>

      <div className="text-[var(--text-muted)]">
        <div className="text-xs font-semibold uppercase tracking-wide">
          {showNaira ? "cost (₦)" : "cost ($)"}
        </div>
        <div className="font-bold text-[var(--text)]">
          {showNaira ? formatNaira(Math.round(item.costUsd * rate * 100)) : `$${item.costUsd.toFixed(2)}`}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          className="input h-9 w-28 px-2 py-1 text-sm"
          value={priceInput}
          onChange={(e) => setPriceInput(e.target.value)}
        />
        <button type="button" className="btn-ghost h-9 px-3 py-0 text-xs" onClick={() => onSavePrice(priceInput)}>
          Save
        </button>
      </div>

      <div className="flex items-center sm:justify-end">
        <button
          type="button"
          role="switch"
          aria-checked={item.isEnabled}
          onClick={onToggleEnabled}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            item.isEnabled ? "bg-brand" : "bg-[var(--border)]"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              item.isEnabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
