"use client";

import { useRef, useState } from "react";

interface CategoryItem {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  templateCount: number;
}

/** Small file-picker + preview used for both the create form and inline
 * edit. Uploads immediately on selection via /api/admin/categories/logo and
 * hands the resulting public URL back to the parent through onChange. */
function LogoPicker({
  logoUrl,
  onChange,
  idSuffix,
}: {
  logoUrl: string;
  onChange: (url: string) => void;
  idSuffix: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/admin/categories/logo", { method: "POST", body: formData });
    const json = await res.json();
    setUploading(false);
    if (!res.ok) {
      setError(json.error ?? "Upload failed");
      return;
    }
    onChange(json.url);
  }

  return (
    <div>
      <label className="label" htmlFor={`logo-${idSuffix}`}>
        Logo
      </label>
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-black/5 dark:bg-white/5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] text-[var(--text-muted)]">No logo</span>
          )}
        </div>
        <div className="flex-1">
          <input
            ref={inputRef}
            id={`logo-${idSuffix}`}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            className="block text-xs text-[var(--text-muted)]"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            disabled={uploading}
          />
          {uploading && <p className="mt-1 text-xs text-[var(--text-muted)]">Uploading...</p>}
          {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
          {logoUrl && !uploading && (
            <button
              type="button"
              className="mt-1 text-xs text-[var(--text-muted)] underline hover:text-[var(--text)]"
              onClick={() => {
                onChange("");
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              Remove logo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CategoryManager({ initial }: { initial: CategoryItem[] }) {
  const [list, setList] = useState(initial);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, logoUrl }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to add category");
      return;
    }
    setList((prev) => [
      ...prev,
      { ...json.category, logoUrl: json.category.logo_url ?? null, templateCount: 0 },
    ]);
    setName("");
    setDescription("");
    setLogoUrl("");
  }

  function startEdit(item: CategoryItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditDescription(item.description ?? "");
    setEditLogoUrl(item.logoUrl ?? "");
  }

  async function saveEdit(id: string) {
    setError(null);
    const res = await fetch("/api/admin/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editName, description: editDescription, logoUrl: editLogoUrl }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to update category");
      return;
    }
    setList((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...json.category, logoUrl: json.category.logo_url ?? null } : c))
    );
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
              <LogoPicker logoUrl={editLogoUrl} onChange={setEditLogoUrl} idSuffix={item.id} />
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
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-black/5 dark:bg-white/5">
                  {item.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[9px] text-[var(--text-muted)]">None</span>
                  )}
                </div>
                <div className="min-w-0 break-words">
                  <div className="font-bold">{item.name}</div>
                  <div className="text-sm text-[var(--text-muted)]">
                    {item.description ?? "—"} &middot; {item.templateCount} product{" "}
                    {item.templateCount === 1 ? "template" : "templates"}
                  </div>
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
        <LogoPicker logoUrl={logoUrl} onChange={setLogoUrl} idSuffix="new" />
        <button className="btn-primary w-full" type="submit" disabled={busy}>
          + {busy ? "Adding..." : "Add Category"}
        </button>
      </form>
    </div>
  );
}
