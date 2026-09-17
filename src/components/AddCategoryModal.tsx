"use client";

import { useRef, useState } from "react";
import Modal from "@/components/Modal";

export interface CategoryFormResult {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
}

/** Same file-picker + preview pattern as the old CategoryManager -- uploads
 * immediately on selection via /api/admin/categories/logo and hands the
 * resulting public URL back to the parent through onChange. */
function LogoPicker({ logoUrl, onChange }: { logoUrl: string; onChange: (url: string) => void }) {
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
      <label className="label">Logo</label>
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

/** Create-or-edit modal for a category -- the one place left to manage
 * categories themselves now that Admin -> Categories is otherwise focused on
 * templates within each category. */
export default function AddCategoryModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: { id: string; name: string; description: string | null; logoUrl: string | null };
  onClose: () => void;
  onSaved: (category: CategoryFormResult) => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [logoUrl, setLogoUrl] = useState(initial?.logoUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Category name is required");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/categories", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isEdit ? { id: initial!.id, name, description, logoUrl } : { name, description, logoUrl }
      ),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to save category");
      return;
    }
    const c = json.category;
    onSaved({ id: c.id, name: c.name, description: c.description ?? null, logoUrl: c.logo_url ?? null });
  }

  return (
    <Modal title={isEdit ? "Edit category" : "New category"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        <div>
          <label className="label" htmlFor="cat_name">
            Category name
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
        <LogoPicker logoUrl={logoUrl} onChange={setLogoUrl} />
        <button className="btn-primary w-full" type="submit" disabled={busy}>
          {busy ? "Saving..." : isEdit ? "Save changes" : "+ Add Category"}
        </button>
      </form>
    </Modal>
  );
}
