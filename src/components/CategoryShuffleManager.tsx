"use client";

import { useState } from "react";
import { IconArrowUp, IconArrowDown, IconBox } from "@/components/icons";

interface CategoryItem {
  id: string;
  name: string;
  logoUrl: string | null;
  templateCount: number;
}

/**
 * Lets the admin drag... well, arrow-nudge categories into whatever order
 * they want them to appear in -- both the full Marketplace page and the
 * dashboard's Marketplace preview group products by category, and this is
 * the one place that decides which category shows first there. Up/down
 * buttons instead of drag-and-drop so it works the same on touch and
 * desktop with no extra dependency.
 */
export default function CategoryShuffleManager({ initial }: { initial: CategoryItem[] }) {
  const [list, setList] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    setList(next);
    save(next);
  }

  async function save(next: CategoryItem[]) {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/admin/categories/order", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: next.map((c) => c.id) }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to save the new order");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-muted)]">
          Top of this list shows first on the Marketplace page and the dashboard's Marketplace
          preview.
        </p>
        {saving && <span className="text-xs text-[var(--text-muted)]">Saving...</span>}
        {saved && !saving && <span className="text-xs text-teal-500">Saved</span>}
      </div>

      <div className="card divide-y divide-[var(--border)]">
        {list.length === 0 && (
          <p className="p-6 text-sm text-[var(--text-muted)]">No categories yet.</p>
        )}
        {list.map((c, i) => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <span className="w-5 shrink-0 text-center text-xs font-semibold text-[var(--text-muted)]">
              {i + 1}
            </span>
            {c.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.logoUrl}
                alt=""
                className="h-9 w-9 shrink-0 rounded-lg border border-[var(--border)] object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-black/5 text-[var(--text-muted)] dark:bg-white/5">
                <IconBox size={16} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{c.name}</div>
              <div className="text-xs text-[var(--text-muted)]">
                {c.templateCount} product{c.templateCount === 1 ? "" : "s"}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                className="btn-ghost h-8 w-8 p-0"
                aria-label={`Move ${c.name} up`}
                onClick={() => move(i, -1)}
                disabled={i === 0 || saving}
              >
                <IconArrowUp size={16} />
              </button>
              <button
                type="button"
                className="btn-ghost h-8 w-8 p-0"
                aria-label={`Move ${c.name} down`}
                onClick={() => move(i, 1)}
                disabled={i === list.length - 1 || saving}
              >
                <IconArrowDown size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
