"use client";

import { useRef, useState } from "react";
import Modal from "@/components/Modal";

export interface LogoOption {
  id: string;
  name: string;
  logoUrl: string;
}

export interface CreatedTemplate {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  availableCount: number;
  categoryId: string;
  archived: boolean;
  imageUrl: string | null;
  logoUrl: string | null;
  bulkFormatFields: string[] | null;
  field1Label: string | null;
  field2Label: string | null;
}

const LOGOS_PER_PAGE = 9; // 3x3

/**
 * Two-step "Add Template" wizard, opened from a category's "+ Add Template"
 * button.
 *
 * Step 1: pick an already-uploaded logo (3x3 grid, "Show more" reveals the
 * rest) and/or type a custom name -- either one alone is enough to continue.
 * Picking a logo pre-fills the name with that logo's name (still editable).
 *
 * Step 2: highlights the chosen name, collects a description + price, and
 * lets the admin upload a one-off product image. Uploading an image here
 * always overrides whatever logo was picked in step 1.
 */
export default function AddTemplateModal({
  categoryId,
  categoryName,
  logoOptions,
  onClose,
  onCreated,
}: {
  categoryId: string;
  categoryName: string;
  logoOptions: LogoOption[];
  onClose: () => void;
  onCreated: (template: CreatedTemplate) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 state
  const [selectedLogo, setSelectedLogo] = useState<LogoOption | null>(null);
  const [customName, setCustomName] = useState("");
  const [showAllLogos, setShowAllLogos] = useState(false);

  // Step 2 state
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const finalName = customName.trim() || selectedLogo?.name || "";
  const previewImage = uploadedImageUrl ?? selectedLogo?.logoUrl ?? null;
  const visibleLogos = showAllLogos ? logoOptions : logoOptions.slice(0, LOGOS_PER_PAGE);

  function pickLogo(logo: LogoOption) {
    setSelectedLogo(logo);
    // Pre-fill (or replace) the name with the logo's own name -- still
    // freely editable afterwards.
    setCustomName(logo.name);
  }

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
    setUploadedImageUrl(json.url);
  }

  async function createTemplate() {
    if (!finalName) {
      setError("Enter a name first");
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: finalName,
        categoryId,
        description,
        price: priceNum,
        imageUrl: uploadedImageUrl ?? selectedLogo?.logoUrl ?? null,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to create template");
      return;
    }
    const t = json.template;
    onCreated({
      id: t.id,
      name: t.name,
      description: t.description ?? null,
      priceCents: t.price_cents,
      availableCount: t.available_count ?? 0,
      categoryId: t.category_id,
      archived: !!t.archived,
      imageUrl: t.image_url ?? null,
      logoUrl: t.image_url ?? null,
      bulkFormatFields: t.bulk_format_fields ?? null,
      field1Label: t.field_1_label ?? null,
      field2Label: t.field_2_label ?? null,
    });
  }

  return (
    <Modal title={step === 1 ? `New template in ${categoryName}` : "New template details"} onClose={onClose}>
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {step === 1 ? (
          <>
            <div>
              <div className="label mb-2">Choose a logo</div>
              {logoOptions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[var(--border)] p-4 text-sm text-[var(--text-muted)]">
                  No logos uploaded yet -- just type a custom name below instead.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {visibleLogos.map((logo) => {
                      const active = selectedLogo?.id === logo.id;
                      return (
                        <button
                          type="button"
                          key={logo.id}
                          onClick={() => pickLogo(logo)}
                          className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition-colors ${
                            active
                              ? "border-brand bg-brand/10"
                              : "border-[var(--border)] hover:border-[var(--hover-border)]"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={logo.logoUrl}
                            alt=""
                            className="h-12 w-12 rounded-lg object-cover"
                          />
                          <span className="w-full truncate text-[11px] font-medium">{logo.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  {!showAllLogos && logoOptions.length > LOGOS_PER_PAGE && (
                    <button
                      type="button"
                      className="btn-ghost mt-2 w-full"
                      onClick={() => setShowAllLogos(true)}
                    >
                      Show more ({logoOptions.length - LOGOS_PER_PAGE} more)
                    </button>
                  )}
                </>
              )}
            </div>

            <div>
              <label className="label" htmlFor="custom_name">
                Custom name
              </label>
              <input
                className="input"
                id="custom_name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g., Facebook Aged Account"
              />
            </div>

            <button
              className="btn-primary w-full"
              type="button"
              disabled={!finalName}
              onClick={() => setStep(2)}
            >
              Continue
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-black/5 dark:bg-white/5">
                {previewImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[9px] text-[var(--text-muted)]">No image</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs text-[var(--text-muted)]">Product name</div>
                <div className="truncate font-bold">{finalName}</div>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="tmpl_desc">
                Description
              </label>
              <textarea
                className="input"
                id="tmpl_desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What the customer is buying"
              />
            </div>

            <div>
              <label className="label" htmlFor="tmpl_price">
                Price (₦)
              </label>
              <input
                className="input"
                id="tmpl_price"
                type="number"
                min="0"
                step="1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g., 2500"
                required
              />
            </div>

            <div>
              <label className="label">Product image</label>
              <p className="mb-2 text-xs text-[var(--text-muted)]">
                Optional. Uploading an image here overrides the logo picked on the previous step.
              </p>
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-black/5 dark:bg-white/5">
                  {previewImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewImage} alt="" className="h-full w-full object-cover" />
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
                  {uploadedImageUrl && !uploadingImage && (
                    <button
                      type="button"
                      className="mt-1 text-xs text-[var(--text-muted)] underline hover:text-[var(--text)]"
                      onClick={() => {
                        setUploadedImageUrl(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      Remove uploaded image
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="btn-ghost" type="button" onClick={() => setStep(1)} disabled={busy}>
                Back
              </button>
              <button className="btn-primary flex-1" type="button" onClick={createTemplate} disabled={busy}>
                {busy ? "Creating..." : "Create template"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
