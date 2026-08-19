"use client";

import { useState } from "react";

interface CategoryItem {
  id: string;
  name: string;
  description: string | null;
  templateCount: number;
}

export default function CategoryManager({ initial }: { initial: CategoryItem[] }) {
  const [list, setList] = useState(initial);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to add category");
      return;
    }
    setList((prev) => [...prev, { ...json.category, templateCount: 0 }]);
    setName("");
    setDescription("");
  }

  function startEdit(item: CategoryItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditDescription(item.description ?? "");
  }

  async function saveEdit(id: string) {
    setError(null);
    const res = await fetch("/api/admin/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editName, description: editDescription }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to update category");
      return;
    }
    setList((prev) => prev.map((c) => (c.id === id ? { ...c, ...json.category } : c)));
    setEditingId(null);
  }

  async function remove(id: string) {
    setError(null);
    const res = await fetch(`/api/admin/categories?id=${id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Failed to delete category");
      return;
    }
    setList((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="card divide-y divide-[var(--border)]">
        {list.length === 0 && (
          <p className="p-6 text-sm text-[var(--text-muted)]">No categories yet.</p>
        )}
        {list.map((item) =>
          editingId === item.id ? (
            <div key={item.id} className="space-y-3 px-6 py-4">
              <input
                className="input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Category name"
              />
              <input
                className="input"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Description"
              />
              <div className="flex gap-2">
                <button className="btn-primary" onClick={() => saveEdit(item.id)}>
                  Save
                </button>
                <button className="btn-ghost" onClick={() => setEditingId(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              key={item.id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <div className="min-w-0 break-words">
                <div className="font-bold">{item.name}</div>
                <div className="text-sm text-[var(--text-muted)]">
                  {item.description ?? "—"} &middot; {item.templateCount} product{" "}
                  {item.templateCount === 1 ? "template" : "templates"}
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost" onClick={() => startEdit(item)}>
                  Edit
                </button>
                <button
                  className="btn-ghost border-red-500/30 text-red-300 hover:border-red-500/60"
                  onClick={() => remove(item.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          )
        )}
      </div>

      <form
        onSubmit={addCategory}
        className="space-y-4 rounded-2xl border border-dashed border-[var(--border)] p-6"
      >
        <h3 className="font-bold">Add New Category</h3>
        <div>
          <label className="label" htmlFor="cat_name">
            Category Name
          </label>
          <input
            className="input"
            id="cat_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Instagram Accounts"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="cat_desc">
            Description
          </label>
          <input
            className="input"
            id="cat_desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., High-quality Instagram accounts"
          />
        </div>
        <button className="btn-primary w-full" type="submit" disabled={busy}>
          + {busy ? "Adding..." : "Add Category"}
        </button>
      </form>
    </div>
  );
}
