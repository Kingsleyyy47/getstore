"use client";

import { useRef, useState } from "react";
import Modal from "@/components/Modal";

/** "Edit" on a template's 3-dot menu -- name, description, price, and
 * product image, per the Admin -> Categories flow. (Category/bulk-format
 * changes still live on the older Product Templates page if ever needed.) */
export default function EditTemplateModal({
  template,
  onClose,
  onSaved,
}: {
  template: {
    id: string;
    name: string;
    description: string | null;
    priceCents: number;
    imageUrl: string | null;
  };
  onClose: () => void;
  onSaved: (updated: {
    id: string;
    name: string;
    description: string | null;
    priceCents: number;
    imageUrl: string | null;
  }) => void;
}) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [price, setPrice] = useState(String(template.priceCents / 100));
  const [imageUrl, setImageUrl] = useState<string | null>(template.imageUrl ?? null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadImage(file: File) {
    setUploadingImage(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/admin/product-templates/image", { method: "POST", body: formData });
    const json = await res.json();
    setUploadingImage(false);
    if (!res.ok) {
      setError(json.error ?? "Image upload failed");
      return;
    }
    setImageUrl(json.url);
  }

  async function save() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setError("Enter a valid price");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/product-templates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: template.id, name, description, price: priceNum, imageUrl }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to save changes");
      return;
    }
    onSaved({
      id: template.id,
      name: json.template.name,
      description: json.template.description ?? null,
      priceCents: json.template.price_cents,
      imageUrl: json.template.image_url ?? null,
    });
  }

  return (
    <Modal title="Edit template" onClose={onClose}>
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        <div>
          <label className="label" htmlFor="edit_tmpl_name">
            Name
          </label>
          <input
            className="input"
            id="edit_tmpl_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="edit_tmpl_desc">
            Description
          </label>
          <textarea
            className="input"
            id="edit_tmpl_desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="edit_tmpl_price">
            Price (₦)
          </label>
          <input
            className="input"
            id="edit_tmpl_price"
            type="number"
            min="0"
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Product image</label>
          <p className="mb-2 text-xs text-[var(--text-muted)]">
            Uploading a new image here replaces the current one.
          </p>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-black/5 dark:bg-white/5">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[10px] text-[var(--text-muted)]">No image</span>
              )}
            </div>
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                className="block text-xs text-[var(--text-muted)]"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadImage(f);
                }}
                disabled={uploadingImage}
              />
              {uploadingImage && <p className="mt-1 text-xs text-[var(--text-muted)]">Uploading...</p>}
              {imageUrl && !uploadingImage && (
                <button
                  type="button"
                  className="mt-1 text-xs text-[var(--text-muted)] underline hover:text-[var(--text)]"
                  onClick={() => {
                    setImageUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  Remove image
                </button>
              )}
            </div>
          </div>
        </div>
        <button className="btn-primary w-full" type="button" onClick={save} disabled={busy || uploadingImage}>
          {busy ? "Saving..." : "Save changes"}
        </button>
      </div>
    </Modal>
  );
}
