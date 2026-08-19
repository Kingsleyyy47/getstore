"use client";

import { useState } from "react";
import { formatNaira } from "@/lib/types";

interface Category {
  id: string;
  name: string;
}

interface TemplateItem {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  available_count: number;
  category_id: string | null;
  categoryName: string | null;
}

export default function ProductTemplateManager({
  categories,
  initial,
}: {
  categories: Category[];
  initial: TemplateItem[];
}) {
  const [list, setList] = useState(initial);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch("/api/admin/product-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, categoryId: categoryId || null, price, description }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to create template");
      return;
    }

    const category = categories.find((c) => c.id === json.template.category_id);
    setList((prev) => [
      { ...json.template, categoryName: category?.name ?? null },
      ...prev,
    ]);
    setName("");
    setCategoryId("");
    setPrice("");
    setDescription("");
  }

  async function remove(id: string) {
    setError(null);
    const res = await fetch(`/api/admin/product-templates?id=${id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Failed to delete template");
      return;
    }
    setList((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={create} className="card space-y-4 p-6">
        <h3 className="font-bold">Create New Product Template</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="product_name">
              Product Name
            </label>
            <input
              className="input"
              id="product_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Instagram Premium Accounts"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="category">
              Category
            </label>
            <select
              className="input"
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="price">
              Price (₦)
            </label>
            <input
              className="input"
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="2500"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="description">
              Description
            </label>
            <textarea
              className="input"
              id="description"
              rows={1}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this product template..."
            />
          </div>
        </div>
        <button className="btn-primary" type="submit" disabled={busy}>
          + {busy ? "Creating..." : "Create Template"}
        </button>
      </form>

      <div className="card divide-y divide-[var(--border)]">
        {list.length === 0 && (
          <p className="p-6 text-sm text-[var(--text-muted)]">No product templates yet.</p>
        )}
        {list.map((t) => (
          <div
            key={t.id}
            className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
          >
            <div className="min-w-0 break-words">
              <div className="font-bold">{t.name}</div>
              <div className="text-sm text-[var(--text-muted)]">
                {t.categoryName ?? "Uncategorized"} &middot; {formatNaira(t.price_cents)} &middot;{" "}
                {t.available_count} in stock
              </div>
            </div>
            <button
              className="btn-ghost border-red-500/30 text-red-300 hover:border-red-500/60"
              onClick={() => remove(t.id)}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
