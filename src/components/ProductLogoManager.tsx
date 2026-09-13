"use client";

import { useRef, useState } from "react";

interface ProductLogoItem {
  id: string;
  name: string;
  logoUrl: string;
}

/** Small file-picker + preview used for both the create form and inline
 * edit. Uploads immediately on selection via /api/admin/product-logos/logo
 * and hands the resulting public URL back to the parent through onChange. */
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
    const res = await fetch("/api/admin/product-logos/logo", { method: "POST", body: formData });
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
      <label className="label" htmlFor={`plogo-${idSuffix}`}>
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
            id={`plogo-${idSuffix}`}
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
        </div>
      </div>
    </div>
  );
}

export default function ProductLogoManager({ initial }: { initial: ProductLogoItem[] }) {
  const [list, setList] = useState(initial);
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");

  async function addLogo(e: React.FormEvent) {
    e.preventDefault();
    if (!logoUrl) {
      setError("Upload a logo image first");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/product-logos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, logoUrl }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to add logo");
      return;
    }
    setList((prev) => [
      ...prev,
      { id: json.productLogo.id, name: json.productLogo.name, logoUrl: json.productLogo.logo_url },
    ]);
    setName("");
    setLogoUrl("");
  }

  function startEdit(item: ProductLogoItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditLogoUrl(item.logoUrl);
  }

  async function saveEdit(id: string) {
    setError(null);
    const res = await fetch("/api/admin/product-logos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editName, logoUrl: editLogoUrl }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to update logo");
      return;
    }
    setList((prev) =>
      prev.map((c) => (c.id === id ? { id, name: json.productLogo.name, logoUrl: json.productLogo.logo_url } : c))
    );
    setEditingId(null);
  }

  async function remove(id: string) {
    setError(null);
    const res = await fetch(`/api/admin/product-logos?id=${id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Failed to delete logo");
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
          <p className="p-6 text-sm text-[var(--text-muted)]">No product logos yet.</p>
        )}
        {list.map((item) =>
          editingId === item.id ? (
            <div key={item.id} className="space-y-3 px-6 py-4">
              <input
                className="input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Product name, e.g. Facebook"
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
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-black/5 dark:bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.logoUrl} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 break-words">
                  <div className="font-bold">{item.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    Applies to every product named &quot;{item.name}&quot; sitewide
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
        onSubmit={addLogo}
        className="space-y-4 rounded-2xl border border-dashed border-[var(--border)] p-6"
      >
        <h3 className="font-bold">Add Product Logo</h3>
        <div>
          <label className="label" htmlFor="plogo_name">
            Product name
          </label>
          <input
            className="input"
            id="plogo_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Facebook"
            required
          />
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Matched against product template names sitewide, case-insensitive -- any current or
            future product template named exactly this will show this logo.
          </p>
        </div>
        <LogoPicker logoUrl={logoUrl} onChange={setLogoUrl} idSuffix="new" />
        <button className="btn-primary w-full" type="submit" disabled={busy}>
          + {busy ? "Adding..." : "Add Logo"}
        </button>
      </form>
    </div>
  );
}
